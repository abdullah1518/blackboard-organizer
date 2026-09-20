import { BlackboardApiService } from '../services/blackboardApi';
import { StorageService } from '../services/storage';
import { Task } from '../types/task';

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
      // 1. Try Primary: Blackboard Learn Ultra REST API
      try {
        fetchedTasks = await BlackboardApiService.fetchUltraCalendarItems(targetUrl);
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
        // Upsert tasks into local storage (deduplication)
        const { added, updated } = await StorageService.upsertTasks(fetchedTasks);

        // Extract courses and update course list
        const extractedCourses = BlackboardApiService.extractCoursesFromTasks(fetchedTasks);
        if (extractedCourses.length > 0) {
          const currentCourses = await StorageService.getCourses();
          const currentMap = new Map(currentCourses.map((c) => [c.id, c]));
          extractedCourses.forEach((c) => {
            if (!currentMap.has(c.id)) {
              currentCourses.push(c);
            }
          });
          await StorageService.saveCourses(currentCourses);
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
  }
};
