import { Announcement, Course, Task, UserSettings } from '../types/task';
import { DEFAULT_USER_SETTINGS, INITIAL_ANNOUNCEMENTS, INITIAL_COURSES, INITIAL_TASKS } from './mockData';
import { isNumericalOrInternalCode, parseBlackboardCourseString } from './blackboardApi';

const STORAGE_KEYS = {
  TASKS: 'bb_tasksync_tasks',
  COURSES: 'bb_tasksync_courses',
  SETTINGS: 'bb_tasksync_settings',
  INITIALIZED: 'bb_tasksync_initialized',
  DELETED_TASK_IDS: 'bb_tasksync_deleted_task_ids',
  ANNOUNCEMENTS: 'bb_tasksync_announcements',
  READ_ANNOUNCEMENT_IDS: 'bb_tasksync_read_announcements'
} as const;

/**
 * Check if the Chrome Extension storage API is available
 */
const isChromeStorageAvailable = (): boolean => {
  return typeof chrome !== 'undefined' && !!chrome.storage?.local;
};

// Safe fallback for window.localStorage / Node environment
const memoryStore: Record<string, string> = {};

const getLocalItem = (key: string): string | null => {
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      return window.localStorage.getItem(key);
    } catch {}
  }
  if (typeof localStorage !== 'undefined' && localStorage && typeof localStorage.getItem === 'function') {
    try {
      return localStorage.getItem(key);
    } catch {}
  }
  return memoryStore[key] ?? null;
};

const setLocalItem = (key: string, value: string): void => {
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      window.localStorage.setItem(key, value);
      return;
    } catch {}
  }
  if (typeof localStorage !== 'undefined' && localStorage && typeof localStorage.setItem === 'function') {
    try {
      localStorage.setItem(key, value);
      return;
    } catch {}
  }
  memoryStore[key] = value;
};

/**
 * Storage Service - handles local-first persistence with chrome.storage.local
 * and fallback to window.localStorage for standard browser preview
 */
