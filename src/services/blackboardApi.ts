import { BbCalendarItem, BbCalendarItemsResponse } from '../types/blackboard';
import { Course, Task, TaskType } from '../types/task';

/**
 * Normalizes item type based on title and Blackboard category
 */
export function classifyBlackboardItem(rawType?: string, title: string = ''): TaskType {
  const lowerType = (rawType || '').toLowerCase();
  const lowerTitle = title.toLowerCase();

  if (
    lowerType.includes('quiz') ||
    lowerType.includes('test') ||
    lowerType.includes('exam') ||
    lowerTitle.includes('quiz') ||
    lowerTitle.includes('test') ||
    lowerTitle.includes('exam') ||
    lowerTitle.includes('midterm') ||
    lowerTitle.includes('final')
  ) {
    return 'QUIZ_TEST';
  }

  if (
    lowerType.includes('discussion') ||
    lowerType.includes('forum') ||
    lowerTitle.includes('discussion') ||
    lowerTitle.includes('forum')
  ) {
    return 'DISCUSSION';
  }

  return 'ASSIGNMENT';
}

/**
 * Checks if a string is a raw database key, CRN, or numerical code
 * (e.g. "_12345_1", "10482", "202610_58291", "CRN_12345")
 */
export function isNumericalOrInternalCode(str?: string): boolean {
  if (!str) return true;
  const s = str.trim();
  if (/^_\d+(_\d+)?$/.test(s)) return true; // Blackboard DB key e.g. _12345_1
  if (/^\d+$/.test(s)) return true; // Pure digits e.g. 58291
  if (/^[\d_-]+$/.test(s)) return true; // Digits and underscores e.g. 202610_12345
  if (/^(crn|course|sec|section|bb)[_-]?\d+$/i.test(s)) return true; // e.g. CRN12345
  return false;
}

export interface ParsedItemInfo {
  courseCode: string;
  courseName: string;
  cleanTitle: string;
}

/**
 * Extracts human-readable course title and course code from Blackboard titles and metadata
 * Handles formats like:
 * - "[CS301 - Operating Systems] Lab 3: Page Replacement"
 * - "[Operating Systems] Lab 3"
 * - "CS 301: Assignment 1"
 * - "Operating Systems - Assignment 2"
 * - "Quiz 4: Diagonalization (MATH 240)"
 * - "CHEM 101 - General Chemistry: Exam 1"
 */
