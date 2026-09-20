import { CalendarExportOptions, GeneratedCalendarFile } from '../types/calendar';
import { Course, Task } from '../types/task';
import { isNumericalOrInternalCode } from './blackboardApi';

/**
 * Formats a Date object or ISO string to RFC 5545 UTC format: YYYYMMDDTHHMMSSZ
 */
export function formatIcsDate(dateInput: Date | string): string {
  const date = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
  const pad = (n: number) => (n < 10 ? '0' + n : String(n));

  const year = date.getUTCFullYear();
  const month = pad(date.getUTCMonth() + 1);
  const day = pad(date.getUTCDate());
  const hours = pad(date.getUTCHours());
  const minutes = pad(date.getUTCMinutes());
  const seconds = pad(date.getUTCSeconds());

  return `${year}${month}${day}T${hours}${minutes}${seconds}Z`;
}

/**
 * Escapes characters for RFC 5545 TEXT properties
 */
export function escapeIcsText(str: string): string {
  return str
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r\n/g, '\\n')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\n');
}

/**
 * Folds RFC 5545 lines to a maximum of 75 octets per RFC 5545 Section 3.1
 */
export function foldIcsLine(line: string): string {
  const MAX_OCTETS = 75;
  if (line.length <= MAX_OCTETS) return line;

  let result = '';
  let current = line;

  while (current.length > MAX_OCTETS) {
    result += current.substring(0, MAX_OCTETS) + '\r\n ';
    current = current.substring(MAX_OCTETS);
  }
  result += current;
  return result;
}

/**
 * Generates an RFC 5545 VEVENT block for a task
 */
export function generateVEvent(task: Task, options: CalendarExportOptions): string[] {
  const lines: string[] = [];
  const dueDate = new Date(task.dueDate);
  // Default event window: 30 minutes ending at the due time (or 1h for quizzes/tests)
  const windowMinutes = task.type === 'QUIZ_TEST' ? 60 : 30;
  const startDate = new Date(dueDate.getTime() - windowMinutes * 60 * 1000);

  const uid = `${task.id}@blackboard-tasksync.local`;
  const dtstamp = formatIcsDate(new Date());
  const dtstart = formatIcsDate(startDate);
  const dtend = formatIcsDate(dueDate);

  const courseLabel = !isNumericalOrInternalCode(task.courseName)
    ? (!isNumericalOrInternalCode(task.courseCode) ? task.courseCode : task.courseName)
    : (!isNumericalOrInternalCode(task.courseCode) ? task.courseCode : task.courseName || '');
  const coursePrefix = courseLabel ? `[${courseLabel}] ` : '';
  const summary = `${coursePrefix}${task.title}`;

  // Build description
  let desc = `Due Date: ${dueDate.toLocaleString()}\nCourse: ${task.courseName} (${task.courseId})\nType: ${task.type}\n`;
  if (task.points !== undefined) {
    desc += `Points: ${task.points}\n`;
  }
  if (task.description) {
    desc += `\nInstructions:\n${task.description}\n`;
  }
  if (task.subtasks && task.subtasks.length > 0) {
    desc += '\nSubtasks:\n';
    task.subtasks.forEach((st) => {
      desc += `${st.completed ? '✓' : '☐'} ${st.title}\n`;
    });
  }
  if (task.url) {
    desc += `\nBlackboard Link:\n${task.url}\n`;
  }
  desc += '\n--\nExported via Blackboard TaskSync';

  lines.push('BEGIN:VEVENT');
  lines.push(`UID:${uid}`);
  lines.push(`DTSTAMP:${dtstamp}`);
  lines.push(`DTSTART:${dtstart}`);
  lines.push(`DTEND:${dtend}`);
  lines.push(`SUMMARY:${escapeIcsText(summary)}`);
  lines.push(`DESCRIPTION:${escapeIcsText(desc)}`);
  if (task.url) {
    lines.push(`URL:${task.url}`);
  }
  lines.push(`CATEGORIES:${task.type},Blackboard`);
  lines.push(`STATUS:${task.isCompleted ? 'COMPLETED' : 'CONFIRMED'}`);

  // Configurable VALARM reminders
  if (options.reminders.enable24h) {
    lines.push('BEGIN:VALARM');
    lines.push('ACTION:DISPLAY');
    lines.push(`DESCRIPTION:Reminder: ${escapeIcsText(summary)} is due in 24 hours`);
    lines.push('TRIGGER:-P1D');
    lines.push('END:VALARM');
  }

  if (options.reminders.enable2h) {
    lines.push('BEGIN:VALARM');
    lines.push('ACTION:DISPLAY');
    lines.push(`DESCRIPTION:Reminder: ${escapeIcsText(summary)} is due in 2 hours!`);
    lines.push('TRIGGER:-PT2H');
    lines.push('END:VALARM');
  }

  if (options.reminders.enable1h) {
    lines.push('BEGIN:VALARM');
    lines.push('ACTION:DISPLAY');
    lines.push(`DESCRIPTION:URGENT: ${escapeIcsText(summary)} is due in 1 hour!`);
    lines.push('TRIGGER:-PT1H');
    lines.push('END:VALARM');
  }

  lines.push('END:VEVENT');
  return lines;
}

