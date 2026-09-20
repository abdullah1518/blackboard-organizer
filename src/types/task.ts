export type TaskType = 'ASSIGNMENT' | 'QUIZ_TEST' | 'DISCUSSION' | 'CUSTOM_TASK';

export type TaskSource = 'BLACKBOARD' | 'MANUAL';

export type UrgencyLevel = 'overdue' | 'today' | 'soon' | 'later';

export interface SubTask {
  id: string;
  title: string;
  completed: boolean;
}

export interface Task {
  id: string;
  courseId: string;
  courseName: string;
  courseCode?: string;
  title: string;
  type: TaskType;
  dueDate: string; // ISO 8601 UTC
  url?: string;
  isCompleted: boolean;
  completedAt?: string;
  source: TaskSource;
  lastSynced: string; // ISO 8601 UTC
  description?: string;
  points?: number;
  subtasks?: SubTask[];
}

export interface Course {
  id: string;
  code: string;
  name: string;
  color: string;
  term?: string;
}

export interface UserSettings {
  customBlackboardUrl: string;
  syncIntervalMinutes: number;
  isDemoMode: boolean;
  darkMode: boolean;
  defaultAlarm: 'none' | '2h' | '24h' | 'both';
  lastSyncTime?: string;
  autoSyncOnVisit: boolean;
  separateFilesPerCourse: boolean;
}

export interface TaskFilterState {
  search: string;
  selectedCourseId: string | 'ALL';
  selectedType: TaskType | 'ALL';
  urgencyFilter: UrgencyLevel | 'ALL';
  hideCompleted: boolean;
}
