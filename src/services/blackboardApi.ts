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
 * (e.g. "_12345_1", "10482", "202610_58291", "12789.202610.LEC", "CRN_12345", "Course")
 */
export function isNumericalOrInternalCode(str?: string): boolean {
  if (!str) return true;
  const s = str.trim();
  if (s.toLowerCase() === 'course') return true;
  if (/^_\d+(_\d+)?$/.test(s)) return true; // Blackboard DB key e.g. _12345_1
  if (/^\d+$/.test(s)) return true; // Pure digits e.g. 58291
  if (/^[\d_-]+$/.test(s)) return true; // Digits and underscores e.g. 202610_12345
  if (/^\d+\.\d+\.[a-zA-Z]+$/i.test(s)) return true; // CRN.term.type e.g. 12789.202610.LEC
  if (/^(crn|course|sec|section|bb)[_-]?\d+$/i.test(s)) return true; // e.g. CRN12345
  return false;
}

export interface ParsedCourseResult {
  code?: string;
  name?: string;
  fullName?: string;
  section?: string;
  term?: string;
}

/**
 * Parses Blackboard/Banner course strings like:
 * - "261-BUS-200-04(Business & Entrepreneurship-LEC)" -> Code: "BUS 200", Name: "Business & Entrepreneurship"
 * - "261-ENGL-214 [Common: All Students]" -> Code: "ENGL 214", Name: "Common: All Students"
 * - "261-ENGL-214-14(Academic & Professional Comm)[Active Learning]" -> Code: "ENGL 214", Name: "Academic & Professional Comm"
 * - "261-ICS-381-01(Princ. Artificial Intelligence)" -> Code: "ICS 381", Name: "Princ. Artificial Intelligence"
 * - "261-SWE-387-01(Software Project Management)" -> Code: "SWE 387", Name: "Software Project Management"
 * - "261-ENGL-214-common-eld-coordinated" -> Code: "ENGL 214", Name: "Common Eld Coordinated"
 * - "engl214", "bus200", "ics381", "swe387" -> "ENGL 214", "BUS 200", "ICS 381", "SWE 387"
 * - "CS 301 - Operating Systems" -> Code: "CS 301", Name: "Operating Systems"
 */
