import { generateCalendarFiles, filterTasksForExport, formatIcsDate, foldIcsLine, escapeIcsText } from '../services/calendarExport';
import { INITIAL_COURSES, INITIAL_TASKS } from '../services/mockData';
import { CalendarExportOptions } from '../types/calendar';

function runTests() {
  console.log('🧪 Starting RFC 5545 Calendar Exporter Test Suite...\n');

  // Test 1: Date formatting
  const testDate = new Date('2026-10-15T18:30:00Z');
  const formattedDate = formatIcsDate(testDate);
  if (formattedDate !== '20261015T183000Z') {
    throw new Error(`Date formatting failed: expected 20261015T183000Z, got ${formattedDate}`);
  }
  console.log('✅ Test 1: ISO UTC date formatting correctly matches RFC 5545 (YYYYMMDDTHHMMSSZ)');

  // Test 2: Text Escaping
  const textToEscape = 'Assignment, with semicolons; and newlines\r\nand backslash \\';
  const escaped = escapeIcsText(textToEscape);
  if (!escaped.includes('\\,') || !escaped.includes('\\;') || !escaped.includes('\\\\') || !escaped.includes('\\n')) {
    throw new Error(`Escaping failed: ${escaped}`);
  }
  console.log('✅ Test 2: Character escaping matches RFC 5545 (escaped commas, semicolons, backslashes, newlines)');

  // Test 3: Line Folding (75 octets)
  const longLine = 'DESCRIPTION:This is an extremely long line that should definitely exceed seventy-five octets in length according to RFC 5545 Section 3.1 standard.';
  const folded = foldIcsLine(longLine);
  const foldedParts = folded.split('\r\n ');
  if (foldedParts.length < 2) {
    throw new Error(`Line folding failed: ${folded}`);
  }
  for (const part of foldedParts) {
    if (part.length > 76) {
      throw new Error(`Folded line exceeded max octets: ${part.length}`);
    }
  }
  console.log('✅ Test 3: Line folding correctly breaks lines at <= 75 octets with CRLF space');

  // Test 4: Unified Calendar Export with VALARM
  const options: CalendarExportOptions = {
    scope: 'all',
    includedTypes: ['ASSIGNMENT', 'QUIZ_TEST', 'DISCUSSION', 'CUSTOM_TASK'],
    reminders: {
      enable24h: true,
      enable2h: true,
      enable1h: false,
    },
    separateFilesPerCourse: false,
  };

  const files = generateCalendarFiles(INITIAL_TASKS, INITIAL_COURSES, options);
  if (files.length !== 1) {
    throw new Error(`Expected 1 unified file, got ${files.length}`);
  }

  const ics = files[0].content;
  if (!ics.startsWith('BEGIN:VCALENDAR\r\n')) {
    throw new Error('ICS missing BEGIN:VCALENDAR header');
  }
  if (!ics.endsWith('END:VCALENDAR\r\n')) {
    throw new Error('ICS missing END:VCALENDAR footer');
  }
  if (!ics.includes('VERSION:2.0\r\n')) {
    throw new Error('ICS missing VERSION:2.0');
  }
  if (!ics.includes('BEGIN:VALARM\r\n')) {
    throw new Error('ICS missing BEGIN:VALARM');
  }
  if (!ics.includes('TRIGGER:-P1D\r\n')) {
    throw new Error('ICS missing 24h reminder trigger TRIGGER:-P1D');
  }
  if (!ics.includes('TRIGGER:-PT2H\r\n')) {
    throw new Error('ICS missing 2h reminder trigger TRIGGER:-PT2H');
  }
  console.log(`✅ Test 4: Unified calendar export generated with ${files[0].itemCount} events and VALARM reminders`);

  // Test 5: Separate files per course
  const separateOptions: CalendarExportOptions = {
    scope: 'all',
    includedTypes: ['ASSIGNMENT', 'QUIZ_TEST', 'DISCUSSION', 'CUSTOM_TASK'],
    reminders: {
      enable24h: true,
      enable2h: false,
      enable1h: false,
    },
    separateFilesPerCourse: true,
  };

  const perCourseFiles = generateCalendarFiles(INITIAL_TASKS, INITIAL_COURSES, separateOptions);
  if (perCourseFiles.length <= 1) {
    throw new Error(`Expected multiple files for separate courses, got ${perCourseFiles.length}`);
  }
  console.log(`✅ Test 5: Per-course export generated ${perCourseFiles.length} separate .ics files`);

  // Test 6: Filter by pending only
  const pendingOptions: CalendarExportOptions = {
    scope: 'pending',
    includedTypes: ['ASSIGNMENT', 'QUIZ_TEST', 'DISCUSSION', 'CUSTOM_TASK'],
    reminders: { enable24h: false, enable2h: false, enable1h: false },
    separateFilesPerCourse: false,
  };
  const pendingTasks = filterTasksForExport(INITIAL_TASKS, pendingOptions);
  const completedFound = pendingTasks.some(t => t.isCompleted);
  if (completedFound) {
    throw new Error('Completed task found when filtering for pending tasks');
  }
  console.log(`✅ Test 6: Filter scope 'pending' correctly excluded completed tasks (${pendingTasks.length} pending tasks)`);

  console.log('\n🎉 ALL RFC 5545 CALENDAR EXPORT TESTS PASSED!\n');
}

runTests();
