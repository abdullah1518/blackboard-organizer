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

  // 7. Test task deletion records tombstone
  const taskToDelete = tasks[0];
  const originalCount = tasks.length;
  await StorageService.deleteTask(taskToDelete.id);
  tasks = await StorageService.getTasks();
  console.log('7. After deleteTask: tasks count:', tasks.length);
  if (tasks.length !== originalCount - 1) throw new Error('Task count should decrease by 1');
  if (tasks.some((t) => t.id === taskToDelete.id)) throw new Error('Deleted task should not be in tasks');

  const tombstones = await StorageService.getDeletedTaskIds();
  console.log('7b. Tombstones count:', tombstones.length);
  if (!tombstones.includes(taskToDelete.id.toLowerCase())) {
    throw new Error('Tombstones should contain deleted task id');
  }

  // 8. Test upsertTasks does NOT resurrect deleted tasks
  const syncResult = await StorageService.upsertTasks([taskToDelete]);
  tasks = await StorageService.getTasks();
  console.log('8. After upsertTasks with deleted task: added:', syncResult.added, '| tasks:', tasks.length);
  if (syncResult.added !== 0) throw new Error('Deleted task should NOT be re-added on sync');
  if (tasks.some((t) => t.id === taskToDelete.id)) throw new Error('Deleted task reappeared after sync!');

  // 9. Test upsertTasks preserves isCompleted: true when incoming is isCompleted: false
  const activeTask = tasks[0];
  await StorageService.toggleTaskComplete(activeTask.id);
  let updatedTask = (await StorageService.getTasks()).find((t) => t.id === activeTask.id);
  if (!updatedTask?.isCompleted) throw new Error('Task should be marked completed');

  // Simulate Blackboard API sync returning false for completed
  await StorageService.upsertTasks([{ ...activeTask, isCompleted: false }]);
  updatedTask = (await StorageService.getTasks()).find((t) => t.id === activeTask.id);
  console.log('9. Task completed state after sync with isCompleted=false:', updatedTask?.isCompleted);
  if (!updatedTask?.isCompleted) throw new Error('User completion state must be preserved across syncs');

  console.log('\n🎉 ALL STORAGE & DEMO MODE & SYNC RESILIENCE TESTS PASSED!\n');
}

runStorageTests();
