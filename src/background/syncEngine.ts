import { BlackboardApiService, parseBlackboardCourseString } from '../services/blackboardApi';
import { StorageService } from '../services/storage';
import { Course, Task } from '../types/task';

export interface SyncResult {
  success: boolean;
  tasksCount: number;
  added: number;
  updated: number;
  source: 'ULTRA_API' | 'LEGACY_API' | 'DOM_SCRAPER' | 'DEMO_DATA';
  error?: string;
}

export const SyncEngine = {
  /**
   * Main sync orchestration entry point
   */
  async runSync(manualTrigger = false): Promise<SyncResult> {
    const settings = await StorageService.getSettings();

    // If Demo Mode is enabled and this is not a forced live sync
    if (settings.isDemoMode && !manualTrigger) {
      const existing = await StorageService.getTasks();
      return {
        success: true,
        tasksCount: existing.length,
        added: 0,
        updated: 0,
        source: 'DEMO_DATA'
      };
    }

    const targetUrl = settings.customBlackboardUrl || 'https://learn.blackboard.com';
    let fetchedTasks: Task[] = [];
    let extractionSource: SyncResult['source'] = 'ULTRA_API';

    try {
      // 0. Pre-fetch real Course records from Blackboard Ultra API & active tab
      let discoveredCourses: any[] = [];
      try {
        discoveredCourses = await BlackboardApiService.fetchUserCourses(targetUrl);
      } catch {
        // Continue
      }

      const tabCourses = await this.queryActiveTabCourses();
      if (tabCourses.length > 0) {
        discoveredCourses.push(...tabCourses);
      }

      if (discoveredCourses.length > 0) {
        await StorageService.upsertCourses(discoveredCourses);
      }

      const allKnownCourses = await StorageService.getCourses();
      const coursesMap = new Map<string, any>();
      allKnownCourses.forEach((c) => {
        coursesMap.set(c.id, c);
        if (c.code) {
          coursesMap.set(c.code.toLowerCase(), c);
          coursesMap.set(c.code.toLowerCase().replace(/[\s-_]/g, ''), c);
        }
      });

      // 1. Try Primary: Blackboard Learn Ultra REST API
      try {
        fetchedTasks = await BlackboardApiService.fetchUltraCalendarItems(targetUrl, coursesMap);
        extractionSource = 'ULTRA_API';
      } catch (ultraErr: any) {
        // 2. Try Secondary: Legacy calendar endpoint
        try {
          fetchedTasks = await BlackboardApiService.fetchLegacyCalendarItems(targetUrl);
          extractionSource = 'LEGACY_API';
        } catch (legacyErr: any) {
          // 3. Try Tertiary: Query active Blackboard tab DOM scraper
          const tabTasks = await this.queryActiveTabDomScraper();
          if (tabTasks && tabTasks.length > 0) {
            fetchedTasks = tabTasks;
            extractionSource = 'DOM_SCRAPER';
          } else {
            // If all failed and we are in demo mode, preserve demo data
            if (settings.isDemoMode) {
              const currentTasks = await StorageService.getTasks();
              return {
                success: true,
                tasksCount: currentTasks.length,
                added: 0,
                updated: 0,
                source: 'DEMO_DATA'
              };
            }
            throw new Error(
              ultraErr.message === 'AUTH_EXPIRED'
                ? 'Session expired. Please open Blackboard in your browser to sign in.'
                : 'Could not connect to Blackboard. Please check your institutional URL or log in.'
            );
          }
        }
      }

      if (fetchedTasks.length > 0) {
        // Enrich tasks with discovered course codes (e.g. BUS 200, ENGL 214, ICS 381, SWE 387)
        fetchedTasks = fetchedTasks.map((task) => {
          let matched =
            coursesMap.get(task.courseId) ||
            (task.courseCode ? coursesMap.get(task.courseCode.toLowerCase().replace(/[\s-_]/g, '')) : undefined);

          if (!matched) {
            const parsed = parseBlackboardCourseString(task.title || task.courseName || task.courseId);
            if (parsed.code) {
              matched = coursesMap.get(parsed.code.toLowerCase().replace(/[\s-_]/g, ''));
              if (!matched) {
                return {
                  ...task,
                  courseCode: parsed.code,
                  courseName: parsed.name || parsed.code
                };
              }
            }
          }

          if (matched) {
            return {
              ...task,
              courseCode: matched.code,
              courseName: matched.name
            };
          }
          return task;
        });

        // Upsert tasks into local storage (deduplication)
        const { added, updated } = await StorageService.upsertTasks(fetchedTasks);

        // Extract any newly discovered courses and update course list
        const extractedCourses = BlackboardApiService.extractCoursesFromTasks(fetchedTasks);
        if (extractedCourses.length > 0) {
          await StorageService.upsertCourses(extractedCourses);
        }

        // Update settings lastSyncTime
        settings.lastSyncTime = new Date().toISOString();
        await StorageService.saveSettings(settings);

        const allTasks = await StorageService.getTasks();
        await StorageService.updateExtensionBadge(allTasks);

        return {
          success: true,
          tasksCount: allTasks.length,
          added,
          updated,
          source: extractionSource
        };
      }

      const allTasks = await StorageService.getTasks();
      return {
        success: true,
        tasksCount: allTasks.length,
        added: 0,
        updated: 0,
        source: extractionSource
      };
    } catch (err: any) {
      return {
        success: false,
        tasksCount: (await StorageService.getTasks()).length,
        added: 0,
        updated: 0,
        source: extractionSource,
        error: err?.message || 'Sync failed'
      };
    }
  },

  /**
   * Queries active Blackboard browser tabs for DOM-scraped items
   */
  async queryActiveTabDomScraper(): Promise<Task[] | null> {
    if (typeof chrome === 'undefined' || !chrome.tabs?.query) {
      return null;
    }

    try {
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tabs || tabs.length === 0) return null;
      const activeTab = tabs[0];
      const tabId = activeTab.id;
      if (typeof tabId !== 'number') return null;

      const response = await chrome.tabs.sendMessage(tabId, {
        type: 'SCRAPE_PAGE_DOM'
      }) as { success?: boolean; tasks?: Task[] } | undefined;

      if (response && response.success && Array.isArray(response.tasks)) {
        return response.tasks;
      }
    } catch {
      // Tab communication failed or tab is not on Blackboard
    }

    return null;
  },

  /**
   * Queries active Blackboard browser tabs for scraped courses
   */
  async queryActiveTabCourses(): Promise<Course[]> {
    if (typeof chrome === 'undefined' || !chrome.tabs?.query) {
      return [];
    }

    try {
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tabs || tabs.length === 0) return [];
      const activeTab = tabs[0];
      const tabId = activeTab.id;
      if (typeof tabId !== 'number') return [];

      const response = (await chrome.tabs.sendMessage(tabId, {
        type: 'SCRAPE_COURSES'
      })) as { success?: boolean; courses?: Course[] } | undefined;

      if (response && response.success && Array.isArray(response.courses)) {
        return response.courses;
      }
    } catch {
      // Tab communication failed or tab is not on Blackboard
    }

    return [];
  }
};
