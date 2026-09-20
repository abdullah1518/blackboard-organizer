import React, { useEffect, useState } from 'react';
import {
  RefreshCw,
  Settings as SettingsIcon,
  Plus,
  Download,
  Sparkles
} from 'lucide-react';
import { AddTaskModal } from '../components/AddTaskModal';
import { ExportModal } from '../components/ExportModal';
import { FilterBar } from '../components/FilterBar';
import { SettingsModal } from '../components/SettingsModal';
import { TaskList } from '../components/TaskList';
import { DEFAULT_USER_SETTINGS } from '../services/mockData';
import { StorageService } from '../services/storage';
import { Course, Task, TaskFilterState, UserSettings } from '../types/task';

export const App: React.FC = () => {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [settings, setSettings] = useState<UserSettings>(DEFAULT_USER_SETTINGS);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncStatusMsg, setSyncStatusMsg] = useState<string | null>(null);

  // Grouping mode
  const [groupBy, setGroupBy] = useState<'urgency' | 'none'>('urgency');

  // Modals
  const [isExportOpen, setIsExportOpen] = useState(false);
  const [isAddTaskOpen, setIsAddTaskOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  // Filter state
  const [filter, setFilter] = useState<TaskFilterState>({
    search: '',
    selectedCourseId: 'ALL',
    selectedType: 'ALL',
    urgencyFilter: 'ALL',
    hideCompleted: false
  });

  const loadData = async () => {
    const loadedTasks = await StorageService.getTasks();
    const loadedCourses = await StorageService.getCourses();
    const loadedSettings = await StorageService.getSettings();
    setTasks(loadedTasks);
    setCourses(loadedCourses);
    setSettings(loadedSettings);
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleSync = async () => {
    setIsSyncing(true);
    setSyncStatusMsg(null);
    try {
      if (typeof chrome !== 'undefined' && chrome.runtime?.sendMessage) {
        const response = await chrome.runtime.sendMessage({ type: 'TRIGGER_SYNC' });
        if (response && response.success) {
          setSyncStatusMsg(`Synced successfully: ${response.added} new, ${response.updated} updated`);
        } else if (response && response.error) {
          setSyncStatusMsg(response.error);
        }
      }
      await loadData();
    } catch {
      await loadData();
    } finally {
      setIsSyncing(false);
      setTimeout(() => setSyncStatusMsg(null), 4000);
    }
  };

  const handleToggleComplete = async (id: string) => {
    await StorageService.toggleTaskComplete(id);
    await loadData();
  };

  const handleDelete = async (id: string) => {
    await StorageService.deleteTask(id);
    await loadData();
  };

  const handleAddCustomTask = async (newTask: Omit<Task, 'id' | 'lastSynced'>) => {
    await StorageService.addCustomTask(newTask);
    await loadData();
  };

  const handleToggleSubTask = async (taskId: string, subTaskId: string) => {
    await StorageService.toggleSubTask(taskId, subTaskId);
    await loadData();
  };

  const handleAddSubTask = async (taskId: string, title: string) => {
    await StorageService.addSubTask(taskId, title);
    await loadData();
  };

  // Filtered task set
  const filteredTasks = tasks.filter((t) => {
    if (filter.hideCompleted && t.isCompleted) return false;
    if (filter.selectedCourseId !== 'ALL' && t.courseId !== filter.selectedCourseId)
      return false;
    if (filter.selectedType !== 'ALL' && t.type !== filter.selectedType) return false;
    if (filter.search.trim()) {
      const q = filter.search.toLowerCase();
      const matchTitle = t.title.toLowerCase().includes(q);
      const matchCourse = (t.courseName || '').toLowerCase().includes(q);
      const matchDesc = (t.description || '').toLowerCase().includes(q);
      if (!matchTitle && !matchCourse && !matchDesc) return false;
    }
    return true;
  });

  // Urgency metric computations
  const now = Date.now();
  const overdueCount = tasks.filter(
    (t) => !t.isCompleted && new Date(t.dueDate).getTime() < now
  ).length;
  const dueTodayCount = tasks.filter((t) => {
    if (t.isCompleted) return false;
    const diff = new Date(t.dueDate).getTime() - now;
    return diff >= 0 && diff <= 24 * 60 * 60 * 1000;
  }).length;
  const completedCount = tasks.filter((t) => t.isCompleted).length;

  return (
    <div className="min-h-screen flex flex-col bg-slate-950 text-slate-100 font-sans selection:bg-sky-500 selection:text-white">
      {/* Top Navigation Bar */}
      <header className="sticky top-0 z-20 px-4 py-3 bg-slate-900/90 backdrop-blur-md border-b border-slate-800">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-sky-500 to-indigo-600 flex items-center justify-center font-bold text-white shadow-glow-brand text-sm">
              BB
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-sm font-bold tracking-tight text-white">
                  Blackboard TaskSync
                </h1>
                {settings.isDemoMode && (
                  <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-amber-500/15 text-amber-300 border border-amber-500/30 flex items-center gap-1">
                    <Sparkles className="w-2.5 h-2.5" />
                    Demo Mode
                  </span>
                )}
              </div>
              <p className="text-[11px] text-slate-400">
                Local-first academic deadline aggregator & calendar export
              </p>
            </div>
          </div>

          {/* Quick Header Actions */}
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={handleSync}
              disabled={isSyncing}
              className="p-2 rounded-xl bg-slate-800/80 hover:bg-slate-750 text-slate-300 hover:text-white border border-slate-700/60 transition-colors"
              title="Sync with Blackboard now"
            >
              <RefreshCw
                className={`w-4 h-4 ${isSyncing ? 'animate-spin text-sky-400' : ''}`}
              />
            </button>

            <button
              type="button"
              onClick={() => setIsExportOpen(true)}
              className="px-3 py-1.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-semibold flex items-center gap-1.5 shadow-sm active:scale-[0.98] transition-all"
            >
              <Download className="w-3.5 h-3.5" />
              Export .ics
            </button>

            <button
              type="button"
              onClick={() => setIsSettingsOpen(true)}
              className="p-2 rounded-xl bg-slate-800/80 hover:bg-slate-750 text-slate-400 hover:text-slate-200 border border-slate-700/60 transition-colors"
              title="Extension Settings"
            >
              <SettingsIcon className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Sync Status Banner */}
        {syncStatusMsg && (
          <div className="mt-2 px-3 py-1.5 bg-sky-500/10 border border-sky-500/20 rounded-lg text-xs text-sky-300 flex items-center justify-between animate-fadeIn">
            <span>{syncStatusMsg}</span>
          </div>
        )}
      </header>

      {/* Metric Cards Banner */}
      <section className="px-4 py-3 border-b border-slate-800/80 bg-slate-900/30">
        <div className="grid grid-cols-4 gap-2 text-center">
          <div className="p-2 rounded-xl bg-red-500/10 border border-red-500/20">
            <span className="text-[10px] font-medium text-red-400 block uppercase tracking-wider">
              Overdue
            </span>
            <span className="text-base font-bold text-red-300">{overdueCount}</span>
          </div>

          <div className="p-2 rounded-xl bg-rose-500/10 border border-rose-500/20">
            <span className="text-[10px] font-medium text-rose-400 block uppercase tracking-wider">
              Due Today
            </span>
            <span className="text-base font-bold text-rose-300">{dueTodayCount}</span>
          </div>

          <div className="p-2 rounded-xl bg-sky-500/10 border border-sky-500/20">
            <span className="text-[10px] font-medium text-sky-400 block uppercase tracking-wider">
              Pending
            </span>
            <span className="text-base font-bold text-sky-300">
              {tasks.length - completedCount}
            </span>
          </div>

          <div className="p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
            <span className="text-[10px] font-medium text-emerald-400 block uppercase tracking-wider">
              Completed
            </span>
            <span className="text-base font-bold text-emerald-300">{completedCount}</span>
          </div>
        </div>
      </section>

      {/* Workspace Controls (Search, Filters, Grouping) */}
      <section className="p-4 border-b border-slate-800/80 space-y-3 bg-slate-900/20">
        <FilterBar
          filter={filter}
          courses={courses}
          onFilterChange={setFilter}
          compact={false}
        />

        <div className="flex items-center justify-between text-xs pt-1">
          <div className="flex items-center gap-2">
            <span className="text-slate-400 font-medium">Group By:</span>
            <div className="inline-flex p-0.5 rounded-lg bg-slate-900 border border-slate-800">
              <button
                type="button"
                onClick={() => setGroupBy('urgency')}
                className={`px-2 py-0.5 rounded-md text-[11px] font-medium transition-colors ${
                  groupBy === 'urgency'
                    ? 'bg-slate-800 text-sky-400 shadow-sm'
                    : 'text-slate-400 hover:text-slate-300'
                }`}
              >
                Urgency
              </button>
              <button
                type="button"
                onClick={() => setGroupBy('none')}
                className={`px-2 py-0.5 rounded-md text-[11px] font-medium transition-colors ${
                  groupBy === 'none'
                    ? 'bg-slate-800 text-sky-400 shadow-sm'
                    : 'text-slate-400 hover:text-slate-300'
                }`}
              >
                Chronological
              </button>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setIsAddTaskOpen(true)}
            className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700/80 text-xs font-medium flex items-center gap-1.5 transition-colors"
          >
            <Plus className="w-3.5 h-3.5 text-sky-400" />
            Add Personal Task
          </button>
        </div>
      </section>

      {/* Main Task List Area */}
      <main className="flex-1 p-4 overflow-y-auto">
        <TaskList
          tasks={filteredTasks}
          courses={courses}
          onToggleComplete={handleToggleComplete}
          onDelete={handleDelete}
          onToggleSubTask={handleToggleSubTask}
          onAddSubTask={handleAddSubTask}
          groupBy={groupBy}
          compact={false}
        />
      </main>

      {/* Bottom Sticky Status / Quick Info Bar */}
      <footer className="sticky bottom-0 px-4 py-2.5 bg-slate-900/90 backdrop-blur-md border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-400" />
          <span className="text-[11px]">
            {settings.lastSyncTime
              ? `Last synced ${new Date(settings.lastSyncTime).toLocaleTimeString([], {
                  hour: '2-digit',
                  minute: '2-digit'
                })}`
              : 'Not synced yet'}
          </span>
        </div>

        <span className="text-[11px] text-slate-500">
          RFC 5545 Standard • 100% Local
        </span>
      </footer>

      {/* Modals */}
      <ExportModal
        isOpen={isExportOpen}
        onClose={() => setIsExportOpen(false)}
        tasks={tasks}
        courses={courses}
      />
      <AddTaskModal
        isOpen={isAddTaskOpen}
        onClose={() => setIsAddTaskOpen(false)}
        courses={courses}
        onAddTask={handleAddCustomTask}
      />
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        settings={settings}
        onSaveSettings={async (s) => {
          await StorageService.saveSettings(s);
          await loadData();
        }}
        onResetDemoData={async () => {
          await StorageService.resetToMockData();
          await loadData();
        }}
        onClearAllData={async () => {
          await StorageService.clearAllData();
          await loadData();
        }}
      />
    </div>
  );
};
