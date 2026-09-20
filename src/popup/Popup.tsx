import React, { useEffect, useState } from 'react';
import {
  Calendar,
  RefreshCw,
  Settings as SettingsIcon,
  Maximize2,
  Plus
} from 'lucide-react';
import { AddTaskModal } from '../components/AddTaskModal';
import { ExportModal } from '../components/ExportModal';
import { FilterBar } from '../components/FilterBar';
import { SettingsModal } from '../components/SettingsModal';
import { TaskList } from '../components/TaskList';
import { StorageService } from '../services/storage';
import { Course, Task, TaskFilterState, UserSettings } from '../types/task';
import { DEFAULT_USER_SETTINGS } from '../services/mockData';

export const Popup: React.FC = () => {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [settings, setSettings] = useState<UserSettings>(DEFAULT_USER_SETTINGS);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncNotice, setSyncNotice] = useState<string | null>(null);

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

  // Sync trigger
  const handleSync = async () => {
    setIsSyncing(true);
    setSyncNotice(null);
    try {
      if (typeof chrome !== 'undefined' && chrome.runtime?.sendMessage) {
        const response = await chrome.runtime.sendMessage({ type: 'TRIGGER_SYNC' });
        if (response && response.success) {
          setSyncNotice(`Synced ${response.added} new, ${response.updated} updated`);
        } else if (response && response.error) {
          setSyncNotice(response.error);
        }
      }
      await loadData();
    } catch {
      // Fallback reload
      await loadData();
    } finally {
      setIsSyncing(false);
      setTimeout(() => setSyncNotice(null), 3500);
    }
  };

  // Open sidepanel
  const handleOpenSidepanel = async () => {
    if (typeof chrome !== 'undefined' && chrome.sidePanel && chrome.sidePanel.open) {
      try {
        const curWindow = await chrome.windows.getCurrent();
        if (typeof curWindow.id === 'number') {
          await chrome.sidePanel.open({ windowId: curWindow.id });
          window.close();
          return;
        }
      } catch {
        // Fallback open sidepanel index.html in a tab
      }
    }
    // Fallback: open sidepanel full page in tab
    if (typeof chrome !== 'undefined' && chrome.tabs?.create) {
      chrome.tabs.create({ url: chrome.runtime.getURL('src/sidepanel/index.html') });
    } else {
      window.open('/src/sidepanel/index.html', '_blank');
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

  // Filter tasks
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

  const pendingUrgentCount = tasks.filter((t) => {
    if (t.isCompleted) return false;
    const diff = new Date(t.dueDate).getTime() - Date.now();
    return diff <= 24 * 60 * 60 * 1000;
  }).length;

  return (
    <div className="w-[380px] h-[540px] flex flex-col bg-slate-950 text-slate-100 select-none overflow-hidden font-sans border border-slate-800/80">
      {/* Header */}
      <header className="px-3.5 py-2.5 border-b border-slate-800/80 bg-slate-900/80 backdrop-blur flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-tr from-sky-600 to-indigo-500 flex items-center justify-center text-white shadow-sm font-bold text-xs">
            BB
          </div>
          <div>
            <h1 className="text-xs font-bold tracking-tight text-white flex items-center gap-1.5">
              Blackboard TaskSync
              {settings.isDemoMode && (
                <span className="text-[9px] font-medium px-1 py-0.2 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  Demo
                </span>
              )}
            </h1>
            <p className="text-[10px] text-slate-400">
              {pendingUrgentCount > 0 ? (
                <span className="text-rose-400 font-medium">
                  {pendingUrgentCount} due in &lt;24 hours
                </span>
              ) : (
                'All caught up'
              )}
            </p>
          </div>
        </div>

        {/* Header Action Buttons */}
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={handleSync}
            disabled={isSyncing}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
            title="Sync with Blackboard"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin text-sky-400' : ''}`} />
          </button>
          <button
            type="button"
            onClick={() => setIsExportOpen(true)}
            className="p-1.5 rounded-lg text-slate-400 hover:text-sky-400 hover:bg-slate-800 transition-colors"
            title="Quick Calendar Export (.ics)"
          >
            <Calendar className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => setIsSettingsOpen(true)}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
            title="Settings"
          >
            <SettingsIcon className="w-3.5 h-3.5" />
          </button>
        </div>
      </header>

      {/* Sync feedback notification banner */}
      {syncNotice && (
        <div className="px-3 py-1.5 bg-sky-500/10 border-b border-sky-500/20 text-[11px] text-sky-300 flex items-center justify-between">
          <span>{syncNotice}</span>
        </div>
      )}

      {/* Filter and Course Scroll Area */}
      <div className="p-3 border-b border-slate-800/80 bg-slate-900/40">
        <FilterBar
          filter={filter}
          courses={courses}
          onFilterChange={setFilter}
          compact={true}
        />
      </div>

      {/* Main Task List View (Scrollable) */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        <TaskList
          tasks={filteredTasks}
          courses={courses}
          onToggleComplete={handleToggleComplete}
          onDelete={handleDelete}
          onToggleSubTask={handleToggleSubTask}
          onAddSubTask={handleAddSubTask}
          compact={true}
        />
      </div>

      {/* Footer */}
      <footer className="p-2.5 border-t border-slate-800/80 bg-slate-900/90 flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => setIsAddTaskOpen(true)}
          className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-750 text-slate-200 hover:text-white border border-slate-700/60 text-xs font-medium flex items-center gap-1.5 transition-colors"
        >
          <Plus className="w-3.5 h-3.5 text-sky-400" />
          Add Task
        </button>

        <button
          type="button"
          onClick={handleOpenSidepanel}
          className="flex-1 py-1.5 px-3 rounded-lg bg-sky-600 hover:bg-sky-500 text-white font-medium text-xs flex items-center justify-center gap-1.5 transition-all shadow-sm active:scale-[0.98]"
        >
          <Maximize2 className="w-3.5 h-3.5" />
          Open Full Workspace
        </button>
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
