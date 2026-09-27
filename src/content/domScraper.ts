import {
  classifyBlackboardItem,
  extractCourseAndTitle,
  parseBlackboardCourseString,
  isNumericalOrInternalCode
} from '../services/blackboardApi';
import { Course, Task } from '../types/task';

/**
 * Check if a DOM element or row indicates the item has been submitted or graded
 */
export function isDomElementSubmitted(element: Element): boolean {
  try {
    const isSubmittedText = (text: string) => {
      const lower = text.toLowerCase().trim();
      if (!lower) return false;
      if (lower.includes('not submitted') || lower.includes('unsubmitted')) return false;
      return (
        lower.includes('submitted') ||
        lower.includes('graded') ||
        lower.includes('completed') ||
        lower.includes('attempt submitted') ||
        lower.includes('grade posted') ||
        lower.includes('view attempt') ||
        lower.includes('view submission') ||
        lower.includes('view assessment results') ||
        /\b(?:submitted|graded|completed)\b/i.test(lower)
      );
    };

    // 1. Check aria-label / title attributes on root and children
    const ariaLabels = [
      element.getAttribute('aria-label'),
      element.getAttribute('title'),
      element.getAttribute('data-status')
    ].filter(Boolean) as string[];

    for (const label of ariaLabels) {
      if (isSubmittedText(label)) return true;
    }

    // 2. Check status elements, icons, pills, badges
    const statusSelectors = [
      '.stream-item-status',
      '.status',
      '.grade',
      '.cellGrade',
      '.cellGradeDate',
      '.badge',
      '.pill',
      '.submission-status',
      '.is-completed',
      '.completed',
      '[data-analytics-id*="status"]',
      '[aria-label*="Submitted" i]',
      '[aria-label*="Graded" i]',
      '[aria-label*="Completed" i]'
    ];

    const statusEl = element.querySelector(statusSelectors.join(', '));
    if (statusEl) {
      const aria = statusEl.getAttribute('aria-label') || statusEl.getAttribute('title') || '';
      if (isSubmittedText(aria)) return true;
      const txt = statusEl.textContent || '';
      if (isSubmittedText(txt)) return true;
    }

    // 3. Check for specific completed/submitted class markers
    if (
      element.classList.contains('completed') ||
      element.classList.contains('is-completed') ||
      element.querySelector('.completed, .is-completed, [data-is-complete="true"]')
    ) {
      return true;
    }

    // 4. Check entire element text for strong submission indicators
    const fullText = element.textContent || '';
    if (
      /(?:attempt\s*submitted|grade\s*posted|submitted\s*on|submitted\s*at|past\s*due\s*and\s*submitted)/i.test(
        fullText
      ) &&
      !/(?:not\s*submitted|unsubmitted)/i.test(fullText)
    ) {
      return true;
    }
  } catch {
    // ignore
  }
  return false;
}

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
   * Scrapes Course records from Blackboard Ultra courses page.
   * Targets only the course title h4 elements:
   * e.g. <h4 class="js-course-title-element ellipsis" id="course-name-_15829_1">261-SWE-387-01(Software Project Management)</h4>
   */
  scrapeCoursesFromDom(): Course[] {
    const courseMap = new Map<string, Course>();
    const colorPalette = ['#3B82F6', '#8B5CF6', '#EC4899', '#10B981', '#F59E0B', '#06B6D4', '#6366F1'];

    // Select course title h4 elements only, as requested
    const courseH4Elements = document.querySelectorAll(
      'h4.js-course-title-element, h4[id^="course-name-"], [id^="course-name-"].js-course-title-element, h4[ng-bind*="getCourseName"], h4.course-title, .js-course-title-element'
    );

    courseH4Elements.forEach((h4) => {
      try {
        const fullTitle = (h4.textContent || h4.getAttribute('title') || '').replace(/\s+/g, ' ').trim();
        if (!fullTitle || isNumericalOrInternalCode(fullTitle) || fullTitle.toLowerCase() === 'course') return;

        // 1. Extract course ID from id="course-name-_15829_1"
        const idAttr = h4.getAttribute('id') || '';
        let courseId = '';
        const idMatch = idAttr.match(/^course-name-(.+)$/);
        if (idMatch) {
          courseId = idMatch[1].trim();
        }

        // 2. Check enclosing anchor or parent card if ID not on the h4 itself
        if (!courseId) {
          const parentLink =
            h4.closest('a[href*="/courses/"]') ||
            h4.closest('a[href*="course_id="]') ||
            h4.parentElement?.querySelector('a[href*="/courses/"]') ||
            h4.closest('.course-element-card, [role="group"], article, li, div')?.querySelector('a[href*="/courses/"]');
          if (parentLink) {
            const href = parentLink.getAttribute('href') || '';
            const match = href.match(/\/courses\/([^/?#]+)/) || href.match(/course_id=([^&#]+)/);
            if (match) courseId = match[1].trim();
          }
        }

        // 3. Check data-course-id or data-id attributes
        if (!courseId) {
          const dataId =
            h4.getAttribute('data-course-id') ||
            h4.closest('[data-course-id]')?.getAttribute('data-course-id') ||
            h4.getAttribute('data-id');
          if (dataId && !isNumericalOrInternalCode(dataId)) courseId = dataId;
        }

        // 4. Parse course code for searching and filtering (e.g. "SWE 387")
        const parsed = parseBlackboardCourseString(fullTitle);
        const code = parsed.code || fullTitle;
        if (!courseId) {
          courseId = code || `course_${courseMap.size}`;
        }

        const colorIndex = courseMap.size % colorPalette.length;
        const courseObj: Course = {
          id: courseId,
          code,
          name: fullTitle, // Full course title directly from the h4 element! e.g. "261-SWE-387-01(Software Project Management)"
          color: colorPalette[colorIndex],
          term: parsed.term
        };

        if (!courseMap.has(courseId)) {
          courseMap.set(courseId, courseObj);
        }
        if (code && !courseMap.has(code)) {
          courseMap.set(code, courseObj);
        }
      } catch {
        // Continue
      }
    });

    // Fallback for older Blackboard Learn 9.1 (Original Experience) institutions if no Ultra h4 elements found
    if (courseMap.size === 0) {
      const legacyLinks = document.querySelectorAll(
        '.courseListing a, #module_course_list a, a[href*="courseMain"], a[href*="/webapps/blackboard/execute/launcher?type=Course"]'
      );
      legacyLinks.forEach((a) => {
        try {
          const fullTitle = (a.textContent || a.getAttribute('title') || '').replace(/\s+/g, ' ').trim();
          if (!fullTitle || isNumericalOrInternalCode(fullTitle) || fullTitle.toLowerCase() === 'course') return;
          const href = a.getAttribute('href') || '';
          const idMatch = href.match(/id=([^&#]+)/) || href.match(/course_id=([^&#]+)/);
          const courseId = idMatch ? idMatch[1].trim() : `legacy_${courseMap.size}`;
          const parsed = parseBlackboardCourseString(fullTitle);
          const code = parsed.code || fullTitle;
          const colorIndex = courseMap.size % colorPalette.length;
          const courseObj: Course = {
            id: courseId,
            code,
            name: fullTitle,
            color: colorPalette[colorIndex],
            term: parsed.term
          };
          if (!courseMap.has(courseId)) {
            courseMap.set(courseId, courseObj);
          }
        } catch {
          // Continue
        }
      });
    }

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

          const isCompleted = isDomElementSubmitted(item);
          const courseSlug = (parsed.courseCode || parsed.courseName || 'course').toLowerCase().replace(/[^a-z0-9]/g, '');
          const titleSlug = parsed.cleanTitle.toLowerCase().replace(/[^a-z0-9]/g, '_').slice(0, 40);
          const deterministicId = `bb_dom_ultra_${courseSlug}_${titleSlug || index}`;

          scraped.push({
            id: deterministicId,
            courseId: parsed.courseCode || parsed.courseName,
            courseName: parsed.courseName,
            courseCode: parsed.courseCode,
            title: parsed.cleanTitle,
            type: classifyBlackboardItem(undefined, parsed.cleanTitle),
            dueDate,
            url: fullUrl,
            isCompleted,
            completedAt: isCompleted ? new Date().toISOString() : undefined,
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

      const isCompleted = isDomElementSubmitted(card);
      const titleSlug = rawTitle.toLowerCase().replace(/[^a-z0-9]/g, '_').slice(0, 40);
      const deterministicId = `bb_dom_cal_${titleSlug || index}`;

      scraped.push({
        id: deterministicId,
        courseId: 'CALENDAR_EVENT',
        courseName: 'Blackboard Calendar',
        courseCode: 'CAL',
        title: rawTitle,
        type: classifyBlackboardItem(undefined, rawTitle),
        dueDate: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        url: window.location.href,
        isCompleted,
        completedAt: isCompleted ? new Date().toISOString() : undefined,
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

        const isCompleted = isDomElementSubmitted(row);
        const courseSlug = (parsed.courseCode || parsed.courseName || 'orig').toLowerCase().replace(/[^a-z0-9]/g, '');
        const titleSlug = parsed.cleanTitle.toLowerCase().replace(/[^a-z0-9]/g, '_').slice(0, 40);
        const deterministicId = `bb_dom_orig_${courseSlug}_${titleSlug || index}`;

        scraped.push({
          id: deterministicId,
          courseId: parsed.courseCode || parsed.courseName || 'LEGACY_COURSE',
          courseName: parsed.courseName,
          courseCode: parsed.courseCode,
          title: parsed.cleanTitle,
          type: classifyBlackboardItem(undefined, parsed.cleanTitle),
          dueDate,
          url: fullUrl,
          isCompleted,
          completedAt: isCompleted ? new Date().toISOString() : undefined,
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