/**
 * Builds the complete VCALENDAR content from an array of VEVENT lines
 */
export function buildVCalendar(calendarName: string, eventLines: string[]): string {
  const header = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Blackboard TaskSync//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${escapeIcsText(calendarName)}`,
    'X-WR-TIMEZONE:UTC'
  ];

  const footer = ['END:VCALENDAR'];

  const allLines = [...header, ...eventLines, ...footer];
  // Fold lines and join with standard CRLF
  return allLines.map((line) => foldIcsLine(line)).join('\r\n') + '\r\n';
}

/**
 * Filter tasks according to export options
 */
export function filterTasksForExport(tasks: Task[], options: CalendarExportOptions): Task[] {
  return tasks.filter((task) => {
    // Scope filter
    if (options.scope === 'pending' && task.isCompleted) {
      return false;
    }
    if (
      options.scope === 'selected_courses' &&
      options.selectedCourseIds &&
      options.selectedCourseIds.length > 0
    ) {
      if (!options.selectedCourseIds.includes(task.courseId)) {
        return false;
      }
    }

    // Type filter
    if (!options.includedTypes.includes(task.type)) {
      return false;
    }

    return true;
  });
}

/**
 * Generates one or more .ics calendar files based on user configuration
 */
export function generateCalendarFiles(
  tasks: Task[],
  courses: Course[],
  options: CalendarExportOptions
): GeneratedCalendarFile[] {
  const targetTasks = filterTasksForExport(tasks, options);

  if (targetTasks.length === 0) {
    return [];
  }

  const courseMap = new Map<string, Course>(courses.map((c) => [c.id, c]));

  if (options.separateFilesPerCourse) {
    // Group by course
    const tasksByCourse = new Map<string, Task[]>();
    for (const task of targetTasks) {
      const list = tasksByCourse.get(task.courseId) || [];
      list.push(task);
      tasksByCourse.set(task.courseId, list);
    }

    const files: GeneratedCalendarFile[] = [];
    for (const [courseId, courseTasks] of tasksByCourse.entries()) {
      const course = courseMap.get(courseId);
      const courseName = course ? course.code || course.name : courseId;
      const safeCourseName = courseName.replace(/[^a-zA-Z0-9_-]/g, '_');
      const filename = `Blackboard_${safeCourseName}_Deadlines.ics`;

      const eventLines: string[] = [];
      for (const t of courseTasks) {
        eventLines.push(...generateVEvent(t, options));
      }

      files.push({
        filename,
        content: buildVCalendar(`Blackboard - ${courseName}`, eventLines),
        courseName,
        itemCount: courseTasks.length
      });
    }

    return files;
  } else {
    // Single unified calendar file
    const eventLines: string[] = [];
    for (const t of targetTasks) {
      eventLines.push(...generateVEvent(t, options));
    }

    const prefix = options.filenamePrefix || 'Blackboard_Academic_Deadlines';
    const dateStamp = new Date().toISOString().split('T')[0];
    const filename = `${prefix}_${dateStamp}.ics`;

    return [
      {
        filename,
        content: buildVCalendar('Blackboard Academic Deadlines', eventLines),
        itemCount: targetTasks.length
      }
    ];
  }
}

/**
 * Triggers a browser file download for a generated calendar file
 */
export function downloadCalendarFile(file: GeneratedCalendarFile): void {
  const blob = new Blob([file.content], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);

  // If chrome.downloads is available
  if (typeof chrome !== 'undefined' && chrome.downloads?.download) {
    chrome.downloads.download({
      url,
      filename: file.filename,
      saveAs: false
    });
    return;
  }

  // Standard web browser fallback
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', file.filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
