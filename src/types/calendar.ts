import { TaskType } from './task';

export interface CalendarExportOptions {
  scope: 'all' | 'pending' | 'selected_courses';
  selectedCourseIds?: string[];
  includedTypes: TaskType[];
  reminders: {
    enable24h: boolean;
    enable2h: boolean;
    enable1h: boolean;
  };
  separateFilesPerCourse: boolean;
  filenamePrefix?: string;
}

export interface GeneratedCalendarFile {
  filename: string;
  content: string;
  courseName?: string;
  itemCount: number;
}
