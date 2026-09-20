import React, { useState } from 'react';
import { ChevronDown, ChevronRight, CheckCircle2, Inbox } from 'lucide-react';
import { Course, Task } from '../types/task';
import { getUrgencyLevel, TaskItem } from './TaskItem';

interface TaskListProps {
  tasks: Task[];
  courses: Course[];
  onToggleComplete: (id: string) => void;
  onDelete?: (id: string) => void;
  onToggleSubTask?: (taskId: string, subTaskId: string) => void;
  onAddSubTask?: (taskId: string, title: string) => void;
  groupBy?: 'urgency' | 'course' | 'none';
  compact?: boolean;
}

export const TaskList: React.FC<TaskListProps> = ({
  tasks,
  courses,
  onToggleComplete,
  onDelete,
  onToggleSubTask,
  onAddSubTask,
  groupBy = 'urgency',
  compact = false
}) => {
  const [completedCollapsed, setCompletedCollapsed] = useState(true);
  const courseMap = new Map<string, Course>(courses.map((c) => [c.id, c]));

  const completedTasks = tasks.filter((t) => t.isCompleted);
  const activeTasks = tasks.filter((t) => !t.isCompleted);

  if (tasks.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
        <div className="w-12 h-12 rounded-full bg-slate-800/80 border border-slate-700/60 flex items-center justify-center mb-3 text-slate-400">
          <Inbox className="w-6 h-6" />
        </div>
        <h3 className="text-sm font-medium text-slate-300">No tasks found</h3>
        <p className="text-xs text-slate-400 mt-1 max-w-[240px]">
          No assignments or exams match your current filter criteria.
        </p>
      </div>
    );
  }

  // Sort active tasks chronologically
  const sortedActive = [...activeTasks].sort(
    (a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime()
  );

  // Group by Urgency
  const overdueList = sortedActive.filter((t) => getUrgencyLevel(t.dueDate, false) === 'overdue');
  const todayList = sortedActive.filter((t) => getUrgencyLevel(t.dueDate, false) === 'today');
  const soonList = sortedActive.filter((t) => getUrgencyLevel(t.dueDate, false) === 'soon');
  const laterList = sortedActive.filter((t) => getUrgencyLevel(t.dueDate, false) === 'later');

  const renderTaskSection = (
    title: string,
    sectionTasks: Task[],
    badgeColor: string
  ) => {
    if (sectionTasks.length === 0) return null;

    return (
      <div className="space-y-2 mb-4">
        <div className="flex items-center justify-between px-1">
          <span className="text-xs font-semibold tracking-wider uppercase text-slate-400 flex items-center gap-1.5">
            <span className={`w-2 h-2 rounded-full ${badgeColor}`} />
            {title}
          </span>
          <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 border border-slate-700/50">
            {sectionTasks.length}
          </span>
        </div>

        <div className="space-y-2">
          {sectionTasks.map((t) => (
            <TaskItem
              key={t.id}
              task={t}
              course={courseMap.get(t.courseId)}
              onToggleComplete={onToggleComplete}
              onDelete={onDelete}
              onToggleSubTask={onToggleSubTask}
              onAddSubTask={onAddSubTask}
              compact={compact}
            />
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-1">
      {/* Active Tasks Groups */}
      {groupBy === 'urgency' ? (
        <>
          {renderTaskSection('Overdue', overdueList, 'bg-red-500')}
          {renderTaskSection('Due Today', todayList, 'bg-rose-500 animate-pulse')}
          {renderTaskSection('Due This Week', soonList, 'bg-amber-500')}
          {renderTaskSection('Later', laterList, 'bg-emerald-500')}
        </>
      ) : (
        <div className="space-y-2 mb-4">
          {sortedActive.map((t) => (
            <TaskItem
              key={t.id}
              task={t}
              course={courseMap.get(t.courseId)}
              onToggleComplete={onToggleComplete}
              onDelete={onDelete}
              onToggleSubTask={onToggleSubTask}
              onAddSubTask={onAddSubTask}
              compact={compact}
            />
          ))}
        </div>
      )}

      {/* Collapsible Completed Section */}
      {completedTasks.length > 0 && (
        <div className="pt-2 mt-4 border-t border-slate-800/80">
          <button
            type="button"
            onClick={() => setCompletedCollapsed(!completedCollapsed)}
            className="w-full flex items-center justify-between px-2 py-1.5 text-xs text-slate-400 hover:text-slate-200 transition-colors rounded-lg hover:bg-slate-800/40"
          >
            <span className="flex items-center gap-1.5 font-medium">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              Completed Tasks
            </span>
            <span className="flex items-center gap-1 text-[11px] text-slate-400">
              {completedTasks.length}
              {completedCollapsed ? (
                <ChevronRight className="w-3.5 h-3.5" />
              ) : (
                <ChevronDown className="w-3.5 h-3.5" />
              )}
            </span>
          </button>

          {!completedCollapsed && (
            <div className="space-y-2 mt-2">
              {completedTasks.map((t) => (
                <TaskItem
                  key={t.id}
                  task={t}
                  course={courseMap.get(t.courseId)}
                  onToggleComplete={onToggleComplete}
                  onDelete={onDelete}
                  compact={compact}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
