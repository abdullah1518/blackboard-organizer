/**
 * Blackboard Learn Ultra & Original API & Scraping Types
 */

export interface BbCalendarItem {
  id: string;
  calendarId: string;
  calendarName?: string;
  type?: string; // 'Assignment' | 'Test' | 'Discussion' | 'Personal'
  title: string;
  description?: string;
  start?: string;
  end: string; // Due date
  courseId?: string;
  courseName?: string;
  created?: string;
  modified?: string;
  dynamicCalendarItemProps?: {
    attemptable?: boolean;
    callableUrl?: string;
    gradebookColumnId?: string;
  };
}

export interface BbCalendarItemsResponse {
  results: BbCalendarItem[];
  paging?: {
    nextPage?: string;
  };
}

export interface BbCourseMembership {
  id: string;
  userId: string;
  courseId: string;
  course?: {
    id: string;
    courseId: string; // e.g. CS301_FALL26
    name: string;
    description?: string;
  };
}

export interface BbStreamItem {
  id: string;
  courseId?: string;
  courseName?: string;
  itemType?: string;
  title: string;
  dueDate?: string;
  url?: string;
  extraInfo?: string;
}

export interface BbSessionInfo {
  isAuthenticated: boolean;
  institutionDomain?: string;
  userId?: string;
  userName?: string;
  xsrfToken?: string;
  lastChecked: string;
}
