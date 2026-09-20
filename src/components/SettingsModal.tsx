import React, { useState } from 'react';
import { X, Settings, ShieldCheck, RefreshCw, Trash2, Globe, Clock, Sparkles } from 'lucide-react';
import { UserSettings } from '../types/task';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: UserSettings;
  onSaveSettings: (settings: UserSettings) => Promise<void>;
  onResetDemoData: () => Promise<void>;
  onClearAllData: () => Promise<void>;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  settings,
  onSaveSettings,
  onResetDemoData,
  onClearAllData
}) => {
  const [formData, setFormData] = useState<UserSettings>({ ...settings });
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  if (!isOpen) return null;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      await onSaveSettings(formData);
      setSaveSuccess(true);
      setTimeout(() => {
        setSaveSuccess(false);
        onClose();
      }, 800);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fadeIn">
      <div className="w-full max-w-md bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800 bg-slate-900/90">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-slate-800 text-slate-300 border border-slate-700">
              <Settings className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-slate-100">Extension Settings</h3>
              <p className="text-[11px] text-slate-400">
                Configure synchronization and local storage
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

        {/* Settings Body */}
        <form onSubmit={handleSave} className="p-5 space-y-4 overflow-y-auto">
          {/* Privacy Guarantee Card */}
          <div className="p-3 bg-emerald-950/30 border border-emerald-500/20 rounded-xl flex items-start gap-2.5 text-xs text-emerald-300">
            <ShieldCheck className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
            <div>
              <span className="font-semibold block">100% Local-First & FERPA Compliant</span>
              <span className="text-[11px] text-emerald-400/80 leading-relaxed block mt-0.5">
                Your courses, deadlines, and login tokens are strictly processed inside your browser
                storage (`chrome.storage.local`). Zero telemetry or external servers.
              </span>
            </div>
          </div>

          {/* Institutional URL */}
          <div>
            <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5 mb-1">
              <Globe className="w-3.5 h-3.5 text-sky-400" />
              Blackboard Portal URL
            </label>
            <input
              type="url"
              value={formData.customBlackboardUrl}
              onChange={(e) =>
                setFormData({ ...formData, customBlackboardUrl: e.target.value })
              }
              placeholder="https://learn.blackboard.com or your university URL"
              className="w-full px-3 py-2 text-xs bg-slate-950/80 border border-slate-800 rounded-xl text-slate-200 focus:outline-none focus:border-sky-500"
            />
            <span className="text-[10px] text-slate-500 mt-1 block">
              Auto-detected whenever you visit your university's Blackboard tab.
            </span>
          </div>

          {/* Sync Frequency */}
          <div>
            <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5 mb-1">
              <Clock className="w-3.5 h-3.5 text-amber-400" />
              Background Sync Frequency
            </label>
            <select
              value={formData.syncIntervalMinutes}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  syncIntervalMinutes: Number(e.target.value)
                })
              }
              className="w-full px-2.5 py-2 text-xs bg-slate-950/80 border border-slate-800 rounded-xl text-slate-200 focus:outline-none focus:border-sky-500"
            >
              <option value={15}>Every 15 minutes</option>
              <option value={30}>Every 30 minutes</option>
              <option value={60}>Every 1 hour (Recommended)</option>
              <option value={120}>Every 2 hours</option>
            </select>
          </div>

          {/* Demo Mode Toggle */}
          <div className="p-3 bg-slate-800/40 border border-slate-700/60 rounded-xl">
            <label className="flex items-center justify-between cursor-pointer">
              <div className="space-y-0.5">
                <span className="text-xs font-medium text-slate-200 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                  Demo Mode (Sample Data)
                </span>
                <p className="text-[10px] text-slate-400">
                  Loads sample university courses and deadlines without requiring active login.
                </p>
              </div>
              <input
                type="checkbox"
                checked={formData.isDemoMode}
                onChange={(e) =>
                  setFormData({ ...formData, isDemoMode: e.target.checked })
                }
                className="rounded border-slate-700 bg-slate-800 text-sky-500 focus:ring-0 w-4 h-4"
              />
            </label>
          </div>

          {/* Data Reset and Wipe Actions */}
          <div className="pt-2 border-t border-slate-800 space-y-2">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
              Data Management
            </span>

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={async () => {
                  if (confirm('Reset to standard university sample tasks?')) {
                    await onResetDemoData();
                    onClose();
                  }
                }}
                className="px-3 py-2 text-xs font-medium bg-slate-800/80 hover:bg-slate-700 text-slate-300 border border-slate-700 rounded-xl flex items-center justify-center gap-1.5 transition-colors"
              >
                <RefreshCw className="w-3.5 h-3.5 text-amber-400" />
                Reset Sample Data
              </button>

              <button
                type="button"
                onClick={async () => {
                  if (confirm('Wipe all local tasks and start completely fresh?')) {
                    await onClearAllData();
                    onClose();
                  }
                }}
                className="px-3 py-2 text-xs font-medium bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 rounded-xl flex items-center justify-center gap-1.5 transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Clear All Data
              </button>
            </div>
          </div>

          {/* Form Save Button */}
          <div className="pt-3 border-t border-slate-800 flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2 text-xs font-medium text-slate-400 hover:text-slate-200 rounded-xl hover:bg-slate-800 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className={`flex-1 py-2 text-xs font-semibold rounded-xl transition-all shadow-md active:scale-[0.98] ${
                saveSuccess
                  ? 'bg-emerald-500 text-slate-950 font-bold'
                  : 'bg-sky-500 hover:bg-sky-400 text-slate-950'
              }`}
            >
              {saveSuccess ? 'Settings Saved!' : isSaving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
