import { Course, Task, UserSettings } from '../types/task';
import { DEFAULT_USER_SETTINGS, INITIAL_COURSES, INITIAL_TASKS } from './mockData';
import { isNumericalOrInternalCode, parseBlackboardCourseString } from './blackboardApi';

const STORAGE_KEYS = {
  TASKS: 'bb_tasksync_tasks',
  COURSES: 'bb_tasksync_courses',
  SETTINGS: 'bb_tasksync_settings',
  INITIALIZED: 'bb_tasksync_initialized'
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
   * Upsert tasks from Blackboard sync while preserving completion flags and custom subtasks
   */
  async upsertTasks(newTasks: Task[]): Promise<{ added: number; updated: number }> {
    const existing = await this.getTasks();
    const existingMap = new Map<string, Task>(existing.map((t) => [t.id, t]));
    let added = 0;
    let updated = 0;

    for (const incoming of newTasks) {
      if (existingMap.has(incoming.id)) {
        const current = existingMap.get(incoming.id)!;
        // Preserve user completion state and personal modifications
        existingMap.set(incoming.id, {
          ...incoming,
          isCompleted: current.isCompleted,
          completedAt: current.completedAt,
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
   * Delete a task
   */
  async deleteTask(id: string): Promise<void> {
    const tasks = await this.getTasks();
    const filtered = tasks.filter((t) => t.id !== id);
    await this.saveTasks(filtered);
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
      } else if (
        isNumericalOrInternalCode(existing.name) ||
        existing.name === 'Course' ||
        isNumericalOrInternalCode(existing.code) ||
        existing.code === 'Course'
      ) {
        map.set(c.id, {
          ...existing,
          code: !isNumericalOrInternalCode(c.code) && c.code !== 'Course' ? c.code : existing.code,
          name: !isNumericalOrInternalCode(c.name) && c.name !== 'Course' ? c.name : existing.name
        });
      }
    });

    const merged = Array.from(map.values());
    await this.saveCourses(merged);

    // Self-healing: Update any tasks in storage that currently say 'Course'
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
        const needsNameFix = !t.courseName || t.courseName === 'Course' || isNumericalOrInternalCode(t.courseName);
        if (needsCodeFix || needsNameFix) {
          tasksUpdated = true;
          return {
            ...t,
            courseCode: matched.code,
            courseName: matched.name
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
   * Reset data to initial mock state (useful for demo & testing)
   */
  async resetToMockData(): Promise<void> {
    await this.saveTasks(INITIAL_TASKS);
    await this.saveCourses(INITIAL_COURSES);
    await this.saveSettings(DEFAULT_USER_SETTINGS);
  },

  /**
   * Clear all stored tasks and courses (keeps settings and sets isDemoMode: false)
   */
  async clearAllData(): Promise<void> {
    const settings = await this.getSettings();
    settings.isDemoMode = false;
    await this.saveTasks([]);
    await this.saveCourses([]);
    await this.saveSettings(settings);

    if (isChromeStorageAvailable()) {
      await new Promise<void>((resolve) => {
        chrome.storage.local.set(
          {
            [STORAGE_KEYS.TASKS]: [],
            [STORAGE_KEYS.COURSES]: [],
            [STORAGE_KEYS.SETTINGS]: settings,
            [STORAGE_KEYS.INITIALIZED]: true
          },
          () => resolve()
        );
      });
    } else {
      setLocalItem(STORAGE_KEYS.TASKS, JSON.stringify([]));
      setLocalItem(STORAGE_KEYS.COURSES, JSON.stringify([]));
      setLocalItem(STORAGE_KEYS.SETTINGS, JSON.stringify(settings));
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
  },

  /**
   * Restores initial sample demo tasks when user turns demo mode back on
   */
  async restoreDemoTasks(): Promise<void> {
    await this.saveTasks(INITIAL_TASKS);
    await this.saveCourses(INITIAL_COURSES);
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
