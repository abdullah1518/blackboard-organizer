import { StorageService } from '../services/storage';
import { SyncEngine } from './syncEngine';

const SYNC_ALARM_NAME = 'BB_PERIODIC_SYNC';

/**
 * Extension installation and initialization
 */
chrome.runtime.onInstalled.addListener(async (details) => {
  console.log('[Blackboard TaskSync] Installed/Updated:', details.reason);

  // Setup periodic sync alarm (every 60 mins)
  chrome.alarms.create(SYNC_ALARM_NAME, {
    periodInMinutes: 60,
    delayInMinutes: 5
  });

  // Enable sidepanel on Chrome action button if user prefers or API exists
  if (chrome.sidePanel && chrome.sidePanel.setPanelBehavior) {
    chrome.sidePanel
      .setPanelBehavior({ openPanelOnActionClick: false })
      .catch(() => {});
  }

  // Initial badge update
  await StorageService.updateExtensionBadge();
});

/**
 * Handle background periodic alarms
 */
chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === SYNC_ALARM_NAME) {
    console.log('[Blackboard TaskSync] Periodic sync triggered by alarm');
    try {
      await SyncEngine.runSync(false);
    } catch (err) {
      console.error('[Blackboard TaskSync] Scheduled sync error:', err);
    }
  }
});

/**
 * Handle runtime messages across popup, sidepanel, and content scripts
 */
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'TRIGGER_SYNC') {
    SyncEngine.runSync(true)
      .then((result) => sendResponse(result))
      .catch((err) => sendResponse({ success: false, error: err.message }));
    return true; // Keep message channel open for async response
  }

  if (message.type === 'UPDATE_BADGE') {
    StorageService.updateExtensionBadge()
      .then(() => sendResponse({ success: true }))
      .catch((err) => sendResponse({ success: false, error: err.message }));
    return true;
  }

  if (message.type === 'SESSION_DETECTED') {
    // Content script detected active blackboard tab
    StorageService.getSettings().then((settings) => {
      if (!settings.customBlackboardUrl || settings.customBlackboardUrl.includes('learn.blackboard.com')) {
        settings.customBlackboardUrl = message.domain;
        StorageService.saveSettings(settings);
      }
      sendResponse({ acknowledged: true });
    });
    return true;
  }

  if (message.type === 'OPEN_SIDE_PANEL') {
    if (chrome.sidePanel && chrome.sidePanel.open) {
      const windowId = sender.tab?.windowId;
      if (typeof windowId === 'number') {
        chrome.sidePanel.open({ windowId }).then(() => {
          sendResponse({ success: true });
        }).catch((err) => {
          sendResponse({ success: false, error: err.message });
        });
        return true;
      }
    }
    sendResponse({ success: false, error: 'Side panel API not supported in this context' });
    return false;
  }
});