export function parseBlackboardCourseString(raw?: string): ParsedCourseResult {
  if (!raw || typeof raw !== 'string') return {};
  const s = raw.trim();
  if (!s || s.toLowerCase() === 'course' || isNumericalOrInternalCode(s)) return {};

  // 1. Banner/Blackboard full pattern:
  // e.g. "261-BUS-200-04(Business & Entrepreneurship-LEC)"
  // e.g. "261-ENGL-214-14(Academic & Professional Comm)[Active Learning]"
  // e.g. "261-ICS-381-01(Princ. Artificial Intelligence)"
  // e.g. "261-SWE-387-01(Software Project Management)"
  const bannerMatch = s.match(
    /^(?:(\d{3,6})[-\s_])?([a-zA-Z]{2,6})[-\s_]?([0-9]{3}[a-zA-Z]?)(?:[-\s_]([0-9]{1,3}))?\s*(?:\((.*?)\))?(?:\s*\[(.*?)\])?$/i
  );

  if (bannerMatch) {
    const term = bannerMatch[1];
    const dept = bannerMatch[2].toUpperCase();
    const num = bannerMatch[3];
    const section = bannerMatch[4];
    let parenText = (bannerMatch[5] || '').trim();
    let bracketText = (bannerMatch[6] || '').trim();

    // Clean up trailing section / mode tags like "-LEC", "-LAB", "[Active Learning]"
    if (parenText) {
      parenText = parenText.replace(/[-_\s]*(LEC|LAB|REC|DIS|STU|SEM|ACT)$/i, '').trim();
    }
    if (bracketText) {
      bracketText = bracketText.replace(/[-_\s]*(Active Learning|LEC|LAB|REC|DIS)$/i, '').trim();
    }

    const courseCode = `${dept} ${num}`;
    const courseName = parenText || bracketText || courseCode;
    const fullName = parenText && parenText !== courseCode ? `${courseCode} - ${parenText}` : courseName;

    return {
      code: courseCode,
      name: courseName,
      fullName,
      section,
      term
    };
  }

  // 2. Bracket style: e.g. "261-ENGL-214 [Common: All Students]"
  const bracketStyleMatch = s.match(
    /^(?:(\d{3,6})[-\s_])?([a-zA-Z]{2,6})[-\s_]?([0-9]{3}[a-zA-Z]?)\s*\[(.*?)\]$/i
  );
  if (bracketStyleMatch) {
    const term = bracketStyleMatch[1];
    const dept = bracketStyleMatch[2].toUpperCase();
    const num = bracketStyleMatch[3];
    const bracketContent = bracketStyleMatch[4].trim();
    const courseCode = `${dept} ${num}`;
    return {
      code: courseCode,
      name: bracketContent || courseCode,
      fullName: bracketContent ? `${courseCode} [${bracketContent}]` : courseCode,
      term
    };
  }

  // 3. Slug style: e.g. "261-ENGL-214-common-eld-coordinated"
  const slugMatch = s.match(
    /^(?:(\d{3,6})[-\s_])?([a-zA-Z]{2,6})[-\s_]?([0-9]{3}[a-zA-Z]?)[-\s_]([a-zA-Z0-9_\s-]+)$/i
  );
  if (slugMatch) {
    const term = slugMatch[1];
    const dept = slugMatch[2].toUpperCase();
    const num = slugMatch[3];
    const rest = slugMatch[4].replace(/[-_]+/g, ' ').trim();
    const courseCode = `${dept} ${num}`;
    const titleCased = rest.replace(/\b\w/g, (c) => c.toUpperCase());
    return {
      code: courseCode,
      name: titleCased,
      fullName: `${courseCode} - ${titleCased}`,
      term
    };
  }

  // 4. Standalone compact code: e.g. "engl214", "bus200", "ics381", "swe387", "CS 301", "MATH 240"
  const standaloneMatch = s.match(/^([a-zA-Z]{2,6})\s*[-_]?\s*([0-9]{3}[a-zA-Z]?)$/i);
  if (standaloneMatch) {
    const dept = standaloneMatch[1].toUpperCase();
    const num = standaloneMatch[2];
    const courseCode = `${dept} ${num}`;
    return {
      code: courseCode,
      name: courseCode,
      fullName: courseCode
    };
  }

  // 5. Code with separator: e.g. "CS 301 - Operating Systems" or "MATH 240: Linear Algebra"
  const sepCodeMatch = s.match(/^([a-zA-Z]{2,6}\s*[-_]?\s*[0-9]{3}[a-zA-Z]?)\s*[:–\-]\s*(.+)$/i);
  if (sepCodeMatch) {
    const rawCode = sepCodeMatch[1].trim();
    const rawRest = sepCodeMatch[2].trim();
    const codeParsed = parseBlackboardCourseString(rawCode);
    const code = codeParsed.code || rawCode.toUpperCase();
    return {
      code,
      name: rawRest,
      fullName: `${code} - ${rawRest}`
    };
  }

  // 6. Embedded code: e.g. contains "261-ICS-381" or "BUS-200"
  const embeddedMatch = s.match(/\b([a-zA-Z]{2,6})[-\s_]([0-9]{3}[a-zA-Z]?)\b/i);
  if (embeddedMatch) {
    const dept = embeddedMatch[1].toUpperCase();
    const num = embeddedMatch[2];
    const courseCode = `${dept} ${num}`;
    return {
      code: courseCode,
      name: s,
      fullName: `${courseCode} - ${s}`
    };
  }

  return {};
}

export interface ParsedItemInfo {
  courseCode: string;
  courseName: string;
  cleanTitle: string;
}

/**
 * Extracts human-readable course title and course code from Blackboard titles and metadata
 */
