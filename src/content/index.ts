import { DomScraper } from './domScraper';

/**
 * Blackboard TaskSync Content Script
 */
(() => {
  // Report session presence
  const currentDomain = window.location.origin;
  const xsrfToken = DomScraper.extractXsrfToken();

  // Listen for queries from popup or background
  if (typeof chrome !== 'undefined' && chrome.runtime?.onMessage) {
    chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
      if (message.type === 'PING') {
        sendResponse({
          status: 'OK',
          domain: currentDomain,
          hasXsrf: !!xsrfToken,
          url: window.location.href
        });
        return true;
      }

      if (message.type === 'SCRAPE_PAGE_DOM') {
        try {
          const tasks = DomScraper.scrapeDeadlines();
          const courses = DomScraper.scrapeCoursesFromDom();
          sendResponse({
            success: true,
            tasks,
            courses,
            domain: currentDomain
          });
        } catch (err: any) {
          sendResponse({
            success: false,
            error: err?.message || 'DOM scrape failed'
          });
        }
        return true;
      }

      if (message.type === 'SCRAPE_COURSES') {
        try {
          const courses = DomScraper.scrapeCoursesFromDom();
          sendResponse({
            success: true,
            courses,
            domain: currentDomain
          });
        } catch (err: any) {
          sendResponse({
            success: false,
            error: err?.message || 'Courses scrape failed'
          });
        }
        return true;
      }
    });
  }

  // Auto-notify background of active Blackboard session & detected courses
  if (typeof chrome !== 'undefined' && chrome.runtime?.sendMessage) {
    const courses = DomScraper.scrapeCoursesFromDom();
    chrome.runtime.sendMessage({
      type: 'SESSION_DETECTED',
      domain: currentDomain,
      url: window.location.href,
      hasXsrf: !!xsrfToken,
      courses: courses.length > 0 ? courses : undefined
    }).catch(() => {
      // Ignored if extension background is waking up
    });
  }
})();