export function extractCourseAndTitle(
  rawTitle: string,
  rawCourseId?: string,
  rawCalendarName?: string
): ParsedItemInfo {
  let title = (rawTitle || '').trim();
  let detectedCode = '';
  let detectedCourseName = '';

  // 1. Check if rawCalendarName has a readable name (and is not an internal code)
  if (rawCalendarName && !isNumericalOrInternalCode(rawCalendarName)) {
    const calMatch =
      rawCalendarName.match(/^([a-zA-Z]{2,4}\s?[0-9]{3,4})[:–\-]\s*(.+)$/i) ||
      rawCalendarName.match(/^([a-zA-Z0-9\s_-]+?)[:–\-]\s*(.+)$/);
    if (calMatch) {
      if (!isNumericalOrInternalCode(calMatch[1])) detectedCode = calMatch[1].trim();
      detectedCourseName = calMatch[2].trim();
    } else {
      detectedCourseName = rawCalendarName.trim();
      const codeMatch = rawCalendarName.match(/([a-zA-Z]{2,4}\s?[0-9]{3,4})/i);
      if (codeMatch) detectedCode = codeMatch[1].toUpperCase();
    }
  }

  // 2. Check if rawCourseId has a subject code e.g. "CS301_FALL26"
  if (rawCourseId && !detectedCode) {
    const idMatch = rawCourseId.match(/([a-zA-Z]{2,4}\s?[0-9]{3,4})/i);
    if (idMatch) {
      detectedCode = idMatch[1].toUpperCase();
    }
  }

  // 3. Extract from rawTitle (where Blackboard professors embed Course Name)
  // Pattern A: Bracketed prefix "[Course Name]" or "[CS301 - Operating Systems]"
  const bracketMatch = title.match(/^\[(.*?)\]\s*(.*)$/);
  if (bracketMatch) {
    const bracketContent = bracketMatch[1].trim();
    const rest = bracketMatch[2].trim();

    const subMatch = bracketContent.match(/^([a-zA-Z]{2,4}\s?[0-9]{3,4})\s*[:–\-]\s*(.+)$/i);
    if (subMatch) {
      detectedCode = subMatch[1].trim().toUpperCase();
      detectedCourseName = subMatch[2].trim();
    } else {
      const codeM = bracketContent.match(/^([a-zA-Z]{2,4}\s?[0-9]{3,4})$/i);
      if (codeM) {
        detectedCode = codeM[1].toUpperCase();
      } else if (!isNumericalOrInternalCode(bracketContent)) {
        detectedCourseName = bracketContent;
      }
    }

    if (rest) {
      title = rest;
    }
  }

  // Pattern B: Parentheses suffix e.g. "Lab 3 (CS301 - Operating Systems)" or "Quiz (MATH 240)"
  if (!detectedCourseName || isNumericalOrInternalCode(detectedCourseName)) {
    const parenSuffixMatch = title.match(/^(.*?)\s*\((.*?)\)$/);
    if (parenSuffixMatch) {
      const rest = parenSuffixMatch[1].trim();
      const parenContent = parenSuffixMatch[2].trim();
      if (!isNumericalOrInternalCode(parenContent) && parenContent.length >= 3) {
        const subMatch = parenContent.match(/^([a-zA-Z]{2,4}\s?[0-9]{3,4})\s*[:–\-]\s*(.+)$/i);
        if (subMatch) {
          detectedCode = subMatch[1].trim().toUpperCase();
          detectedCourseName = subMatch[2].trim();
        } else {
          const codeM = parenContent.match(/([a-zA-Z]{2,4}\s?[0-9]{3,4})/i);
          if (codeM) detectedCode = codeM[1].toUpperCase();
          detectedCourseName = parenContent;
        }
        title = rest;
      }
    }
  }

  // Pattern C: Triple separator "CODE - NAME - TASK" or "CODE: NAME: TASK"
  // e.g. "CS301 - Operating Systems - Lab 3" or "CHEM 101 - General Chemistry: Exam 1"
  if (!detectedCourseName || isNumericalOrInternalCode(detectedCourseName)) {
    const tripleMatch = title.match(/^([a-zA-Z]{2,4}\s?[0-9]{3,4})\s*[:–\-]\s*(.+?)\s*[:–\-]\s*(.+)$/i);
    if (tripleMatch) {
      const middle = tripleMatch[2].trim();
      const isMiddleTask = /(assignment|homework|quiz|test|exam|lab|problem\s*set|project|essay|discussion|ch(apter)?\.?\s*\d+|module|week|draft|midterm|final|reading|exercise)/i.test(
        middle
      );
      if (!isMiddleTask && !isNumericalOrInternalCode(middle)) {
        detectedCode = tripleMatch[1].trim().toUpperCase();
        detectedCourseName = middle;
        title = tripleMatch[3].trim();
      }
    }
  }

  // Pattern D: Course prefix with separator "COURSE_NAME - TASK" or "COURSE_NAME: TASK"
  if (!detectedCourseName || isNumericalOrInternalCode(detectedCourseName)) {
    const sepMatch = title.match(/^([a-zA-Z0-9\s&,/]+?)[:–\-]\s*(.+)$/);
    if (sepMatch) {
      const left = sepMatch[1].trim();
      const right = sepMatch[2].trim();
      const isRightTask =
        /(assignment|homework|quiz|test|exam|lab|problem\s*set|project|essay|discussion|ch(apter)?\.?\s*\d+|module|week|draft|midterm|final|reading|exercise)/i.test(
          right
        );
      const isLeftCode = /^[a-zA-Z]{2,4}\s?[0-9]{3,4}$/i.test(left);

      if ((isRightTask || isLeftCode || left.length >= 4) && !isNumericalOrInternalCode(left)) {
        if (isLeftCode) {
          detectedCode = left.toUpperCase();
        } else {
          detectedCourseName = left;
          const codeInLeft = left.match(/([a-zA-Z]{2,4}\s?[0-9]{3,4})/i);
          if (codeInLeft) detectedCode = codeInLeft[1].toUpperCase();
        }
        title = right;
      }
    }
  }

  // Clean detectedCourseName if it still contains numerical IDs
  if (isNumericalOrInternalCode(detectedCourseName)) {
    detectedCourseName = '';
  }

  // Fallback defaults
  const finalCode =
    detectedCode ||
    (rawCourseId && !isNumericalOrInternalCode(rawCourseId) ? rawCourseId : '') ||
    'Course';

  const finalName =
    detectedCourseName ||
    (detectedCode ? detectedCode : '') ||
    (rawCalendarName && !isNumericalOrInternalCode(rawCalendarName) ? rawCalendarName : '') ||
    (rawCourseId && !isNumericalOrInternalCode(rawCourseId) ? rawCourseId : finalCode);

  return {
    courseCode: finalCode,
    courseName: finalName,
    cleanTitle: title || rawTitle
  };
}