export function extractCourseAndTitle(
  rawTitle: string,
  rawCourseId?: string,
  rawCalendarName?: string
): ParsedItemInfo {
  let title = (rawTitle || '').trim();
  let detectedCode = '';
  let detectedCourseName = '';

  // 1. Check if rawCalendarName has a readable course name/code
  if (rawCalendarName && !isNumericalOrInternalCode(rawCalendarName)) {
    const parsedCal = parseBlackboardCourseString(rawCalendarName);
    if (parsedCal.code) detectedCode = parsedCal.code;
    if (parsedCal.name && !isNumericalOrInternalCode(parsedCal.name)) {
      detectedCourseName = parsedCal.name;
    } else if (!isNumericalOrInternalCode(rawCalendarName)) {
      detectedCourseName = rawCalendarName.trim();
    }
  }

  // 2. Check if rawCourseId has a subject code e.g. "261-ENGL-214..." or "CS301_FALL26"
  if (rawCourseId) {
    const parsedId = parseBlackboardCourseString(rawCourseId);
    if (parsedId.code && !detectedCode) {
      detectedCode = parsedId.code;
    }
    if (
      parsedId.name &&
      (!detectedCourseName || isNumericalOrInternalCode(detectedCourseName)) &&
      !isNumericalOrInternalCode(parsedId.name)
    ) {
      detectedCourseName = parsedId.name;
    }
  }

  // 3. Extract from rawTitle (where Blackboard professors embed Course Name)
  // Pattern A: Bracketed prefix "[Course Name]" or "[CS301 - Operating Systems]"
  const bracketMatch = title.match(/^\[(.*?)\]\s*(.*)$/);
  if (bracketMatch) {
    const bracketContent = bracketMatch[1].trim();
    const rest = bracketMatch[2].trim();

    const parsedBracket = parseBlackboardCourseString(bracketContent);
    if (parsedBracket.code) {
      detectedCode = parsedBracket.code;
      detectedCourseName = parsedBracket.name || parsedBracket.code;
    } else {
      const subMatch = bracketContent.match(/^([a-zA-Z]{2,4}\s?[0-9]{3,4})\s*[:–\-]\s*(.+)$/i);
      if (subMatch) {
        detectedCode = subMatch[1].trim().toUpperCase();
        detectedCourseName = subMatch[2].trim();
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
        const parsedParen = parseBlackboardCourseString(parenContent);
        if (parsedParen.code) {
          detectedCode = parsedParen.code;
          detectedCourseName = parsedParen.name || parsedParen.code;
        } else {
          const subMatch = parenContent.match(/^([a-zA-Z]{2,4}\s?[0-9]{3,4})\s*[:–\-]\s*(.+)$/i);
          if (subMatch) {
            detectedCode = subMatch[1].trim().toUpperCase();
            detectedCourseName = subMatch[2].trim();
          } else {
            detectedCourseName = parenContent;
          }
        }
        title = rest;
      }
    }
  }

  // Pattern C: Triple separator "CODE - NAME - TASK" or "CODE: NAME: TASK"
  // e.g. "CS301 - Operating Systems - Lab 3" or "CHEM 101 - General Chemistry: Exam 1"
  if (!detectedCourseName || isNumericalOrInternalCode(detectedCourseName)) {
    const tripleMatch = title.match(/^([a-zA-Z]{2,6}\s?[0-9]{3,4})\s*[:–\-]\s*(.+?)\s*[:–\-]\s*(.+)$/i);
    if (tripleMatch) {
      const middle = tripleMatch[2].trim();
      const isMiddleTask = /(assignment|homework|quiz|test|exam|lab|problem\s*set|project|essay|discussion|ch(apter)?\.?\s*\d+|module|week|draft|midterm|final|reading|exercise)/i.test(
        middle
      );
      if (!isMiddleTask && !isNumericalOrInternalCode(middle)) {
        const parsedC = parseBlackboardCourseString(tripleMatch[1]);
        detectedCode = parsedC.code || tripleMatch[1].trim().toUpperCase();
        detectedCourseName = middle;
        title = tripleMatch[3].trim();
      }
    }
  }

  // Pattern D: Course prefix with separator "COURSE_NAME - TASK" or "COURSE_NAME: TASK"
  if (!detectedCourseName || isNumericalOrInternalCode(detectedCourseName)) {
    const sepMatch = title.match(/^([a-zA-Z0-9\s&,/_-]+?)[:–\-]\s*(.+)$/);
    if (sepMatch) {
      const left = sepMatch[1].trim();
      const right = sepMatch[2].trim();
      const isRightTask =
        /(assignment|homework|quiz|test|exam|lab|problem\s*set|project|essay|discussion|ch(apter)?\.?\s*\d+|module|week|draft|midterm|final|reading|exercise)/i.test(
          right
        );
      const parsedLeft = parseBlackboardCourseString(left);
      const isLeftCode = !!parsedLeft.code || /^[a-zA-Z]{2,6}\s?[0-9]{3,4}$/i.test(left);

      if ((isRightTask || isLeftCode || left.length >= 4) && !isNumericalOrInternalCode(left)) {
        if (parsedLeft.code) {
          detectedCode = parsedLeft.code;
          detectedCourseName = parsedLeft.name || parsedLeft.code;
        } else if (isLeftCode) {
          detectedCode = left.toUpperCase();
        } else {
          detectedCourseName = left;
          const codeInLeft = left.match(/([a-zA-Z]{2,6}\s?[0-9]{3,4})/i);
          if (codeInLeft) detectedCode = codeInLeft[1].toUpperCase();
        }
        title = right;
      }
    }
  }

  // Clean detectedCourseName if it still contains numerical IDs or 'Course'
  if (isNumericalOrInternalCode(detectedCourseName)) {
    detectedCourseName = '';
  }

  // Fallback defaults
  const finalCode =
    detectedCode ||
    (rawCourseId && !isNumericalOrInternalCode(rawCourseId) ? rawCourseId : '') ||
    (detectedCourseName ? detectedCourseName : 'Course');

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
   * Fetches enrolled courses from Blackboard Ultra REST API endpoints:
   * 1. /learn/api/public/v1/users/me/courses?expand=course
   * 2. /learn/api/public/v1/calendars
   */
  async fetchUserCourses(baseUrl: string): Promise<Course[]> {
    const cleanBaseUrl = baseUrl.replace(/\/+$/, '');
    const courseMap = new Map<string, Course>();
    const colorPalette = ['#3B82F6', '#8B5CF6', '#EC4899', '#10B981', '#F59E0B', '#06B6D4', '#6366F1'];

    // 1. Try /learn/api/public/v1/users/me/courses?expand=course
    try {
      const resp = await fetch(`${cleanBaseUrl}/learn/api/public/v1/users/me/courses?expand=course`, {
        method: 'GET',
        credentials: 'include',
        headers: {
          Accept: 'application/json',
          'X-Requested-With': 'XMLHttpRequest'
        }
      });
      if (resp.ok) {
        const data = await resp.json();
        const results = data.results || (Array.isArray(data) ? data : []);
        results.forEach((item: any) => {
          const rawName = item.course?.name || item.course?.courseId || item.courseId || '';
          const parsed = parseBlackboardCourseString(rawName);
          const rawId = item.courseId || item.course?.id || item.id;
          const secondaryId = item.course?.courseId;

          const parsedSec = secondaryId ? parseBlackboardCourseString(secondaryId) : {};
          const code =
            parsed.code ||
            parsedSec.code ||
            (!isNumericalOrInternalCode(secondaryId) ? secondaryId : '') ||
            (!isNumericalOrInternalCode(rawName) ? rawName : 'Course');
          const name = parsed.name || parsedSec.name || (!isNumericalOrInternalCode(rawName) ? rawName : code);
          const colorIndex = courseMap.size % colorPalette.length;

          if (rawId && code !== 'Course') {
            const courseObj: Course = {
              id: rawId,
              code,
              name,
              color: colorPalette[colorIndex],
              term: parsed.term || parsedSec.term
            };
            courseMap.set(rawId, courseObj);
            if (secondaryId && secondaryId !== rawId) {
              courseMap.set(secondaryId, courseObj);
            }
          }
        });
      }
    } catch {
      // Continue to next endpoint
    }

    // 2. Try /learn/api/public/v1/calendars
    try {
      const resp = await fetch(`${cleanBaseUrl}/learn/api/public/v1/calendars`, {
        method: 'GET',
        credentials: 'include',
        headers: {
          Accept: 'application/json',
          'X-Requested-With': 'XMLHttpRequest'
        }
      });
      if (resp.ok) {
        const data = await resp.json();
        const results = data.results || (Array.isArray(data) ? data : []);
        results.forEach((cal: any) => {
          if (!cal.id) return;
          const parsed = parseBlackboardCourseString(cal.name || '');
          if (parsed.code || (cal.name && !isNumericalOrInternalCode(cal.name))) {
            const colorIndex = courseMap.size % colorPalette.length;
            const code = parsed.code || cal.name;
            const name = parsed.name || cal.name;
            const courseObj: Course = {
              id: cal.id,
              code,
              name,
              color: colorPalette[colorIndex],
              term: parsed.term
            };
            if (!courseMap.has(cal.id)) {
              courseMap.set(cal.id, courseObj);
            }
            if (cal.courseId && !courseMap.has(cal.courseId)) {
              courseMap.set(cal.courseId, courseObj);
            }
          }
        });
      }
    } catch {
      // Continue
    }

    return Array.from(new Set(courseMap.values()));
  },

  /**
   * Fetches calendar items from Blackboard Ultra session API
   */
  async fetchUltraCalendarItems(baseUrl: string, coursesMap?: Map<string, Course>): Promise<Task[]> {
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
    return this.normalizeUltraItems(data.results || [], cleanBaseUrl, coursesMap);
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

      const isLegacySubmitted =
        item.completed === true ||
        item.isCompleted === true ||
        item.status === 'COMPLETED' ||
        item.status === 'GRADED' ||
        item.status === 'SUBMITTED' ||
        item.attemptCount > 0 ||
        item.grade !== undefined ||
        /\b(submitted|graded|completed)\b/i.test(item.description || '');

      return {
        id: `bb_leg_${item.id || Math.random().toString(36).substring(2)}`,
        courseId: item.courseId || parsed.courseCode || parsed.courseName,
        courseName: parsed.courseName,
        courseCode: parsed.courseCode,
        title: parsed.cleanTitle,
        type: classifyBlackboardItem(item.eventType, parsed.cleanTitle),
        dueDate,
        url: directUrl,
        isCompleted: isLegacySubmitted,
        completedAt: isLegacySubmitted ? new Date().toISOString() : undefined,
        source: 'BLACKBOARD',
        lastSynced: new Date().toISOString(),
        description: item.description
      };
    });
  },

  /**
   * Normalizes Blackboard Ultra calendar items into standard Task model
   */
  normalizeUltraItems(items: BbCalendarItem[], baseUrl: string, coursesMap?: Map<string, Course>): Task[] {
    return items.map((item) => {
      const parsed = extractCourseAndTitle(item.title, item.courseId, item.calendarName);
      const taskType = classifyBlackboardItem(item.type, parsed.cleanTitle);
      const dueDate = item.end ? new Date(item.end).toISOString() : new Date().toISOString();

      let directUrl = `${baseUrl}/ultra/calendar`;
      if (item.courseId && item.id) {
        directUrl = `${baseUrl}/ultra/courses/${item.courseId}/outline/assessment/${item.id}/overview`;
      }

      let resolvedCode = parsed.courseCode;
      let resolvedName = parsed.courseName;

      if (coursesMap) {
        const matched =
          (item.courseId && coursesMap.get(item.courseId)) ||
          (item.calendarId && coursesMap.get(item.calendarId));
        if (matched) {
          if (!resolvedCode || resolvedCode === 'Course' || isNumericalOrInternalCode(resolvedCode)) {
            resolvedCode = matched.code;
          }
          if (!resolvedName || resolvedName === 'Course' || isNumericalOrInternalCode(resolvedName)) {
            resolvedName = matched.name;
          }
        }
      }

      // Detect if assignment has been submitted or completed
      const isSubmitted =
        (item as any).completed === true ||
        (item as any).isCompleted === true ||
        (item as any).status === 'COMPLETED' ||
        (item as any).status === 'SUBMITTED' ||
        (item as any).status === 'GRADED' ||
        (item as any).status === 'ATTEMPTED' ||
        (item as any).attemptStatus === 'SUBMITTED' ||
        (item as any).attemptStatus === 'COMPLETED' ||
        (item as any).attemptStatus === 'GRADED' ||
        (item as any).userCompletionStatus === 'COMPLETED' ||
        item.dynamicCalendarItemProps?.attemptable === false ||
        ((item.dynamicCalendarItemProps as any)?.attemptCount || 0) > 0 ||
        (item.dynamicCalendarItemProps as any)?.isCompleted === true ||
        (item.dynamicCalendarItemProps as any)?.status === 'COMPLETED' ||
        (item as any).grade !== undefined ||
        (item as any).score !== undefined ||
        (item as any).hasSubmissions === true ||
        /\b(submitted|graded|completed)\b/i.test(item.description || '');

      return {
        id: `bb_${item.id}`,
        courseId: item.courseId || resolvedCode || resolvedName,
        courseName: resolvedName,
        courseCode: resolvedCode,
        title: parsed.cleanTitle,
        type: taskType,
        dueDate,
        url: directUrl,
        isCompleted: isSubmitted,
        completedAt: isSubmitted ? new Date().toISOString() : undefined,
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
        const parsed = parseBlackboardCourseString(t.courseName || t.courseCode || t.courseId);

        let code = parsed.code || t.courseCode || '';
        let name = parsed.name || t.courseName || '';

        if (isNumericalOrInternalCode(code)) code = '';
        if (isNumericalOrInternalCode(name)) name = '';

        if (!code && !name) {
          code = 'Course';
          name = 'Course';
        } else if (!code) {
          code = name;
        } else if (!name) {
          name = code;
        }

        courseMap.set(t.courseId, {
          id: t.courseId,
          code,
          name,
          color: colorPalette[colorIndex],
          term: parsed.term
        });
      }
    });

    return Array.from(courseMap.values());
  }
};