export const StorageService = {
  /**
   * Get all tasks
   */
  async getTasks(): Promise<Task[]> {
    if (isChromeStorageAvailable()) {
      return new Promise((resolve) => {
        chrome.storage.local.get([STORAGE_KEYS.TASKS, STORAGE_KEYS.INITIALIZED], (result) => {
          if (result && result[STORAGE_KEYS.TASKS] !== undefined) {
            resolve(result[STORAGE_KEYS.TASKS]);
          } else if (result && result[STORAGE_KEYS.INITIALIZED]) {
            // Storage has been initialized before, user has 0 tasks
            resolve([]);
          } else {
            // First time initialization with initial seed
            chrome.storage.local.set({ [STORAGE_KEYS.INITIALIZED]: true });
            this.saveTasks(INITIAL_TASKS).then(() => resolve(INITIAL_TASKS));
          }
        });
      });
    } else {
      const isInit = getLocalItem(STORAGE_KEYS.INITIALIZED);
      const data = getLocalItem(STORAGE_KEYS.TASKS);
      if (data !== null) {
        try {
          return JSON.parse(data);
        } catch {
          return [];
        }
      }
      if (isInit) {
        return [];
      }
      setLocalItem(STORAGE_KEYS.INITIALIZED, 'true');
      setLocalItem(STORAGE_KEYS.TASKS, JSON.stringify(INITIAL_TASKS));
      return INITIAL_TASKS;
    }
  },

  /**
   * Overwrite tasks array
   */
  async saveTasks(tasks: Task[]): Promise<void> {
    if (isChromeStorageAvailable()) {
      await new Promise<void>((resolve) => {
        chrome.storage.local.set({ [STORAGE_KEYS.TASKS]: tasks }, () => resolve());
      });
    } else {
      setLocalItem(STORAGE_KEYS.TASKS, JSON.stringify(tasks));
    }
    await this.updateExtensionBadge(tasks);
  },

  /**
   * Get list of deleted task IDs and signatures (tombstones)
   */
  async getDeletedTaskIds(): Promise<string[]> {
    if (isChromeStorageAvailable()) {
      return new Promise((resolve) => {
        chrome.storage.local.get([STORAGE_KEYS.DELETED_TASK_IDS], (result) => {
          resolve(result?.[STORAGE_KEYS.DELETED_TASK_IDS] || []);
        });
      });
    } else {
      const data = getLocalItem(STORAGE_KEYS.DELETED_TASK_IDS);
      if (data) {
        try {
          return JSON.parse(data);
        } catch {
          return [];
        }
      }
      return [];
    }
  },

  /**
   * Save deleted task IDs and signatures
   */
  async saveDeletedTaskIds(ids: string[]): Promise<void> {
    if (isChromeStorageAvailable()) {
      await new Promise<void>((resolve) => {
        chrome.storage.local.set({ [STORAGE_KEYS.DELETED_TASK_IDS]: ids }, () => resolve());
      });
    } else {
      setLocalItem(STORAGE_KEYS.DELETED_TASK_IDS, JSON.stringify(ids));
    }
  },

  /**
   * Clear deleted task tombstones (e.g. on full reset)
   */
  async clearDeletedTaskIds(): Promise<void> {
    await this.saveDeletedTaskIds([]);
  },

  /**
   * Upsert tasks from Blackboard sync while preserving completion flags, custom subtasks,
   * and honoring deleted task tombstones so deleted items never reappear on sync.
   */
  async upsertTasks(newTasks: Task[]): Promise<{ added: number; updated: number }> {
    const existing = await this.getTasks();
    const existingMap = new Map<string, Task>(existing.map((t) => [t.id, t]));
    const deletedList = await this.getDeletedTaskIds();
    const deletedSet = new Set(deletedList.map((id) => id.toLowerCase()));

    let added = 0;
    let updated = 0;

    for (const incoming of newTasks) {
      const idKey = incoming.id.toLowerCase();
      const titleSig = `${incoming.title.trim().toLowerCase()}:::${(incoming.courseCode || incoming.courseId || '').trim().toLowerCase()}`;

      // If user previously deleted this item, DO NOT revive it!
      if (deletedSet.has(idKey) || deletedSet.has(titleSig)) {
        continue;
      }

      if (existingMap.has(incoming.id)) {
        const current = existingMap.get(incoming.id)!;
        // Preserve user completion state and personal modifications
        existingMap.set(incoming.id, {
          ...incoming,
          isCompleted: current.isCompleted || incoming.isCompleted,
          completedAt: current.completedAt || (current.isCompleted ? current.completedAt : incoming.completedAt),
          subtasks: current.subtasks || incoming.subtasks,
          // Preserve custom title/notes if modified
          description: incoming.description || current.description,
          lastSynced: new Date().toISOString()
        });
        updated++;
      } else {
        existingMap.set(incoming.id, {
          ...incoming,
          lastSynced: new Date().toISOString()
        });
        added++;
      }
    }

    const merged = Array.from(existingMap.values());
    await this.saveTasks(merged);
    return { added, updated };
  },

  /**
   * Toggle completion of a task
   */
  async toggleTaskComplete(id: string): Promise<Task | null> {
    const tasks = await this.getTasks();
    let updatedTask: Task | null = null;

    const newTasks = tasks.map((t) => {
      if (t.id === id) {
        const nextCompleted = !t.isCompleted;
        updatedTask = {
          ...t,
          isCompleted: nextCompleted,
          completedAt: nextCompleted ? new Date().toISOString() : undefined
        };
        return updatedTask;
      }
      return t;
    });

    await this.saveTasks(newTasks);
    return updatedTask;
  },

  /**
   * Add a personal/custom task
   */
  async addCustomTask(taskData: Omit<Task, 'id' | 'lastSynced'>): Promise<Task> {
    const tasks = await this.getTasks();
    const newTask: Task = {
      ...taskData,
      id: `custom_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      source: 'MANUAL',
      lastSynced: new Date().toISOString()
    };
    tasks.unshift(newTask);
    await this.saveTasks(tasks);
    return newTask;
  },

  /**
   * Delete a task and record tombstone so it never reappears on sync
   */
  async deleteTask(id: string): Promise<void> {
    const tasks = await this.getTasks();
    const taskToDelete = tasks.find((t) => t.id === id);
    const filtered = tasks.filter((t) => t.id !== id);
    await this.saveTasks(filtered);

    // Record tombstone so future syncs do not resurrect this task
    const deletedList = await this.getDeletedTaskIds();
    const idSet = new Set(deletedList);
    idSet.add(id);
    idSet.add(id.toLowerCase());

    if (taskToDelete) {
      const titleSig = `${taskToDelete.title.trim().toLowerCase()}:::${(taskToDelete.courseCode || taskToDelete.courseId || '').trim().toLowerCase()}`;
      idSet.add(titleSig);
    }

    await this.saveDeletedTaskIds(Array.from(idSet));
  },

  /**
   * Toggle subtask completion
   */
  async toggleSubTask(taskId: string, subTaskId: string): Promise<void> {
    const tasks = await this.getTasks();
    const updated = tasks.map((t) => {
      if (t.id === taskId && t.subtasks) {
        const updatedSubs = t.subtasks.map((s) =>
          s.id === subTaskId ? { ...s, completed: !s.completed } : s
        );
        return { ...t, subtasks: updatedSubs };
      }
      return t;
    });
    await this.saveTasks(updated);
  },

  /**
   * Add a subtask to an existing task
   */
  async addSubTask(taskId: string, title: string): Promise<void> {
    const tasks = await this.getTasks();
    const updated = tasks.map((t) => {
      if (t.id === taskId) {
        const currentSubs = t.subtasks || [];
        const newSub = {
          id: `sub_${Date.now()}_${Math.random().toString(36).substring(2, 5)}`,
          title,
          completed: false
        };
        return { ...t, subtasks: [...currentSubs, newSub] };
      }
      return t;
    });
    await this.saveTasks(updated);
  },

  /**
   * Get all courses
   */
  async getCourses(): Promise<Course[]> {
    if (isChromeStorageAvailable()) {
      return new Promise((resolve) => {
        chrome.storage.local.get([STORAGE_KEYS.COURSES], (result) => {
          if (result && result[STORAGE_KEYS.COURSES]) {
            resolve(result[STORAGE_KEYS.COURSES]);
          } else {
            this.saveCourses(INITIAL_COURSES).then(() => resolve(INITIAL_COURSES));
          }
        });
      });
    } else {
      const data = getLocalItem(STORAGE_KEYS.COURSES);
      if (data) {
        try {
          return JSON.parse(data);
        } catch {
          return INITIAL_COURSES;
        }
      }
      setLocalItem(STORAGE_KEYS.COURSES, JSON.stringify(INITIAL_COURSES));
      return INITIAL_COURSES;
    }
  },

  /**
   * Save courses
   */
  async saveCourses(courses: Course[]): Promise<void> {
    if (isChromeStorageAvailable()) {
      await new Promise<void>((resolve) => {
        chrome.storage.local.set({ [STORAGE_KEYS.COURSES]: courses }, () => resolve());
      });
    } else {
      setLocalItem(STORAGE_KEYS.COURSES, JSON.stringify(courses));
    }
  },

  /**
   * Upsert courses and fix existing tasks if they have 'Course' or numerical codes
   */
  async upsertCourses(newCourses: Course[]): Promise<void> {
    if (!newCourses || newCourses.length === 0) return;
    const currentCourses = await this.getCourses();
    const map = new Map<string, Course>(currentCourses.map((c) => [c.id, c]));

    newCourses.forEach((c) => {
      const existing = map.get(c.id);
      if (!existing) {
        map.set(c.id, c);
      } else {
        const existingHasCleanName =
          existing.name && !isNumericalOrInternalCode(existing.name) && existing.name !== 'Course';
        const newHasCleanName =
          c.name && !isNumericalOrInternalCode(c.name) && c.name !== 'Course';

        // Prefer full title: e.g. "261-SWE-387-01(Software Project Management)" over short name or code
        const isBetterName =
          !existingHasCleanName ||
          (newHasCleanName && (c.name.includes('(') || c.name.length > (existing.name?.length || 0)));

        map.set(c.id, {
          ...existing,
          code: c.code && !isNumericalOrInternalCode(c.code) && c.code !== 'Course' ? c.code : existing.code,
          name: isBetterName && newHasCleanName ? c.name : existing.name,
          term: c.term || existing.term
        });
      }
    });

    const merged = Array.from(map.values());
    await this.saveCourses(merged);

    // Self-healing: Update any tasks in storage that currently say 'Course' or have short names
    const tasks = await this.getTasks();
    let tasksUpdated = false;

    const normalizedMap = new Map<string, Course>();
    merged.forEach((c) => {
      normalizedMap.set(c.id, c);
      if (c.code) {
        normalizedMap.set(c.code.toLowerCase().replace(/[\s-_]/g, ''), c);
      }
    });

    const fixedTasks = tasks.map((t) => {
      const parsedTitle = t.title ? parseBlackboardCourseString(t.title) : undefined;
      const matched =
        normalizedMap.get(t.courseId) ||
        (t.courseCode ? normalizedMap.get(t.courseCode.toLowerCase().replace(/[\s-_]/g, '')) : undefined) ||
        (parsedTitle?.code ? normalizedMap.get(parsedTitle.code.toLowerCase().replace(/[\s-_]/g, '')) : undefined);

      if (matched) {
        const needsCodeFix = !t.courseCode || t.courseCode === 'Course' || isNumericalOrInternalCode(t.courseCode);
        const needsNameFix =
          !t.courseName ||
          t.courseName === 'Course' ||
          isNumericalOrInternalCode(t.courseName) ||
          (matched.name && matched.name !== t.courseName && matched.name.includes('('));
        if (needsCodeFix || needsNameFix) {
          tasksUpdated = true;
          return {
            ...t,
            courseCode: matched.code || t.courseCode,
            courseName: matched.name || t.courseName
          };
        }
      }
      return t;
    });

    if (tasksUpdated) {
      await this.saveTasks(fixedTasks);
    }
  },

  /**
   * Get user settings
   */
  async getSettings(): Promise<UserSettings> {
    if (isChromeStorageAvailable()) {
      return new Promise((resolve) => {
        chrome.storage.local.get([STORAGE_KEYS.SETTINGS], (result) => {
          if (result && result[STORAGE_KEYS.SETTINGS]) {
            resolve({ ...DEFAULT_USER_SETTINGS, ...result[STORAGE_KEYS.SETTINGS] });
          } else {
            this.saveSettings(DEFAULT_USER_SETTINGS).then(() => resolve(DEFAULT_USER_SETTINGS));
          }
        });
      });
    } else {
      const data = getLocalItem(STORAGE_KEYS.SETTINGS);
      if (data) {
        try {
          return { ...DEFAULT_USER_SETTINGS, ...JSON.parse(data) };
        } catch {
          return DEFAULT_USER_SETTINGS;
        }
      }
      setLocalItem(STORAGE_KEYS.SETTINGS, JSON.stringify(DEFAULT_USER_SETTINGS));
      return DEFAULT_USER_SETTINGS;
    }
  },

  /**
   * Save user settings
   */
  async saveSettings(settings: UserSettings): Promise<void> {
    if (isChromeStorageAvailable()) {
      await new Promise<void>((resolve) => {
        chrome.storage.local.set({ [STORAGE_KEYS.SETTINGS]: settings }, () => resolve());
      });
    } else {
      setLocalItem(STORAGE_KEYS.SETTINGS, JSON.stringify(settings));
    }
  },

  /**
   * Get all announcements
   */
  async getAnnouncements(): Promise<Announcement[]> {
    const readIds = await this.getReadAnnouncementIds();
    const readSet = new Set(readIds);

    const enrichWithRead = (announcements: Announcement[]): Announcement[] => {
      return announcements.map((a) => ({
        ...a,
        isRead: a.isRead || readSet.has(a.id)
      }));
    };

    if (isChromeStorageAvailable()) {
      return new Promise((resolve) => {
        chrome.storage.local.get([STORAGE_KEYS.ANNOUNCEMENTS, STORAGE_KEYS.INITIALIZED], (result) => {
          if (result && result[STORAGE_KEYS.ANNOUNCEMENTS] !== undefined) {
            resolve(enrichWithRead(result[STORAGE_KEYS.ANNOUNCEMENTS]));
          } else if (result && result[STORAGE_KEYS.INITIALIZED]) {
            resolve([]);
          } else {
            chrome.storage.local.set({ [STORAGE_KEYS.INITIALIZED]: true });
            this.saveAnnouncements(INITIAL_ANNOUNCEMENTS).then(() =>
              resolve(enrichWithRead(INITIAL_ANNOUNCEMENTS))
            );
          }
        });
      });
    } else {
      const isInit = getLocalItem(STORAGE_KEYS.INITIALIZED);
      const data = getLocalItem(STORAGE_KEYS.ANNOUNCEMENTS);
      if (data !== null) {
        try {
          return enrichWithRead(JSON.parse(data));
        } catch {
          return [];
        }
      }
      if (isInit) {
        return [];
      }
      setLocalItem(STORAGE_KEYS.INITIALIZED, 'true');
      setLocalItem(STORAGE_KEYS.ANNOUNCEMENTS, JSON.stringify(INITIAL_ANNOUNCEMENTS));
      return enrichWithRead(INITIAL_ANNOUNCEMENTS);
    }
  },

  /**
   * Save announcements
   */
  async saveAnnouncements(announcements: Announcement[]): Promise<void> {
    if (isChromeStorageAvailable()) {
      await new Promise<void>((resolve) => {
        chrome.storage.local.set({ [STORAGE_KEYS.ANNOUNCEMENTS]: announcements }, () => resolve());
      });
    } else {
      setLocalItem(STORAGE_KEYS.ANNOUNCEMENTS, JSON.stringify(announcements));
    }
  },

  /**
   * Get read announcement IDs
   */
  async getReadAnnouncementIds(): Promise<string[]> {
    if (isChromeStorageAvailable()) {
      return new Promise((resolve) => {
        chrome.storage.local.get([STORAGE_KEYS.READ_ANNOUNCEMENT_IDS], (result) => {
          resolve(result?.[STORAGE_KEYS.READ_ANNOUNCEMENT_IDS] || []);
        });
      });
    } else {
      const data = getLocalItem(STORAGE_KEYS.READ_ANNOUNCEMENT_IDS);
      if (data) {
        try {
          return JSON.parse(data);
        } catch {
          return [];
        }
      }
      return [];
    }
  },

  /**
   * Save read announcement IDs
   */
  async saveReadAnnouncementIds(ids: string[]): Promise<void> {
    if (isChromeStorageAvailable()) {
      await new Promise<void>((resolve) => {
        chrome.storage.local.set({ [STORAGE_KEYS.READ_ANNOUNCEMENT_IDS]: ids }, () => resolve());
      });
    } else {
      setLocalItem(STORAGE_KEYS.READ_ANNOUNCEMENT_IDS, JSON.stringify(ids));
    }
  },

  /**
   * Upsert incoming announcements while preserving read state
   */
  async upsertAnnouncements(incomingList: Announcement[]): Promise<{ added: number; updated: number }> {
    const existing = await this.getAnnouncements();
    const existingMap = new Map<string, Announcement>(existing.map((a) => [a.id, a]));
    const readIds = await this.getReadAnnouncementIds();
    const readSet = new Set(readIds);

    let added = 0;
    let updated = 0;

    for (const incoming of incomingList) {
      const isAlreadyRead = readSet.has(incoming.id) || (existingMap.has(incoming.id) && existingMap.get(incoming.id)!.isRead);

      if (existingMap.has(incoming.id)) {
        existingMap.set(incoming.id, {
          ...incoming,
          isRead: isAlreadyRead,
          lastSynced: new Date().toISOString()
        });
        updated++;
      } else {
        existingMap.set(incoming.id, {
          ...incoming,
          isRead: isAlreadyRead,
          lastSynced: new Date().toISOString()
        });
        added++;
      }
    }

    const merged = Array.from(existingMap.values()).sort(
      (a, b) => new Date(b.created).getTime() - new Date(a.created).getTime()
    );

    await this.saveAnnouncements(merged);
    return { added, updated };
  },

  /**
   * Mark single announcement as read / unread
   */
  async markAnnouncementRead(id: string, isRead = true): Promise<void> {
    const announcements = await this.getAnnouncements();
    const updated = announcements.map((a) => (a.id === id ? { ...a, isRead } : a));
    await this.saveAnnouncements(updated);

    const readIds = await this.getReadAnnouncementIds();
    const readSet = new Set(readIds);
    if (isRead) {
      readSet.add(id);
    } else {
      readSet.delete(id);
    }
    await this.saveReadAnnouncementIds(Array.from(readSet));
  },

  /**
   * Mark all announcements as read
   */
  async markAllAnnouncementsRead(): Promise<void> {
    const announcements = await this.getAnnouncements();
    const updated = announcements.map((a) => ({ ...a, isRead: true }));
    await this.saveAnnouncements(updated);

    const allIds = announcements.map((a) => a.id);
    await this.saveReadAnnouncementIds(allIds);
  },

  /**
   * Removes initial sample demo announcements when user switches to real mode
   */
  async removeDemoAnnouncements(): Promise<void> {
    const announcements = await this.getAnnouncements();
    const demoIds = new Set(INITIAL_ANNOUNCEMENTS.map((a) => a.id));
    const remaining = announcements.filter((a) => !demoIds.has(a.id));
    await this.saveAnnouncements(remaining);
  },

  /**
   * Restores initial sample demo announcements when user turns demo mode back on
   */
  async restoreDemoAnnouncements(): Promise<void> {
    await this.saveAnnouncements(INITIAL_ANNOUNCEMENTS);
  },

  /**
   * Reset data to initial mock state (useful for demo & testing)
   */
  async resetToMockData(): Promise<void> {
    await this.saveTasks(INITIAL_TASKS);
    await this.saveCourses(INITIAL_COURSES);
    await this.saveAnnouncements(INITIAL_ANNOUNCEMENTS);
    await this.saveReadAnnouncementIds([]);
    await this.saveSettings(DEFAULT_USER_SETTINGS);
  },

  /**
   * Clear all stored tasks, courses, and announcements (keeps settings and sets isDemoMode: false)
   */
  async clearAllData(): Promise<void> {
    const settings = await this.getSettings();
    settings.isDemoMode = false;
    await this.saveTasks([]);
    await this.saveCourses([]);
    await this.saveAnnouncements([]);
    await this.saveReadAnnouncementIds([]);
    await this.saveSettings(settings);

    if (isChromeStorageAvailable()) {
      await new Promise<void>((resolve) => {
        chrome.storage.local.set(
          {
            [STORAGE_KEYS.TASKS]: [],
            [STORAGE_KEYS.COURSES]: [],
            [STORAGE_KEYS.ANNOUNCEMENTS]: [],
            [STORAGE_KEYS.READ_ANNOUNCEMENT_IDS]: [],
            [STORAGE_KEYS.SETTINGS]: settings,
            [STORAGE_KEYS.DELETED_TASK_IDS]: [],
            [STORAGE_KEYS.INITIALIZED]: true
          },
          () => resolve()
        );
      });
    } else {
      setLocalItem(STORAGE_KEYS.TASKS, JSON.stringify([]));
      setLocalItem(STORAGE_KEYS.COURSES, JSON.stringify([]));
      setLocalItem(STORAGE_KEYS.ANNOUNCEMENTS, JSON.stringify([]));
      setLocalItem(STORAGE_KEYS.READ_ANNOUNCEMENT_IDS, JSON.stringify([]));
      setLocalItem(STORAGE_KEYS.SETTINGS, JSON.stringify(settings));
      setLocalItem(STORAGE_KEYS.DELETED_TASK_IDS, JSON.stringify([]));
      setLocalItem(STORAGE_KEYS.INITIALIZED, 'true');
    }
    await this.updateExtensionBadge([]);
  },

  /**
   * Removes initial sample demo tasks when user switches to real mode
   */
  async removeDemoTasks(): Promise<void> {
    const tasks = await this.getTasks();
    const demoIds = new Set(INITIAL_TASKS.map((t) => t.id));
    const remaining = tasks.filter((t) => !demoIds.has(t.id));
    await this.saveTasks(remaining);

    // Filter courses as well
    const remainingCourseIds = new Set(remaining.map((t) => t.courseId));
    const courses = await this.getCourses();
    const remainingCourses = courses.filter((c) => remainingCourseIds.has(c.id));
    await this.saveCourses(remainingCourses);

    // Also remove demo announcements
    await this.removeDemoAnnouncements();
  },

  /**
   * Restores initial sample demo tasks when user turns demo mode back on
   */
  async restoreDemoTasks(): Promise<void> {
    await this.saveTasks(INITIAL_TASKS);
    await this.saveCourses(INITIAL_COURSES);
    await this.restoreDemoAnnouncements();
  },

  /**
   * Updates the extension action icon badge counter showing incomplete tasks due within 24h
   */
  async updateExtensionBadge(tasks?: Task[]): Promise<void> {
    try {
      const allTasks = tasks || (await this.getTasks());
      const now = new Date().getTime();
      const in24h = now + 24 * 60 * 60 * 1000;

      // Count uncompleted tasks overdue or due in next 24 hours
      const urgentCount = allTasks.filter((t) => {
        if (t.isCompleted) return false;
        const due = new Date(t.dueDate).getTime();
        return due <= in24h;
      }).length;

      if (typeof chrome !== 'undefined' && chrome.action?.setBadgeText) {
        const text = urgentCount > 0 ? String(urgentCount) : '';
        await chrome.action.setBadgeText({ text });
        if (urgentCount > 0 && chrome.action.setBadgeBackgroundColor) {
          await chrome.action.setBadgeBackgroundColor({ color: '#EF4444' });
        }
      }
    } catch {
      // Chrome extension API not available or tab restricted
    }
  }
};
