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
 * Extract clean course code and name (e.g. "CS 301 - Operating Systems" -> code: "CS 301", name: "Operating Systems")
 */
export function parseCourseInfo(rawId?: string, rawName?: string): { code: string; name: string } {
  const fallback = rawName || rawId || 'Course';
  if (!rawName && rawId) {
    const codeMatch = rawId.match(/([a-zA-Z]{2,4}\s?[0-9]{3,4})/i);
    return {
      code: codeMatch ? codeMatch[1].toUpperCase() : rawId,
      name: rawId
    };
  }

  // Common pattern: "CS301_2026: Operating Systems" or "MATH 240 - Linear Algebra"
  const match = rawName?.match(/^([a-zA-Z0-9\s_-]+?)[:–\-]\s*(.+)$/);
  if (match) {
    return {
      code: match[1].trim(),
      name: match[2].trim()
    };
  }

  return {
    code: fallback.substring(0, 8),
    name: fallback
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

    const courseInfo = parseCourseInfo(undefined, title);

    tasks.push({
      id: uid,
      courseId: courseInfo.code,
      courseName: courseInfo.name,
      courseCode: courseInfo.code,
      title,
      type: classifyBlackboardItem(undefined, title),
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
      const courseInfo = parseCourseInfo(item.courseId, item.calendarName);
      const dueDate = item.end ? new Date(item.end).toISOString() : new Date().toISOString();
      const directUrl = item.id
        ? `${cleanBaseUrl}/webapps/calendar/launch/attempt/${item.id}`
        : cleanBaseUrl;

      return {
        id: `bb_leg_${item.id || Math.random().toString(36).substring(2)}`,
        courseId: item.courseId || courseInfo.code,
        courseName: courseInfo.name,
        courseCode: courseInfo.code,
        title: item.title || 'Blackboard Item',
        type: classifyBlackboardItem(item.eventType, item.title),
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
      const courseInfo = parseCourseInfo(item.courseId, item.calendarName);
      const taskType = classifyBlackboardItem(item.type, item.title);
      const dueDate = item.end ? new Date(item.end).toISOString() : new Date().toISOString();

      let directUrl = `${baseUrl}/ultra/calendar`;
      if (item.courseId && item.id) {
        directUrl = `${baseUrl}/ultra/courses/${item.courseId}/outline/assessment/${item.id}/overview`;
      }

      return {
        id: `bb_${item.id}`,
        courseId: item.courseId || courseInfo.code,
        courseName: courseInfo.name,
        courseCode: courseInfo.code,
        title: item.title,
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
        courseMap.set(t.courseId, {
          id: t.courseId,
          code: t.courseCode || t.courseId,
          name: t.courseName || t.courseId,
          color: colorPalette[colorIndex]
        });
      }
    });

    return Array.from(courseMap.values());
  }
};