/**
 * Backward-compatible helper for parsing raw IDs and names
 */
export function parseCourseInfo(rawId?: string, rawName?: string): { code: string; name: string } {
  const result = extractCourseAndTitle('', rawId, rawName);
  return {
    code: result.courseCode,
    name: result.courseName
  };
}

/**
 * Parses raw iCal feed text (webcal/ics format) into Task items
 */
export function parseIcsFeed(icsText: string, baseUrl: string = ''): Task[] {
  const tasks: Task[] = [];
  const events = icsText.split(/BEGIN:VEVENT/i);

  for (let i = 1; i < events.length; i++) {
    const eventBlock = events[i].split(/END:VEVENT/i)[0];
    if (!eventBlock) continue;

    const summaryMatch = eventBlock.match(/SUMMARY(?:;[^:]*)?:(.*?)(\r?\n[^\s]|\r?\n$)/s);
    const dtendMatch = eventBlock.match(/DTEND(?:;[^:]*)?:([0-9TZ]+)/i);
    const dtstartMatch = eventBlock.match(/DTSTART(?:;[^:]*)?:([0-9TZ]+)/i);
    const uidMatch = eventBlock.match(/UID(?:;[^:]*)?:(.*?)(\r?\n|$)/i);
    const descMatch = eventBlock.match(/DESCRIPTION(?:;[^:]*)?:(.*?)(\r?\n[^\s]|\r?\n$)/s);
    const urlMatch = eventBlock.match(/URL(?:;[^:]*)?:(.*?)(\r?\n|$)/i);

    const title = (summaryMatch ? summaryMatch[1] : 'Blackboard Event')
      .replace(/\r?\n /g, '')
      .trim();

    const rawDate = dtendMatch ? dtendMatch[1] : dtstartMatch ? dtstartMatch[1] : null;
    if (!rawDate) continue;

    // Parse YYYYMMDDTHHMMSSZ or YYYYMMDD
    let isoDate = new Date().toISOString();
    if (rawDate.includes('T')) {
      const year = rawDate.substring(0, 4);
      const month = rawDate.substring(4, 6);
      const day = rawDate.substring(6, 8);
      const hour = rawDate.substring(9, 11);
      const min = rawDate.substring(11, 13);
      const sec = rawDate.substring(13, 15) || '00';
      isoDate = `${year}-${month}-${day}T${hour}:${min}:${sec}Z`;
    }

    const uid = uidMatch ? uidMatch[1].trim() : `bb_ics_${Date.now()}_${i}`;
    const desc = descMatch ? descMatch[1].replace(/\r?\n /g, '').replace(/\\n/g, '\n').trim() : '';
    const itemUrl = urlMatch ? urlMatch[1].trim() : baseUrl;

    const parsed = extractCourseAndTitle(title);

    tasks.push({
      id: uid,
      courseId: parsed.courseCode || 'Course',
      courseName: parsed.courseName,
      courseCode: parsed.courseCode,
      title: parsed.cleanTitle,
      type: classifyBlackboardItem(undefined, parsed.cleanTitle),
      dueDate: isoDate,
      url: itemUrl,
      isCompleted: false,
      source: 'BLACKBOARD',
      lastSynced: new Date().toISOString(),
      description: desc
    });
  }

  return tasks;
}

/**
 * Blackboard API Client
 */
