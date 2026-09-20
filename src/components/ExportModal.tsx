import React, { useState } from 'react';
import { X, Calendar, Bell, Download, Check, Layers } from 'lucide-react';
import { CalendarExportOptions } from '../types/calendar';
import { Course, Task, TaskType } from '../types/task';
import {
  downloadCalendarFile,
  filterTasksForExport,
  generateCalendarFiles
} from '../services/calendarExport';

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  tasks: Task[];
  courses: Course[];
}

export const ExportModal: React.FC<ExportModalProps> = ({
  isOpen,
  onClose,
  tasks,
  courses
}) => {
  const [scope, setScope] = useState<CalendarExportOptions['scope']>('all');
  const [selectedCourseIds, setSelectedCourseIds] = useState<string[]>(
    courses.map((c) => c.id)
  );
  const [includedTypes, setIncludedTypes] = useState<TaskType[]>([
    'ASSIGNMENT',
    'QUIZ_TEST',
    'DISCUSSION',
    'CUSTOM_TASK'
  ]);
  const [reminders, setReminders] = useState({
    enable24h: true,
    enable2h: true,
    enable1h: false
  });
  const [separateFilesPerCourse, setSeparateFilesPerCourse] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [exportSuccess, setExportSuccess] = useState(false);

  if (!isOpen) return null;

  const exportOptions: CalendarExportOptions = {
    scope,
    selectedCourseIds: scope === 'selected_courses' ? selectedCourseIds : undefined,
    includedTypes,
    reminders,
    separateFilesPerCourse
  };

  const previewTasks = filterTasksForExport(tasks, exportOptions);

  const toggleCourse = (courseId: string) => {
    if (selectedCourseIds.includes(courseId)) {
      setSelectedCourseIds(selectedCourseIds.filter((id) => id !== courseId));
    } else {
      setSelectedCourseIds([...selectedCourseIds, courseId]);
    }
  };

  const toggleType = (type: TaskType) => {
    if (includedTypes.includes(type)) {
      setIncludedTypes(includedTypes.filter((t) => t !== type));
    } else {
      setIncludedTypes([...includedTypes, type]);
    }
  };

  const handleExport = () => {
    setIsExporting(true);
    try {
      const files = generateCalendarFiles(tasks, courses, exportOptions);
      files.forEach((f) => downloadCalendarFile(f));
      setExportSuccess(true);
      setTimeout(() => {
        setExportSuccess(false);
        onClose();
      }, 1200);
    } catch (err) {
      console.error('Export error:', err);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fadeIn">
      <div className="w-full max-w-md bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800 bg-slate-900/90">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-sky-500/10 text-sky-400 border border-sky-500/20">
              <Calendar className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-slate-100">Export to Calendar (.ics)</h3>
              <p className="text-[11px] text-slate-400">
                Google Calendar, Apple Calendar, Outlook
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-slate-200 rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 space-y-4 overflow-y-auto">
          {/* Export Scope */}
          <div>
            <label className="text-xs font-semibold text-slate-300 block mb-1.5">
              Tasks to Include
            </label>
            <div className="grid grid-cols-3 gap-1.5 text-xs">
              {[
                { id: 'all', label: 'All Tasks' },
                { id: 'pending', label: 'Pending Only' },
                { id: 'selected_courses', label: 'By Course' }
              ].map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setScope(opt.id as any)}
                  className={`py-2 px-2 rounded-xl border text-center font-medium transition-all ${
                    scope === opt.id
                      ? 'bg-sky-500/15 border-sky-500 text-sky-300'
                      : 'bg-slate-800/60 border-slate-700/60 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Course Selection when 'By Course' selected */}
          {scope === 'selected_courses' && (
            <div className="p-3 bg-slate-950/60 border border-slate-800 rounded-xl space-y-1.5">
              <span className="text-[11px] text-slate-400 font-medium block">
                Select courses:
              </span>
              <div className="space-y-1">
                {courses.map((c) => (
                  <label
                    key={c.id}
                    className="flex items-center gap-2 text-xs text-slate-300 hover:text-white cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={selectedCourseIds.includes(c.id)}
                      onChange={() => toggleCourse(c.id)}
                      className="rounded border-slate-700 bg-slate-800 text-sky-500 focus:ring-0 w-3.5 h-3.5"
                    />
                    <span
                      className="w-2 h-2 rounded-full"
                      style={{ backgroundColor: c.color }}
                    />
                    <span>{c.code || c.name}</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          {/* Item Types Checklist */}
          <div>
            <label className="text-xs font-semibold text-slate-300 block mb-1.5">
              Item Types
            </label>
            <div className="grid grid-cols-2 gap-2 text-xs">
              {[
                { id: 'ASSIGNMENT', label: 'Assignments' },
                { id: 'QUIZ_TEST', label: 'Quizzes & Tests' },
                { id: 'DISCUSSION', label: 'Discussions' },
                { id: 'CUSTOM_TASK', label: 'Personal Tasks' }
              ].map((t) => (
                <label
                  key={t.id}
                  className="flex items-center gap-2 p-2 rounded-lg bg-slate-800/50 border border-slate-700/50 cursor-pointer text-slate-300 hover:text-white"
                >
                  <input
                    type="checkbox"
                    checked={includedTypes.includes(t.id as any)}
                    onChange={() => toggleType(t.id as any)}
                    className="rounded border-slate-700 bg-slate-800 text-sky-500 focus:ring-0 w-3.5 h-3.5"
                  />
                  <span>{t.label}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Reminders (VALARM) */}
          <div>
            <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5 mb-1.5">
              <Bell className="w-3.5 h-3.5 text-amber-400" />
              Automated Reminders (VALARM)
            </label>
            <div className="space-y-1.5 text-xs">
              <label className="flex items-center justify-between p-2 rounded-lg bg-slate-800/50 border border-slate-700/50 cursor-pointer text-slate-300">
                <span>Alert 24 hours prior</span>
                <input
                  type="checkbox"
                  checked={reminders.enable24h}
                  onChange={(e) =>
                    setReminders({ ...reminders, enable24h: e.target.checked })
                  }
                  className="rounded border-slate-700 bg-slate-800 text-sky-500 focus:ring-0 w-3.5 h-3.5"
                />
              </label>
              <label className="flex items-center justify-between p-2 rounded-lg bg-slate-800/50 border border-slate-700/50 cursor-pointer text-slate-300">
                <span>Alert 2 hours prior</span>
                <input
                  type="checkbox"
                  checked={reminders.enable2h}
                  onChange={(e) =>
                    setReminders({ ...reminders, enable2h: e.target.checked })
                  }
                  className="rounded border-slate-700 bg-slate-800 text-sky-500 focus:ring-0 w-3.5 h-3.5"
                />
              </label>
            </div>
          </div>

          {/* Separate Files vs Unified */}
          <div>
            <label className="flex items-center justify-between p-2.5 rounded-xl bg-slate-800/50 border border-slate-700/50 cursor-pointer">
              <div className="space-y-0.5">
                <span className="text-xs font-medium text-slate-200 flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5 text-sky-400" />
                  Separate file per course
                </span>
                <p className="text-[10px] text-slate-400">
                  Allows assigning distinct colors per course in Google Calendar
                </p>
              </div>
              <input
                type="checkbox"
                checked={separateFilesPerCourse}
                onChange={(e) => setSeparateFilesPerCourse(e.target.checked)}
                className="rounded border-slate-700 bg-slate-800 text-sky-500 focus:ring-0 w-4 h-4"
              />
            </label>
          </div>

          {/* Export Count Info */}
          <div className="flex items-center justify-between px-3 py-2 rounded-lg bg-sky-500/10 border border-sky-500/20 text-xs text-sky-300">
            <span>Items to export:</span>
            <span className="font-bold">{previewTasks.length} deadlines</span>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-900/90 flex items-center gap-3">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-2 text-xs font-medium text-slate-400 hover:text-slate-200 rounded-xl hover:bg-slate-800 transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleExport}
            disabled={previewTasks.length === 0 || isExporting}
            className={`flex-1 py-2.5 text-xs font-semibold rounded-xl flex items-center justify-center gap-2 transition-all shadow-lg ${
              exportSuccess
                ? 'bg-emerald-500 text-slate-950 font-bold'
                : previewTasks.length === 0
                ? 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700'
                : 'bg-sky-500 hover:bg-sky-400 text-slate-950 hover:shadow-sky-500/25 active:scale-[0.98]'
            }`}
          >
            {exportSuccess ? (
              <>
                <Check className="w-4 h-4 stroke-[3]" />
                Exported Successfully!
              </>
            ) : isExporting ? (
              <span>Generating...</span>
            ) : (
              <>
                <Download className="w-4 h-4" />
                Download .ics ({previewTasks.length})
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
