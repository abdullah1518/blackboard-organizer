import React, { useState } from 'react';
import {
  Search,
  X,
  CheckCheck,
  Megaphone
} from 'lucide-react';
import { Announcement, Course } from '../types/task';
import { AnnouncementCard } from './AnnouncementCard';
import { getDisplayCourseName } from './TaskItem';

interface AnnouncementsViewProps {
  announcements: Announcement[];
  courses: Course[];
  onToggleRead: (id: string, isRead: boolean) => void;
  onMarkAllRead: () => void;
  compact?: boolean;
}

export const AnnouncementsView: React.FC<AnnouncementsViewProps> = ({
  announcements,
  courses,
  onToggleRead,
  onMarkAllRead,
  compact = false
}) => {
  const [search, setSearch] = useState('');
  const [selectedCourseId, setSelectedCourseId] = useState<string | 'ALL'>('ALL');
  const [unreadOnly, setUnreadOnly] = useState(false);

  // Map courses by ID for quick color/metadata access
  const courseMap = new Map<string, Course>();
  courses.forEach((c) => {
    courseMap.set(c.id, c);
    if (c.code) {
      courseMap.set(c.code.toLowerCase(), c);
      courseMap.set(c.code.toLowerCase().replace(/[\s-_]/g, ''), c);
    }
  });

  // Filter announcements
  const filtered = announcements.filter((a) => {
    if (unreadOnly && a.isRead) return false;
    if (selectedCourseId !== 'ALL' && a.courseId !== selectedCourseId) {
      // Check if course code matches as well
      const courseObj = courseMap.get(selectedCourseId);
      if (!courseObj || (a.courseCode !== courseObj.code && a.courseId !== courseObj.id)) {
        return false;
      }
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      const qCompact = q.replace(/[\s-_]/g, '');
      const matchTitle = a.title.toLowerCase().includes(q);
      const matchContent = a.content.toLowerCase().includes(q);
      const matchCourse = (a.courseName || '').toLowerCase().includes(q);
      const matchCode = (a.courseCode || '').toLowerCase().includes(q);
      const matchCompactCode = (a.courseCode || '')
        .toLowerCase()
        .replace(/[\s-_]/g, '')
        .includes(qCompact);
      const matchAuthor = (a.author || '').toLowerCase().includes(q);

      if (!matchTitle && !matchContent && !matchCourse && !matchCode && !matchCompactCode && !matchAuthor) {
        return false;
      }
    }
    return true;
  });

  const unreadCount = announcements.filter((a) => !a.isRead).length;

  return (
    <div className="flex flex-col h-full space-y-3.5">
      {/* Top Banner & Quick Controls */}
      <div className="flex items-center justify-between gap-2 px-1">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-slate-300">
            {filtered.length} {filtered.length === 1 ? 'Announcement' : 'Announcements'}
          </span>
          {unreadCount > 0 && (
            <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-sky-500/20 text-sky-300 border border-sky-500/30 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-sky-400 animate-pulse" />
              {unreadCount} unread
            </span>
          )}
        </div>

        {unreadCount > 0 && (
          <button
            type="button"
            onClick={onMarkAllRead}
            className="text-[11px] font-medium text-slate-400 hover:text-sky-300 flex items-center gap-1 transition-colors px-2 py-1 rounded-lg hover:bg-slate-800/80 border border-transparent hover:border-slate-700/60"
            title="Mark all announcements as read"
          >
            <CheckCheck className="w-3.5 h-3.5 text-sky-400" />
            <span>Mark all as read</span>
          </button>
        )}
      </div>

      {/* Search Input */}
      <div className="relative">
        <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search announcements, professors, keywords..."
          className="w-full pl-8.5 pr-8 py-1.5 text-xs bg-slate-900/90 border border-slate-700/80 rounded-xl text-slate-200 placeholder-slate-500 focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500 transition-all"
        />
        {search && (
          <button
            type="button"
            onClick={() => setSearch('')}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 p-0.5"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Course Filter Pills & Unread Toggle */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs no-scrollbar">
        {/* All Courses Pill */}
        <button
          type="button"
          onClick={() => setSelectedCourseId('ALL')}
          className={`flex-shrink-0 px-2.5 py-1 rounded-lg font-medium text-[11px] transition-all ${
            selectedCourseId === 'ALL'
              ? 'bg-sky-600 text-white shadow-sm'
              : 'bg-slate-800/80 text-slate-400 hover:text-slate-200 hover:bg-slate-850 border border-slate-700/60'
          }`}
        >
          All Courses
        </button>

        {/* Unread Only Pill */}
        <button
          type="button"
          onClick={() => setUnreadOnly(!unreadOnly)}
          className={`flex-shrink-0 px-2.5 py-1 rounded-lg font-medium text-[11px] flex items-center gap-1 transition-all ${
            unreadOnly
              ? 'bg-indigo-600 text-white shadow-sm'
              : 'bg-slate-800/80 text-slate-400 hover:text-slate-200 hover:bg-slate-850 border border-slate-700/60'
          }`}
        >
          <span className="w-1.5 h-1.5 rounded-full bg-sky-400" />
          <span>Unread Only</span>
        </button>

        {/* Individual Course Pills */}
        {courses.map((course) => {
          const isSelected = selectedCourseId === course.id;
          const courseColor = course.color || '#38BDF8';
          const displayName = getDisplayCourseName(course);

          return (
            <button
              key={course.id}
              type="button"
              onClick={() => setSelectedCourseId(isSelected ? 'ALL' : course.id)}
              className={`flex-shrink-0 flex items-center gap-1.5 px-2.5 py-1 rounded-lg font-medium text-[11px] transition-all border ${
                isSelected
                  ? 'border-transparent shadow-sm'
                  : 'bg-slate-800/80 text-slate-400 hover:text-slate-200 border-slate-700/60'
              }`}
              style={{
                backgroundColor: isSelected ? courseColor : undefined,
                color: isSelected ? '#ffffff' : undefined
              }}
              title={course.name}
            >
              <span
                className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                style={{
                  backgroundColor: isSelected ? '#ffffff' : courseColor
                }}
              />
              <span className="truncate max-w-[120px]">{displayName}</span>
            </button>
          );
        })}
      </div>

      {/* Announcements Stream */}
      <div className="flex-1 space-y-3 overflow-y-auto pr-0.5">
        {filtered.length > 0 ? (
          filtered.map((announcement) => {
            const matchedCourse =
              courseMap.get(announcement.courseId) ||
              (announcement.courseCode
                ? courseMap.get(announcement.courseCode.toLowerCase().replace(/[\s-_]/g, ''))
                : undefined);

            return (
              <AnnouncementCard
                key={announcement.id}
                announcement={announcement}
                course={matchedCourse}
                onToggleRead={onToggleRead}
                compact={compact}
              />
            );
          })
        ) : (
          <div className="py-12 px-4 text-center rounded-2xl border border-dashed border-slate-800 bg-slate-900/30">
            <div className="w-12 h-12 mx-auto rounded-2xl bg-sky-500/10 border border-sky-500/20 flex items-center justify-center text-sky-400 mb-3">
              <Megaphone className="w-6 h-6" />
            </div>
            <h3 className="text-sm font-semibold text-slate-200 mb-1">
              {announcements.length === 0
                ? 'No announcements yet'
                : 'No matching announcements'}
            </h3>
            <p className="text-xs text-slate-400 max-w-xs mx-auto leading-relaxed">
              {announcements.length === 0
                ? 'Sync with Blackboard to fetch the latest announcements and updates from your courses.'
                : 'Try adjusting your search keywords or course filters to find what you are looking for.'}
            </p>
            {announcements.length > 0 && (search || selectedCourseId !== 'ALL' || unreadOnly) && (
              <button
                type="button"
                onClick={() => {
                  setSearch('');
                  setSelectedCourseId('ALL');
                  setUnreadOnly(false);
                }}
                className="mt-3.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-sky-400 text-xs font-medium transition-colors"
              >
                Reset filters
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
