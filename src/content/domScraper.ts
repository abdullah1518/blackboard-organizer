import { classifyBlackboardItem, extractCourseAndTitle } from '../services/blackboardApi';
import { Task } from '../types/task';

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