export const BlackboardApiService = {
  /**
   * Fetches calendar items from Blackboard Ultra session API
   */
  async fetchUltraCalendarItems(baseUrl: string): Promise<Task[]> {
    const cleanBaseUrl = baseUrl.replace(/\/+$/, '');
    const now = new Date();
    // Fetch from 14 days ago to 90 days in the future
    const startDate = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000).toISOString();
    const endDate = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000).toISOString();

    const endpoint = `${cleanBaseUrl}/learn/api/public/v1/calendars/items?since=${encodeURIComponent(
      startDate
    )}&until=${encodeURIComponent(endDate)}&limit=100`;

    const response = await fetch(endpoint, {
      method: 'GET',
      credentials: 'include',
      headers: {
        Accept: 'application/json',
        'X-Requested-With': 'XMLHttpRequest'
      }
    });

    if (!response.ok) {
      if (response.status === 401 || response.status === 403) {
        throw new Error('AUTH_EXPIRED');
      }
      throw new Error(`API_ERROR_${response.status}`);
    }

    const data: BbCalendarItemsResponse = await response.json();
    return this.normalizeUltraItems(data.results || [], cleanBaseUrl);
  },

  /**
   * Fetches from legacy Blackboard calendar endpoint (/webapps/calendar/calendarData/)
   */
  async fetchLegacyCalendarItems(baseUrl: string): Promise<Task[]> {
    const cleanBaseUrl = baseUrl.replace(/\/+$/, '');
    const now = new Date();
    const startTimestamp = now.getTime() - 14 * 24 * 60 * 60 * 1000;
    const endTimestamp = now.getTime() + 90 * 24 * 60 * 60 * 1000;

    const endpoint = `${cleanBaseUrl}/webapps/calendar/calendarData/selectedCalendarEvents?start=${startTimestamp}&end=${endTimestamp}`;

    const response = await fetch(endpoint, {
      method: 'GET',
      credentials: 'include',
      headers: {
        Accept: 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`LEGACY_API_ERROR_${response.status}`);
    }

    const items = await response.json();
    if (!Array.isArray(items)) return [];

    return items.map((item: any) => {
      const parsed = extractCourseAndTitle(item.title, item.courseId, item.calendarName);
      const dueDate = item.end ? new Date(item.end).toISOString() : new Date().toISOString();
      const directUrl = item.id
        ? `${cleanBaseUrl}/webapps/calendar/launch/attempt/${item.id}`
        : cleanBaseUrl;

      return {
        id: `bb_leg_${item.id || Math.random().toString(36).substring(2)}`,
        courseId: item.courseId || parsed.courseCode || parsed.courseName,
        courseName: parsed.courseName,
        courseCode: parsed.courseCode,
        title: parsed.cleanTitle,
        type: classifyBlackboardItem(item.eventType, parsed.cleanTitle),
        dueDate,
        url: directUrl,
        isCompleted: false,
        source: 'BLACKBOARD',
        lastSynced: new Date().toISOString(),
        description: item.description
      };
    });
  },

  /**
   * Normalizes Blackboard Ultra calendar items into standard Task model
   */
  normalizeUltraItems(items: BbCalendarItem[], baseUrl: string): Task[] {
    return items.map((item) => {
      const parsed = extractCourseAndTitle(item.title, item.courseId, item.calendarName);
      const taskType = classifyBlackboardItem(item.type, parsed.cleanTitle);
      const dueDate = item.end ? new Date(item.end).toISOString() : new Date().toISOString();

      let directUrl = `${baseUrl}/ultra/calendar`;
      if (item.courseId && item.id) {
        directUrl = `${baseUrl}/ultra/courses/${item.courseId}/outline/assessment/${item.id}/overview`;
      }

      return {
        id: `bb_${item.id}`,
        courseId: item.courseId || parsed.courseCode || parsed.courseName,
        courseName: parsed.courseName,
        courseCode: parsed.courseCode,
        title: parsed.cleanTitle,
        type: taskType,
        dueDate,
        url: directUrl,
        isCompleted: false,
        source: 'BLACKBOARD',
        lastSynced: new Date().toISOString(),
        description: item.description
      };
    });
  },

  /**
   * Extracts distinct Course records from an array of tasks
   */
  extractCoursesFromTasks(tasks: Task[]): Course[] {
    const courseMap = new Map<string, Course>();
    const colorPalette = ['#3B82F6', '#8B5CF6', '#EC4899', '#10B981', '#F59E0B', '#06B6D4', '#6366F1'];

    tasks.forEach((t) => {
      if (!t.courseId) return;
      if (!courseMap.has(t.courseId)) {
        const colorIndex = courseMap.size % colorPalette.length;
        const hasReadableName = !isNumericalOrInternalCode(t.courseName);
        const hasReadableCode = !isNumericalOrInternalCode(t.courseCode);

        const name = hasReadableName ? t.courseName : hasReadableCode ? t.courseCode! : 'Course';
        const code = hasReadableCode ? t.courseCode! : name;

        courseMap.set(t.courseId, {
          id: t.courseId,
          code,
          name,
          color: colorPalette[colorIndex]
        });
      }
    });

    return Array.from(courseMap.values());
  }
};
