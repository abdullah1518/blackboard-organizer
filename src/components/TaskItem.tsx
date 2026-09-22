import React, { useState } from 'react';
import {
  Check,
  ExternalLink,
  Calendar,
  Clock,
  AlertCircle,
  FileText,
  HelpCircle,
  MessageSquare,
  CheckSquare,
  ChevronDown,
  ChevronRight,
  Plus,
  Trash2
} from 'lucide-react';
import { Course, Task, TaskType, UrgencyLevel } from '../types/task';
import { isNumericalOrInternalCode, parseBlackboardCourseString } from '../services/blackboardApi';

export function getDisplayCourseName(
  course?: Course,
  task?: { courseName?: string; courseCode?: string; title?: string; courseId?: string }
): string {
  const courseName = course?.name || task?.courseName;
  const courseCode = course?.code || task?.courseCode;

  const hasCleanName = courseName && !isNumericalOrInternalCode(courseName);
  const hasCleanCode = courseCode && !isNumericalOrInternalCode(courseCode);

  if (hasCleanCode) {
    return courseCode;
  }
  if (hasCleanName) {
    return courseName;
  }

  // Fallback: Try parsing from task title, courseName, or courseId
  if (task?.title || task?.courseName || task?.courseId) {
    const parsed =
      (task.title && parseBlackboardCourseString(task.title).code ? parseBlackboardCourseString(task.title) : undefined) ||
      (task.courseName && parseBlackboardCourseString(task.courseName).code ? parseBlackboardCourseString(task.courseName) : undefined) ||
      (task.courseId ? parseBlackboardCourseString(task.courseId) : undefined);

    if (parsed?.code) return parsed.code;
    if (parsed?.name && !isNumericalOrInternalCode(parsed.name)) return parsed.name;
  }

  return 'Course';
}

export function getDisplayCourseTooltip(
  course?: Course,
  task?: { courseName?: string; courseCode?: string; title?: string; courseId?: string }
): string {
  const code = course?.code || task?.courseCode;
  const name = course?.name || task?.courseName;

  const hasCleanCode = code && !isNumericalOrInternalCode(code);
  const hasCleanName = name && !isNumericalOrInternalCode(name);

  if (hasCleanCode && hasCleanName && code !== name) {
    return `${code} - ${name}`;
  }
  return hasCleanName ? name : hasCleanCode ? code : getDisplayCourseName(course, task);
}

interface TaskItemProps {
  task: Task;
  course?: Course;
  onToggleComplete: (id: string) => void;
  onDelete?: (id: string) => void;
  onToggleSubTask?: (taskId: string, subTaskId: string) => void;
  onAddSubTask?: (taskId: string, title: string) => void;
  compact?: boolean;
}

export const getUrgencyLevel = (dueDateStr: string, isCompleted: boolean): UrgencyLevel => {
  if (isCompleted) return 'later';
  const now = new Date().getTime();
  const due = new Date(dueDateStr).getTime();
  const diffHours = (due - now) / (1000 * 60 * 60);

  if (diffHours < 0) return 'overdue';
  if (diffHours <= 24) return 'today';
  if (diffHours <= 72) return 'soon';
  return 'later';
};

export const getUrgencyBadge = (dueDateStr: string, isCompleted: boolean) => {
  const urgency = getUrgencyLevel(dueDateStr, isCompleted);
  const now = new Date().getTime();
  const due = new Date(dueDateStr).getTime();
  const diffHours = Math.round((due - now) / (1000 * 60 * 60));
  const diffDays = Math.round(diffHours / 24);

  if (isCompleted) {
    return {
      text: 'Completed',
      className: 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20',
      icon: Check
    };
  }

  switch (urgency) {
    case 'overdue':
      return {
        text: `Overdue (${Math.abs(diffHours)}h ago)`,
        className: 'bg-red-500/15 text-red-400 border border-red-500/30 animate-pulse',
        icon: AlertCircle
      };
    case 'today':
      return {
        text: diffHours <= 1 ? 'Due in <1 hour!' : `Due in ${diffHours}h`,
        className: 'bg-rose-500/20 text-rose-300 border border-rose-500/30 font-semibold',
        icon: Clock
      };
    case 'soon':
      return {
        text: diffDays <= 1 ? 'Due Tomorrow' : `Due in ${diffDays} days`,
        className: 'bg-amber-500/15 text-amber-300 border border-amber-500/20',
        icon: Calendar
      };
    case 'later':
    default: {
      const formatted = new Date(dueDateStr).toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric'
      });
      return {
        text: formatted,
        className: 'bg-slate-800 text-slate-400 border border-slate-700/50',
        icon: Calendar
      };
    }
  }
};

