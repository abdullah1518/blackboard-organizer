import {
  classifyBlackboardItem,
  extractCourseAndTitle,
  parseBlackboardCourseString,
  isNumericalOrInternalCode
} from '../services/blackboardApi';
import { Course, Task } from '../types/task';

/**
 * Fallback DOM Scraper for Blackboard Ultra Stream and Legacy pages
 */
export const DomScraper = {
  /**
   * Scrapes upcoming deadlines from the current page DOM
   */
  scrapeDeadlines(): Task[] {
    const tasks: Task[] = [];
    const isUltra = window.location.pathname.startsWith('/ultra');

    if (isUltra) {
      tasks.push(...this.scrapeUltraStream());
      tasks.push(...this.scrapeUltraCalendarView());
    } else {
      tasks.push(...this.scrapeOriginalView());
    }

    return tasks;
  },

  /**
   * Scrapes Course records from Blackboard Ultra courses page (/ultra/course or /ultra/courses),
   * activity stream (/ultra/stream), calendar (/ultra/calendar), or legacy pages
   */
  scrapeCoursesFromDom(): Course[] {
    const courseMap = new Map<string, Course>();
    const colorPalette = ['#3B82F6', '#8B5CF6', '#EC4899', '#10B981', '#F59E0B', '#06B6D4', '#6366F1'];

    const courseElements = document.querySelectorAll(
      'a[href*="/ultra/courses/"], a[href*="courseMain"], [data-analytics-id*="course"], .course-element-card, div[role="group"], article, tr'
    );

    courseElements.forEach((el) => {
      try {
        const text = el.textContent?.trim() || '';
        const href = el.getAttribute('href') || el.querySelector('a[href*="course"]')?.getAttribute('href') || '';

        const idMatch = href.match(/\/courses\/([^/?#]+)/) || href.match(/course_id=([^&#]+)/);
        const internalId = idMatch ? idMatch[1] : undefined;

        const headingEl = el.querySelector('h3, h4, .course-title, strong, a') || el;
        const headingText = headingEl.textContent?.trim() || '';

        const parsed = parseBlackboardCourseString(headingText).code
          ? parseBlackboardCourseString(headingText)
          : parseBlackboardCourseString(text);

        if (parsed.code || (parsed.name && !isNumericalOrInternalCode(parsed.name))) {
          const colorIndex = courseMap.size % colorPalette.length;
          const courseId = internalId || parsed.code || `course_${courseMap.size}`;
          const code = parsed.code || parsed.name!;
          const name = parsed.name || parsed.code!;

          const courseObj: Course = {
            id: courseId,
            code,
            name,
            color: colorPalette[colorIndex],
            term: parsed.term
          };

          if (!courseMap.has(courseId)) {
            courseMap.set(courseId, courseObj);
          }
          if (internalId && !courseMap.has(internalId)) {
            courseMap.set(internalId, courseObj);
          }
        }
      } catch {
        // Continue
      }
    });

    return Array.from(new Set(courseMap.values()));
  },

  /**
   * Scrapes Blackboard Ultra Activity Stream cards (/ultra/stream)
   */
  scrapeUltraStream(): Task[] {
    const scraped: Task[] = [];
    // Ultra stream cards
    const streamItems = document.querySelectorAll(
      '[data-analytics-id*="stream-item"], .stream-item-container, article[role="article"]'
    );

    streamItems.forEach((item, index) => {
      try {
        const titleEl = item.querySelector('h3, h4, .stream-item-title, a[href*="assessment"]');
        const courseEl = item.querySelector('.context-label, .stream-item-context, [data-course-id]');
        const dateEl = item.querySelector('time, .timestamp, [datetime], .due-date');
        const linkEl = item.querySelector('a[href*="courses"]');

        if (titleEl && (titleEl.textContent || '').trim()) {
          const rawTitle = titleEl.textContent?.trim() || '';
          const rawCourse = courseEl?.textContent?.trim() || '';
          const parsed = extractCourseAndTitle(rawTitle, undefined, rawCourse);

          let dueDate = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();
          if (dateEl) {
            const dtAttr = dateEl.getAttribute('datetime');
            if (dtAttr) {
              const parsedDate = new Date(dtAttr);
              if (!isNaN(parsedDate.getTime())) dueDate = parsedDate.toISOString();
            } else if (dateEl.textContent) {
              const parsedDate = new Date(dateEl.textContent.trim());
              if (!isNaN(parsedDate.getTime())) dueDate = parsedDate.toISOString();
            }
          }

          const href = linkEl?.getAttribute('href') || window.location.href;
          const fullUrl = href.startsWith('http') ? href : `${window.location.origin}${href}`;

          scraped.push({
            id: `bb_dom_ultra_${Date.now()}_${index}`,
            courseId: parsed.courseCode || parsed.courseName,
            courseName: parsed.courseName,
            courseCode: parsed.courseCode,
            title: parsed.cleanTitle,
            type: classifyBlackboardItem(undefined, parsed.cleanTitle),
            dueDate,
            url: fullUrl,
            isCompleted: false,
            source: 'BLACKBOARD',
            lastSynced: new Date().toISOString()
          });
        }
      } catch {
        // Continue on individual card parse errors
      }
    });

    return scraped;
  },

  /**
   * Scrapes calendar view in Ultra (/ultra/calendar)
   */
  scrapeUltraCalendarView(): Task[] {
    const scraped: Task[] = [];
    const eventCards = document.querySelectorAll('.calendar-event, [role="gridcell"] [tabindex="0"]');

    eventCards.forEach((card, index) => {
      const text = card.textContent || '';
      if (!text.trim()) return;

      const titleEl = card.querySelector('.title, strong, a') || card;
      const rawTitle = titleEl.textContent?.trim() || '';
      if (rawTitle.length < 3) return;

      scraped.push({
        id: `bb_dom_cal_${Date.now()}_${index}`,
        courseId: 'CALENDAR_EVENT',
        courseName: 'Blackboard Calendar',
        courseCode: 'CAL',
        title: rawTitle,
        type: classifyBlackboardItem(undefined, rawTitle),
        dueDate: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        url: window.location.href,
        isCompleted: false,
        source: 'BLACKBOARD',
        lastSynced: new Date().toISOString()
      });
    });

    return scraped;
  },

  /**
   * Scrapes legacy Blackboard Learn Original pages (/webapps/...)
   */
  scrapeOriginalView(): Task[] {
    const scraped: Task[] = [];
    // Legacy calendar or My Grades table rows
    const rows = document.querySelectorAll('#grades_wrapper tr, .fc-event, table.inventoryList tr');

    rows.forEach((row, index) => {
      const titleLink = row.querySelector('a');
      const dateCell = row.querySelector('.date, .cellGradeDate, .timestamp');

      if (titleLink && titleLink.textContent?.trim()) {
        const rawTitle = titleLink.textContent.trim();
        const parsed = extractCourseAndTitle(rawTitle, undefined, undefined);
        let dueDate = new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString();

        if (dateCell && dateCell.textContent) {
          const parsedDate = new Date(dateCell.textContent.trim());
          if (!isNaN(parsedDate.getTime())) dueDate = parsedDate.toISOString();
        }

        const href = titleLink.getAttribute('href') || '';
        const fullUrl = href.startsWith('http') ? href : `${window.location.origin}${href}`;

        scraped.push({
          id: `bb_dom_orig_${Date.now()}_${index}`,
          courseId: parsed.courseCode || parsed.courseName || 'LEGACY_COURSE',
          courseName: parsed.courseName,
          courseCode: parsed.courseCode,
          title: parsed.cleanTitle,
          type: classifyBlackboardItem(undefined, parsed.cleanTitle),
          dueDate,
          url: fullUrl,
          isCompleted: false,
          source: 'BLACKBOARD',
          lastSynced: new Date().toISOString()
        });
      }
    });

    return scraped;
  },

  /**
   * Reads CSRF/XSRF tokens from cookies or page meta
   */
  extractXsrfToken(): string | undefined {
    // Check cookies for xsrf / CSRF
    const match = document.cookie.match(/(?:^|;\s*)(?:XSRF-TOKEN|bb_xsrf|csrftoken)=([^;]*)/);
    if (match) return decodeURIComponent(match[1]);

    // Check meta tags
    const metaToken = document.querySelector('meta[name="csrf-token"], meta[name="xsrf-token"]');
    if (metaToken) return metaToken.getAttribute('content') || undefined;

    return undefined;
  }
};
