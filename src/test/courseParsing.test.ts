import { extractCourseAndTitle, isNumericalOrInternalCode } from '../services/blackboardApi';
import { getDisplayCourseName } from '../components/TaskItem';

function runCourseParsingTests() {
  console.log('🧪 Starting Blackboard Course Title & Code Extraction Tests...\n');

  // Test 1: Numerical and internal code detection
  if (!isNumericalOrInternalCode('_12345_1')) throw new Error('_12345_1 should be detected as internal code');
  if (!isNumericalOrInternalCode('10482')) throw new Error('10482 should be detected as numerical code');
  if (!isNumericalOrInternalCode('202610_58291')) throw new Error('202610_58291 should be detected as internal CRN code');
  if (isNumericalOrInternalCode('CS 301')) throw new Error('CS 301 is a valid course code, not numerical');
  if (isNumericalOrInternalCode('Operating Systems')) throw new Error('Operating Systems is a valid course title');
  console.log('✅ Test 1: isNumericalOrInternalCode correctly identifies internal DB keys and CRNs');

  // Test 2: Bracketed prefix "[CS301 - Operating Systems] Lab 3: Page Replacement"
  const case1 = extractCourseAndTitle('[CS301 - Operating Systems] Lab 3: Page Replacement', '_58291_1', '58291');
  if (case1.courseCode !== 'CS301') throw new Error(`Expected courseCode CS301, got ${case1.courseCode}`);
  if (case1.courseName !== 'Operating Systems') throw new Error(`Expected courseName Operating Systems, got ${case1.courseName}`);
  if (case1.cleanTitle !== 'Lab 3: Page Replacement') throw new Error(`Expected cleanTitle 'Lab 3: Page Replacement', got ${case1.cleanTitle}`);
  console.log('✅ Test 2: Bracketed prefix "[CS301 - Operating Systems]" correctly extracted course name & code');

  // Test 3: Bracketed course title only "[Operating Systems] Lab 3" with numerical Blackboard ID
  const case2 = extractCourseAndTitle('[Operating Systems] Lab 3', '_9999_1', '9999');
  if (case2.courseName !== 'Operating Systems') throw new Error(`Expected courseName Operating Systems, got ${case2.courseName}`);
  if (case2.cleanTitle !== 'Lab 3') throw new Error(`Expected cleanTitle 'Lab 3', got ${case2.cleanTitle}`);
  console.log('✅ Test 3: Bracketed course title "[Operating Systems]" correctly extracted');

  // Test 4: Colon separator "CS 301: Assignment 1 - CPU Scheduling"
  const case3 = extractCourseAndTitle('CS 301: Assignment 1 - CPU Scheduling', '10482', '10482');
  if (case3.courseCode !== 'CS 301') throw new Error(`Expected courseCode CS 301, got ${case3.courseCode}`);
  if (case3.cleanTitle !== 'Assignment 1 - CPU Scheduling') throw new Error(`Expected cleanTitle 'Assignment 1 - CPU Scheduling', got ${case3.cleanTitle}`);
  console.log('✅ Test 4: Colon separated course code "CS 301: Assignment 1" correctly extracted');

  // Test 5: Dash separator "Linear Algebra - Homework 4"
  const case4 = extractCourseAndTitle('Linear Algebra - Homework 4', '_1234_1', '_1234_1');
  if (case4.courseName !== 'Linear Algebra') throw new Error(`Expected courseName Linear Algebra, got ${case4.courseName}`);
  if (case4.cleanTitle !== 'Homework 4') throw new Error(`Expected cleanTitle 'Homework 4', got ${case4.cleanTitle}`);
  console.log('✅ Test 5: Dash separated course title "Linear Algebra - Homework 4" correctly extracted');

  // Test 6: Parentheses course code "Quiz 4: Diagonalization (MATH 240)"
  const case5 = extractCourseAndTitle('Quiz 4: Diagonalization (MATH 240)', '202610_3948', '3948');
  if (case5.courseCode !== 'MATH 240') throw new Error(`Expected courseCode MATH 240, got ${case5.courseCode}`);
  if (case5.cleanTitle !== 'Quiz 4: Diagonalization') throw new Error(`Expected cleanTitle 'Quiz 4: Diagonalization', got ${case5.cleanTitle}`);
  console.log('✅ Test 6: Parenthesized course code "(MATH 240)" correctly extracted');

  // Test 7: Triple pattern "CHEM 101 - General Chemistry: Exam 1"
  const case6 = extractCourseAndTitle('CHEM 101 - General Chemistry: Exam 1', '_777_1', '777');
  if (case6.courseCode !== 'CHEM 101') throw new Error(`Expected courseCode CHEM 101, got ${case6.courseCode}`);
  if (case6.courseName !== 'General Chemistry') throw new Error(`Expected courseName General Chemistry, got ${case6.courseName}`);
  if (case6.cleanTitle !== 'Exam 1') throw new Error(`Expected cleanTitle 'Exam 1', got ${case6.cleanTitle}`);
  console.log('✅ Test 7: Triple pattern "CHEM 101 - General Chemistry: Exam 1" correctly extracted');

  // Test 8: UI Display helper getDisplayCourseName prevents numerical code rendering
  const testCourseWithNumericCode = {
    id: '_12345_1',
    code: '10482', // Numerical CRN
    name: 'Operating Systems',
    color: '#3B82F6'
  };
  const display = getDisplayCourseName(testCourseWithNumericCode);
  if (display !== 'Operating Systems') {
    throw new Error(`getDisplayCourseName should have preferred 'Operating Systems' over numerical '10482', got ${display}`);
  }
  console.log('✅ Test 8: getDisplayCourseName correctly displays "Operating Systems" instead of numerical code "10482"');

  console.log('\n🎉 ALL COURSE PARSING & TITLE EXTRACTION TESTS PASSED!\n');
}

runCourseParsingTests();
