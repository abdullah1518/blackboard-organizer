import { Course, Task, UserSettings } from '../types/task';
import { DEFAULT_USER_SETTINGS, INITIAL_COURSES, INITIAL_TASKS } from './mockData';

const STORAGE_KEYS = {
  TASKS: 'bb_tasksync_tasks',
  COURSES: 'bb_tasksync_courses',
  SETTINGS: 'bb_tasksync_settings'
} as const;

/**
 * Check if the Chrome Extension storage API is available
 */
const isChromeStorageAvailable = (): boolean => {
  return typeof chrome !== 'undefined' && !!chrome.storage?.local;
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
        chrome.storage.local.get([STORAGE_KEYS.TASKS], (result) => {
          if (result && result[STORAGE_KEYS.TASKS]) {
            resolve(result[STORAGE_KEYS.TASKS]);
          } else {
            // First time initialization with initial seed
            this.saveTasks(INITIAL_TASKS).then(() => resolve(INITIAL_TASKS));
          }
        });
      });
    } else {
      const data = localStorage.getItem(STORAGE_KEYS.TASKS);
      if (data) {
        try {
          return JSON.parse(data);
        } catch {
          return INITIAL_TASKS;
        }
      }
      localStorage.setItem(STORAGE_KEYS.TASKS, JSON.stringify(INITIAL_TASKS));
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
      localStorage.setItem(STORAGE_KEYS.TASKS, JSON.stringify(tasks));
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
      const data = localStorage.getItem(STORAGE_KEYS.COURSES);
      if (data) {
        try {
          return JSON.parse(data);
        } catch {
          return INITIAL_COURSES;
        }
      }
      localStorage.setItem(STORAGE_KEYS.COURSES, JSON.stringify(INITIAL_COURSES));
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
      localStorage.setItem(STORAGE_KEYS.COURSES, JSON.stringify(courses));
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
      const data = localStorage.getItem(STORAGE_KEYS.SETTINGS);
      if (data) {
        try {
          return { ...DEFAULT_USER_SETTINGS, ...JSON.parse(data) };
        } catch {
          return DEFAULT_USER_SETTINGS;
        }
      }
      localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(DEFAULT_USER_SETTINGS));
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
      localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(settings));
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
   * Clear all stored data
   */
  async clearAllData(): Promise<void> {
    if (isChromeStorageAvailable()) {
      await new Promise<void>((resolve) => {
        chrome.storage.local.remove(
          [STORAGE_KEYS.TASKS, STORAGE_KEYS.COURSES, STORAGE_KEYS.SETTINGS],
          () => resolve()
        );
      });
    } else {
      localStorage.removeItem(STORAGE_KEYS.TASKS);
      localStorage.removeItem(STORAGE_KEYS.COURSES);
      localStorage.removeItem(STORAGE_KEYS.SETTINGS);
    }
    await this.updateExtensionBadge([]);
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
