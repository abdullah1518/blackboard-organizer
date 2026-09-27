export interface Announcement {
  id: string;
  courseId: string;
  courseName: string;
  courseCode?: string;
  title: string;
  content: string;
  created: string; // ISO 8601 UTC
  modified?: string;
  author?: string;
  url?: string;
  isRead: boolean;
  lastSynced: string;
}

export interface AnnouncementFilterState {
  search: string;
  selectedCourseId: string | 'ALL';
  unreadOnly: boolean;
}
