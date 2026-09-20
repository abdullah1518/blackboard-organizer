import React from 'react';
import { Search, X, Layers } from 'lucide-react';
import { Course, TaskFilterState, TaskType } from '../types/task';

interface FilterBarProps {
  filter: TaskFilterState;
  courses: Course[];
  onFilterChange: (newFilter: TaskFilterState) => void;
  compact?: boolean;
}

export const FilterBar: React.FC<FilterBarProps> = ({
  filter,
  courses,
  onFilterChange,
  compact = false
}) => {
  const taskTypes: { label: string; value: TaskType | 'ALL' }[] = [
    { label: 'All Types', value: 'ALL' },
    { label: 'Assignments', value: 'ASSIGNMENT' },
    { label: 'Quizzes & Tests', value: 'QUIZ_TEST' },
    { label: 'Discussions', value: 'DISCUSSION' },
    { label: 'Personal', value: 'CUSTOM_TASK' }
  ];

  return (
    <div className="space-y-2.5">
      {/* Search Bar */}
      <div className="relative">
        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          type="text"
          value={filter.search}
          onChange={(e) => onFilterChange({ ...filter, search: e.target.value })}
          placeholder="Search deadlines, tasks, courses..."
          className="w-full pl-9 pr-8 py-1.5 text-xs bg-slate-900/90 border border-slate-800 rounded-xl text-slate-200 placeholder-slate-500 focus:outline-none focus:border-sky-500/80 focus:ring-1 focus:ring-sky-500/50 transition-all"
        />
        {filter.search && (
          <button
            type="button"
            onClick={() => onFilterChange({ ...filter, search: '' })}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 p-0.5"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Course Pills */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar text-xs">
        <button
          type="button"
          onClick={() => onFilterChange({ ...filter, selectedCourseId: 'ALL' })}
          className={`flex-shrink-0 px-2.5 py-1 rounded-lg font-medium transition-all text-[11px] flex items-center gap-1.5 ${
            filter.selectedCourseId === 'ALL'
              ? 'bg-sky-500 text-slate-950 font-semibold shadow-sm'
              : 'bg-slate-800/80 text-slate-400 hover:text-slate-200 border border-slate-700/60'
          }`}
        >
          <Layers className="w-3 h-3" />
          All Courses
        </button>

        {courses.map((c) => {
          const isSelected = filter.selectedCourseId === c.id;
          return (
            <button
              key={c.id}
              type="button"
              onClick={() => onFilterChange({ ...filter, selectedCourseId: c.id })}
              className={`flex-shrink-0 px-2.5 py-1 rounded-lg font-medium transition-all text-[11px] flex items-center gap-1.5 ${
                isSelected
                  ? 'text-white shadow-sm ring-1 ring-white/20'
                  : 'bg-slate-800/80 text-slate-400 hover:text-slate-200 border border-slate-700/60'
              }`}
              style={{
                backgroundColor: isSelected ? c.color : undefined
              }}
            >
              <span
                className="w-1.5 h-1.5 rounded-full"
                style={{ backgroundColor: isSelected ? '#ffffff' : c.color }}
              />
              {c.code || c.name}
            </button>
          );
        })}
      </div>

      {/* Type Filter Chips (hidden in extra compact view to save vertical space) */}
      {!compact && (
        <div className="flex items-center justify-between gap-1 overflow-x-auto text-[11px]">
          <div className="flex items-center gap-1">
            {taskTypes.map((t) => (
              <button
                key={t.value}
                type="button"
                onClick={() => onFilterChange({ ...filter, selectedType: t.value })}
                className={`px-2 py-0.5 rounded-md font-medium transition-colors ${
                  filter.selectedType === t.value
                    ? 'bg-slate-700 text-sky-300 border border-sky-500/30'
                    : 'text-slate-400 hover:text-slate-300'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          <label className="flex items-center gap-1.5 text-slate-400 hover:text-slate-200 cursor-pointer flex-shrink-0 text-[11px]">
            <input
              type="checkbox"
              checked={filter.hideCompleted}
              onChange={(e) => onFilterChange({ ...filter, hideCompleted: e.target.checked })}
              className="rounded border-slate-700 bg-slate-800 text-sky-500 focus:ring-0 focus:ring-offset-0 w-3 h-3 cursor-pointer"
            />
            Hide Completed
          </label>
        </div>
      )}
    </div>
  );
};