const getTypeIcon = (type: TaskType) => {
  switch (type) {
    case 'ASSIGNMENT':
      return <FileText className="w-3.5 h-3.5 text-blue-400" />;
    case 'QUIZ_TEST':
      return <HelpCircle className="w-3.5 h-3.5 text-purple-400" />;
    case 'DISCUSSION':
      return <MessageSquare className="w-3.5 h-3.5 text-emerald-400" />;
    case 'CUSTOM_TASK':
      return <CheckSquare className="w-3.5 h-3.5 text-amber-400" />;
  }
};

export const TaskItem: React.FC<TaskItemProps> = ({
  task,
  course,
  onToggleComplete,
  onDelete,
  onToggleSubTask,
  onAddSubTask,
  compact = false
}) => {
  const [showSubtasks, setShowSubtasks] = useState(false);
  const [newSubtaskTitle, setNewSubtaskTitle] = useState('');
  const [isAddingSubtask, setIsAddingSubtask] = useState(false);

  const urgencyBadge = getUrgencyBadge(task.dueDate, task.isCompleted);
  const UrgencyIcon = urgencyBadge.icon;
  const courseColor = course?.color || '#38BDF8';
  const hasSubtasks = task.subtasks && task.subtasks.length > 0;
  const completedSubtasks = task.subtasks ? task.subtasks.filter((s) => s.completed).length : 0;
  const totalSubtasks = task.subtasks ? task.subtasks.length : 0;

  const handleCreateSubtask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSubtaskTitle.trim() || !onAddSubTask) return;
    onAddSubTask(task.id, newSubtaskTitle.trim());
    setNewSubtaskTitle('');
    setIsAddingSubtask(false);
  };

  return (
    <div
      className={`group rounded-xl border transition-all duration-200 ${
        task.isCompleted
          ? 'bg-slate-900/40 border-slate-800/60 opacity-75'
          : 'glass-card border-slate-800/80 hover:border-slate-700'
      } ${compact ? 'p-2.5' : 'p-3.5'}`}
    >
      <div className="flex items-start gap-3">
        {/* Completion Checkbox */}
        <button
          type="button"
          onClick={() => onToggleComplete(task.id)}
          className={`mt-0.5 flex-shrink-0 w-5 h-5 rounded-md border flex items-center justify-center transition-colors ${
            task.isCompleted
              ? 'bg-emerald-500 border-emerald-500 text-slate-950 shadow-sm'
              : 'border-slate-600 hover:border-sky-400 bg-slate-800/80 text-transparent'
          }`}
          title={task.isCompleted ? 'Mark pending' : 'Mark completed'}
        >
          <Check className="w-3.5 h-3.5 stroke-[3]" />
        </button>

        {/* Task Content */}
        <div className="flex-1 min-w-0">
          {/* Header Row: Course Badge + Urgency Chip */}
          <div className="flex items-center flex-wrap gap-1.5 mb-1 text-xs">
            {/* Course Tag */}
            <span
              className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md font-medium text-[11px]"
              style={{
                backgroundColor: `${courseColor}18`,
                color: courseColor,
                border: `1px solid ${courseColor}33`
              }}
              title={getDisplayCourseTooltip(course, task)}
            >
              <span
                className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                style={{ backgroundColor: courseColor }}
              />
              <span className="truncate max-w-[150px]">
                {getDisplayCourseName(course, task)}
              </span>
            </span>

            {/* Task Type Tag */}
            {!compact && (
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-slate-800/80 text-slate-400 border border-slate-700/50 text-[10px]">
                {getTypeIcon(task.type)}
                {task.type.replace('_', ' ')}
              </span>
            )}

            {/* Urgency Badge */}
            <span
              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] ml-auto font-medium ${urgencyBadge.className}`}
            >
              <UrgencyIcon className="w-3 h-3" />
              {urgencyBadge.text}
            </span>
          </div>

          {/* Task Title */}
          <div className="flex items-baseline justify-between gap-2">
            <h4
              className={`text-sm font-medium leading-snug tracking-tight ${
                task.isCompleted
                  ? 'line-through text-slate-400 decoration-slate-500'
                  : 'text-slate-100'
              }`}
            >
              {task.title}
            </h4>
          </div>

          {/* Optional Points & Description */}
          {!compact && task.description && (
            <p className="text-xs text-slate-400 mt-1 line-clamp-2 leading-relaxed">
              {task.description}
            </p>
          )}

          {/* Subtasks Progress Bar & Actions Footer */}
          <div className="flex items-center justify-between gap-2 mt-2 pt-1 text-xs text-slate-400">
            <div className="flex items-center gap-2">
              {hasSubtasks && (
                <button
                  type="button"
                  onClick={() => setShowSubtasks(!showSubtasks)}
                  className="inline-flex items-center gap-1 text-[11px] text-slate-400 hover:text-slate-200 transition-colors"
                >
                  {showSubtasks ? (
                    <ChevronDown className="w-3 h-3" />
                  ) : (
                    <ChevronRight className="w-3 h-3" />
                  )}
                  <span>
                    Subtasks ({completedSubtasks}/{totalSubtasks})
                  </span>
                </button>
              )}

              {task.points !== undefined && (
                <span className="text-[11px] text-slate-400 bg-slate-800/60 px-1.5 py-0.5 rounded">
                  {task.points} pts
                </span>
              )}
            </div>

            {/* Quick Actions (Deep link + Delete) */}
            <div className="flex items-center gap-1.5 opacity-80 group-hover:opacity-100 transition-opacity">
              {task.url && (
                <a
                  href={task.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-1 text-slate-400 hover:text-sky-400 hover:bg-sky-500/10 rounded transition-colors"
                  title="Open assessment on Blackboard"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              )}

              {onDelete && (
                <button
                  type="button"
                  onClick={() => onDelete(task.id)}
                  className="p-1 text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded transition-colors"
                  title="Delete task"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Subtasks Drawer */}
          {showSubtasks && (
            <div className="mt-2.5 pt-2 border-t border-slate-800 space-y-1.5 pl-2">
              {task.subtasks?.map((st) => (
                <label
                  key={st.id}
                  className="flex items-center gap-2 text-xs text-slate-300 hover:text-slate-100 cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={st.completed}
                    onChange={() => onToggleSubTask && onToggleSubTask(task.id, st.id)}
                    className="rounded border-slate-700 bg-slate-800 text-sky-500 focus:ring-0 focus:ring-offset-0 w-3.5 h-3.5 cursor-pointer"
                  />
                  <span className={st.completed ? 'line-through text-slate-500' : ''}>
                    {st.title}
                  </span>
                </label>
              ))}

              {/* Add subtask input */}
              {isAddingSubtask ? (
                <form onSubmit={handleCreateSubtask} className="flex items-center gap-1.5 mt-1.5">
                  <input
                    type="text"
                    value={newSubtaskTitle}
                    onChange={(e) => setNewSubtaskTitle(e.target.value)}
                    placeholder="Subtask name..."
                    autoFocus
                    className="flex-1 px-2 py-1 text-xs bg-slate-900/90 border border-slate-700 rounded text-slate-200 placeholder-slate-500 focus:outline-none focus:border-sky-500"
                  />
                  <button
                    type="submit"
                    className="px-2 py-1 text-xs bg-sky-600 hover:bg-sky-500 text-white rounded font-medium"
                  >
                    Add
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsAddingSubtask(false)}
                    className="px-1.5 py-1 text-xs text-slate-400 hover:text-slate-200"
                  >
                    Cancel
                  </button>
                </form>
              ) : (
                <button
                  type="button"
                  onClick={() => setIsAddingSubtask(true)}
                  className="inline-flex items-center gap-1 text-[11px] text-sky-400 hover:text-sky-300 mt-1"
                >
                  <Plus className="w-3 h-3" />
                  <span>Add subtask</span>
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
