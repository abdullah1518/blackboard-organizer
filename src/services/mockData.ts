import { Course, Task, UserSettings } from '../types/task';

export const INITIAL_COURSES: Course[] = [
  {
    id: 'CS301_FALL26',
    code: 'CS 301',
    name: 'Operating Systems',
    color: '#3B82F6', // Blue
    term: 'Fall 2026'
  },
  {
    id: 'MATH240_FALL26',
    code: 'MATH 240',
    name: 'Linear Algebra & Diff Eq',
    color: '#8B5CF6', // Purple
    term: 'Fall 2026'
  },
  {
    id: 'CS350_FALL26',
    code: 'CS 350',
    name: 'Design & Analysis of Algorithms',
    color: '#EC4899', // Pink
    term: 'Fall 2026'
  },
  {
    id: 'CS388_FALL26',
    code: 'CS 388',
    name: 'Human-Computer Interaction',
    color: '#10B981', // Emerald
    term: 'Fall 2026'
  },
  {
    id: 'HIST115_FALL26',
    code: 'HIST 115',
    name: 'Modern Global History',
    color: '#F59E0B', // Amber
    term: 'Fall 2026'
  }
];

export const DEFAULT_USER_SETTINGS: UserSettings = {
  customBlackboardUrl: 'https://learn.blackboard.com',
  syncIntervalMinutes: 60,
  isDemoMode: true,
  darkMode: true,
  defaultAlarm: 'both',
  autoSyncOnVisit: true,
  separateFilesPerCourse: false,
  lastSyncTime: new Date().toISOString()
};

/**
 * Generates dates relative to today for reliable testing
 */
function getRelativeDate(hoursOffset: number): string {
  const d = new Date();
  d.setTime(d.getTime() + hoursOffset * 60 * 60 * 1000);
  return d.toISOString();
}

export const INITIAL_TASKS: Task[] = [
  {
    id: 'bb_item_101',
    courseId: 'CS301_FALL26',
    courseName: 'Operating Systems',
    courseCode: 'CS 301',
    title: 'Lab 3: Virtual Memory Page Replacement',
    type: 'ASSIGNMENT',
    dueDate: getRelativeDate(8), // Due in 8 hours (Today)
    url: 'https://learn.blackboard.com/ultra/courses/_cs301/outline/assessment/_101/overview',
    isCompleted: false,
    source: 'BLACKBOARD',
    lastSynced: new Date().toISOString(),
    points: 100,
    description: 'Implement LRU and Second-Chance page replacement policies in C. Submit via tar.gz.',
    subtasks: [
      { id: 'sub_1', title: 'Implement FIFO baseline', completed: true },
      { id: 'sub_2', title: 'Implement LRU page fault counter', completed: false },
      { id: 'sub_3', title: 'Benchmarking and report plots', completed: false }
    ]
  },
  {
    id: 'bb_item_102',
    courseId: 'MATH240_FALL26',
    courseName: 'Linear Algebra & Diff Eq',
    courseCode: 'MATH 240',
    title: 'Quiz 4: Eigenvalues & Diagonalization',
    type: 'QUIZ_TEST',
    dueDate: getRelativeDate(20), // Due in 20 hours (Today)
    url: 'https://learn.blackboard.com/ultra/courses/_math240/outline/assessment/_102/overview',
    isCompleted: false,
    source: 'BLACKBOARD',
    lastSynced: new Date().toISOString(),
    points: 30,
    description: 'Timed 45-minute quiz. Covers Sections 5.1 to 5.4. One attempt allowed.'
  },
  {
    id: 'bb_item_103',
    courseId: 'CS350_FALL26',
    courseName: 'Design & Analysis of Algorithms',
    courseCode: 'CS 350',
    title: 'Problem Set 3: Dynamic Programming',
    type: 'ASSIGNMENT',
    dueDate: getRelativeDate(-14), // Overdue by 14 hours
    url: 'https://learn.blackboard.com/ultra/courses/_cs350/outline/assessment/_103/overview',
    isCompleted: false,
    source: 'BLACKBOARD',
    lastSynced: new Date().toISOString(),
    points: 50,
    description: 'Solve problems on Bellman-Ford, Floyd-Warshall, and Knapsack variations.'
  },
  {
    id: 'bb_item_104',
    courseId: 'CS388_FALL26',
    courseName: 'Human-Computer Interaction',
    courseCode: 'CS 388',
    title: 'Discussion: Usability Evaluation of LMS Interfaces',
    type: 'DISCUSSION',
    dueDate: getRelativeDate(48), // Due in 2 days (Soon)
    url: 'https://learn.blackboard.com/ultra/courses/_cs388/discussion/_104',
    isCompleted: false,
    source: 'BLACKBOARD',
    lastSynced: new Date().toISOString(),
    points: 20,
    description: 'Post an initial critique of Blackboard Ultra mobile responsive layout, then reply to 2 peers.'
  },
  {
    id: 'bb_item_105',
    courseId: 'HIST115_FALL26',
    courseName: 'Modern Global History',
    courseCode: 'HIST 115',
    title: 'Primary Source Analysis Essay Draft',
    type: 'ASSIGNMENT',
    dueDate: getRelativeDate(96), // Due in 4 days (This week)
    url: 'https://learn.blackboard.com/ultra/courses/_hist115/outline/assessment/_105/overview',
    isCompleted: false,
    source: 'BLACKBOARD',
    lastSynced: new Date().toISOString(),
    points: 75,
    description: '3-4 page critical reflection analyzing declassified Cold War communications.'
  },
  {
    id: 'bb_item_106',
    courseId: 'CS301_FALL26',
    courseName: 'Operating Systems',
    courseCode: 'CS 301',
    title: 'Midterm Exam Preparation Checklist',
    type: 'CUSTOM_TASK',
    dueDate: getRelativeDate(140), // Due in ~6 days
    isCompleted: false,
    source: 'MANUAL',
    lastSynced: new Date().toISOString(),
    description: 'Review Chapter 7 deadlock avoidance banker algorithm and practice 2025 exam problems.',
    subtasks: [
      { id: 'sub_4', title: 'Review memory hierarchy slides', completed: true },
      { id: 'sub_5', title: 'Solve Deadlock Peterson algorithm practice problem', completed: false }
    ]
  },
  {
    id: 'bb_item_107',
    courseId: 'CS350_FALL26',
    courseName: 'Design & Analysis of Algorithms',
    courseCode: 'CS 350',
    title: 'Problem Set 2: Divide and Conquer',
    type: 'ASSIGNMENT',
    dueDate: getRelativeDate(-72), // Completed past task
    url: 'https://learn.blackboard.com/ultra/courses/_cs350/outline/assessment/_107/overview',
    isCompleted: true,
    completedAt: getRelativeDate(-70),
    source: 'BLACKBOARD',
    lastSynced: new Date().toISOString(),
    points: 50,
    description: 'Master theorem proofs and Strassen matrix multiplication.'
  }
];
