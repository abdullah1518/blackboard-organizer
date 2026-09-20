import { StorageService } from '../services/storage';

async function runStorageTests() {
  console.log('🧪 Starting Storage & Demo Mode Transition Tests...\n');

  // 1. Initial state
  let tasks = await StorageService.getTasks();
  let settings = await StorageService.getSettings();
  console.log('1. Initial tasks count:', tasks.length, '| isDemoMode:', settings.isDemoMode);
  if (tasks.length === 0) throw new Error('Initial tasks should have seed tasks');

  // 2. Remove demo tasks
  await StorageService.removeDemoTasks();
  tasks = await StorageService.getTasks();
  console.log('2. Tasks count after removeDemoTasks:', tasks.length);
  if (tasks.length !== 0) throw new Error('Tasks should be 0 after removeDemoTasks');

  // 3. Toggle isDemoMode off
  settings.isDemoMode = false;
  await StorageService.saveSettings(settings);
  settings = await StorageService.getSettings();
  console.log('3. isDemoMode after saving false:', settings.isDemoMode);
  if (settings.isDemoMode !== false) throw new Error('isDemoMode should be false');

  // 4. Test getTasks does not re-seed demo tasks
  tasks = await StorageService.getTasks();
  console.log('4. Tasks count on subsequent getTasks:', tasks.length);
  if (tasks.length !== 0) throw new Error('Tasks should remain 0 and not reseed');

  // 5. Test clearAllData
  await StorageService.clearAllData();
  tasks = await StorageService.getTasks();
  settings = await StorageService.getSettings();
  console.log('5. After clearAllData: tasks:', tasks.length, '| isDemoMode:', settings.isDemoMode);
  if (settings.isDemoMode !== false) throw new Error('isDemoMode should stay false after clearAllData');
  if (tasks.length !== 0) throw new Error('tasks should stay 0 after clearAllData');

  // 6. Test restoreDemoTasks
  await StorageService.restoreDemoTasks();
  tasks = await StorageService.getTasks();
  console.log('6. After restoreDemoTasks: tasks count:', tasks.length);
  if (tasks.length === 0) throw new Error('restoreDemoTasks should restore sample tasks');

  console.log('\n🎉 ALL STORAGE & DEMO MODE TRANSITION TESTS PASSED!\n');
}

runStorageTests();
