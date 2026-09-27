import React, { useState } from 'react';
import {
  ExternalLink,
  Clock,
  User,
  ChevronDown,
  ChevronUp,
  Check,
  Copy,
  CheckCheck
} from 'lucide-react';
import { Announcement, Course } from '../types/task';
import { getDisplayCourseName, getDisplayCourseTooltip } from './TaskItem';

export function formatAnnouncementDate(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffHours = diffMs / (1000 * 60 * 60);

    if (diffHours < 1) {
      const diffMins = Math.max(1, Math.round(diffMs / (1000 * 60)));
      return `${diffMins}m ago`;
    }
    if (diffHours < 24) {
      return `${Math.round(diffHours)}h ago`;
    }
    if (diffHours < 48) {
      return `Yesterday at ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    }
    return d.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: d.getFullYear() !== now.getFullYear() ? 'numeric' : undefined
    });
  } catch {
    return dateStr;
  }
}

interface AnnouncementCardProps {
  announcement: Announcement;
  course?: Course;
  onToggleRead: (id: string, isRead: boolean) => void;
  compact?: boolean;
}

export const AnnouncementCard: React.FC<AnnouncementCardProps> = ({
  announcement,
  course,
  onToggleRead,
  compact = false
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [copied, setCopied] = useState(false);

  const courseColor = course?.color || '#38BDF8';
  const isLongContent = announcement.content.length > 220;
  const displayContent =
    isLongContent && !isExpanded
      ? announcement.content.slice(0, 220).trim() + '...'
      : announcement.content;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(
        `${announcement.title}\n\n${announcement.content}`
      );
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore
    }
  };

  return (
    <article
      className={`group rounded-xl border transition-all duration-200 relative overflow-hidden ${
        announcement.isRead
          ? 'bg-slate-900/40 border-slate-800/60 opacity-85 hover:opacity-100 hover:border-slate-700/80'
          : 'glass-card border-slate-700/90 shadow-md ring-1 ring-sky-500/20'
      } ${compact ? 'p-3' : 'p-4'}`}
    >
      {/* Unread Accent Glow Indicator */}
      {!announcement.isRead && (
        <span
          className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-sky-400 to-indigo-500 rounded-l"
          title="Unread announcement"
        />
      )}

      {/* Header Row: Course Badge, Date, Unread Toggle */}
      <div className="flex items-center justify-between gap-2 mb-2 text-xs">
        <div className="flex items-center flex-wrap gap-1.5 min-w-0">
          {/* Course Tag */}
          <span
            className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md font-medium text-[11px]"
            style={{
              backgroundColor: `${courseColor}18`,
              color: courseColor,
              border: `1px solid ${courseColor}33`
            }}
            title={getDisplayCourseTooltip(course, {
              courseName: announcement.courseName,
              courseCode: announcement.courseCode,
              courseId: announcement.courseId
            })}
          >
            <span
              className="w-1.5 h-1.5 rounded-full flex-shrink-0"
              style={{ backgroundColor: courseColor }}
            />
            <span className="truncate max-w-[150px]">
              {getDisplayCourseName(course, {
                courseName: announcement.courseName,
                courseCode: announcement.courseCode,
                courseId: announcement.courseId
              })}
            </span>
          </span>

          {/* Timestamp */}
          <span className="inline-flex items-center gap-1 text-[11px] text-slate-400">
            <Clock className="w-3 h-3 text-slate-500" />
            <span>{formatAnnouncementDate(announcement.created)}</span>
          </span>

          {/* Author */}
          {announcement.author && !compact && (
            <span className="inline-flex items-center gap-1 text-[11px] text-slate-400 truncate max-w-[140px]">
              <User className="w-3 h-3 text-slate-500" />
              <span className="truncate">{announcement.author}</span>
            </span>
          )}
        </div>

        {/* Right Actions: Mark as Read/Unread & External Link */}
        <div className="flex items-center gap-1 flex-shrink-0">
          <button
            type="button"
            onClick={() => onToggleRead(announcement.id, !announcement.isRead)}
            className={`px-1.5 py-0.5 rounded text-[10px] font-medium flex items-center gap-1 transition-colors ${
              announcement.isRead
                ? 'text-slate-400 hover:text-sky-300 hover:bg-slate-800'
                : 'text-sky-400 bg-sky-500/10 hover:bg-sky-500/20 border border-sky-500/20'
            }`}
            title={announcement.isRead ? 'Mark as unread' : 'Mark as read'}
          >
            {announcement.isRead ? (
              <Check className="w-3 h-3" />
            ) : (
              <span className="w-1.5 h-1.5 rounded-full bg-sky-400 animate-pulse" />
            )}
            <span>{announcement.isRead ? 'Read' : 'New'}</span>
          </button>

          {announcement.url && (
            <a
              href={announcement.url}
              target="_blank"
              rel="noopener noreferrer"
              className="p-1 text-slate-400 hover:text-sky-400 hover:bg-sky-500/10 rounded transition-colors"
              title="Open announcement on Blackboard"
            >
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          )}
        </div>
      </div>

      {/* Announcement Title */}
      <h3
        className={`text-sm font-semibold leading-snug tracking-tight mb-2 ${
          announcement.isRead ? 'text-slate-200' : 'text-slate-100 font-bold'
        }`}
      >
        {announcement.title}
      </h3>

      {/* Announcement Content */}
      <div className="text-xs text-slate-300 whitespace-pre-line leading-relaxed break-words font-sans">
        {displayContent}
      </div>

      {/* Card Footer: Expand / Collapse Toggle + Copy */}
      <div className="flex items-center justify-between gap-2 mt-3 pt-2 border-t border-slate-800/60 text-xs text-slate-400">
        <div>
          {isLongContent && (
            <button
              type="button"
              onClick={() => setIsExpanded(!isExpanded)}
              className="inline-flex items-center gap-1 text-[11px] text-sky-400 hover:text-sky-300 font-medium transition-colors"
            >
              {isExpanded ? (
                <>
                  <ChevronUp className="w-3 h-3" />
                  <span>Show less</span>
                </>
              ) : (
                <>
                  <ChevronDown className="w-3 h-3" />
                  <span>Read full announcement</span>
                </>
              )}
            </button>
          )}
        </div>

        <button
          type="button"
          onClick={handleCopy}
          className="inline-flex items-center gap-1 text-[11px] text-slate-400 hover:text-slate-200 transition-colors p-0.5 rounded"
          title="Copy announcement text"
        >
          {copied ? (
            <>
              <CheckCheck className="w-3 h-3 text-emerald-400" />
              <span className="text-emerald-400">Copied</span>
            </>
          ) : (
            <>
              <Copy className="w-3 h-3" />
              <span>Copy</span>
            </>
          )}
        </button>
      </div>
    </article>
  );
};
