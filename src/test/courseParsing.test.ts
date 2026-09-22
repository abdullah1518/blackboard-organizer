import {
  extractCourseAndTitle,
  isNumericalOrInternalCode,
  parseBlackboardCourseString
} from '../services/blackboardApi';
import { getDisplayCourseName, getDisplayCourseTooltip } from '../components/TaskItem';

function runCourseParsingTests() {
  console.log('🧪 Starting Blackboard Course Title & Code Extraction Tests...\n');

  // Test 1: Numerical and internal code detection
  if (!isNumericalOrInternalCode('_12345_1')) throw new Error('_12345_1 should be detected as internal code');
  if (!isNumericalOrInternalCode('10482')) throw new Error('10482 should be detected as numerical code');
  if (!isNumericalOrInternalCode('202610_58291')) throw new Error('202610_58291 should be detected as internal CRN code');
  if (!isNumericalOrInternalCode('12789.202610.LEC')) throw new Error('12789.202610.LEC should be detected as internal CRN code');
  if (!isNumericalOrInternalCode('10920.202610.LEC')) throw new Error('10920.202610.LEC should be detected as internal CRN code');
  if (!isNumericalOrInternalCode('Course')) throw new Error("'Course' should be detected as fallback placeholder");
  if (isNumericalOrInternalCode('BUS 200')) throw new Error('BUS 200 is a valid course code, not numerical');
  if (isNumericalOrInternalCode('Operating Systems')) throw new Error('Operating Systems is a valid course title');
  console.log('✅ Test 1: isNumericalOrInternalCode correctly identifies internal DB keys, CRNs, and "Course"');

  // Test 2: Banner pattern 1: "261-BUS-200-04(Business & Entrepreneurship-LEC)"
  const busCourse = parseBlackboardCourseString('261-BUS-200-04(Business & Entrepreneurship-LEC)');
  if (busCourse.code !== 'BUS 200') throw new Error(`Expected 'BUS 200', got ${busCourse.code}`);
  if (busCourse.name !== 'Business & Entrepreneurship') throw new Error(`Expected 'Business & Entrepreneurship', got ${busCourse.name}`);
  console.log('✅ Test 2: "261-BUS-200-04(Business & Entrepreneurship-LEC)" parsed to BUS 200 & Business & Entrepreneurship');

  // Test 3: Banner pattern 2: "261-ENGL-214 [Common: All Students]"
  const englCommon = parseBlackboardCourseString('261-ENGL-214 [Common: All Students]');
  if (englCommon.code !== 'ENGL 214') throw new Error(`Expected 'ENGL 214', got ${englCommon.code}`);
  if (englCommon.name !== 'Common: All Students') throw new Error(`Expected 'Common: All Students', got ${englCommon.name}`);
  console.log('✅ Test 3: "261-ENGL-214 [Common: All Students]" parsed to ENGL 214 & Common: All Students');

  // Test 4: Banner pattern 3: "261-ENGL-214-14(Academic & Professional Comm)[Active Learning]"
  const englActive = parseBlackboardCourseString('261-ENGL-214-14(Academic & Professional Comm)[Active Learning]');
  if (englActive.code !== 'ENGL 214') throw new Error(`Expected 'ENGL 214', got ${englActive.code}`);
  if (englActive.name !== 'Academic & Professional Comm') throw new Error(`Expected 'Academic & Professional Comm', got ${englActive.name}`);
  console.log('✅ Test 4: "261-ENGL-214-14(Academic & Professional Comm)[Active Learning]" parsed to ENGL 214 & Academic & Professional Comm');

  // Test 5: Banner pattern 4: "261-ICS-381-01(Princ. Artificial Intelligence)"
  const icsCourse = parseBlackboardCourseString('261-ICS-381-01(Princ. Artificial Intelligence)');
  if (icsCourse.code !== 'ICS 381') throw new Error(`Expected 'ICS 381', got ${icsCourse.code}`);
  if (icsCourse.name !== 'Princ. Artificial Intelligence') throw new Error(`Expected 'Princ. Artificial Intelligence', got ${icsCourse.name}`);
  console.log('✅ Test 5: "261-ICS-381-01(Princ. Artificial Intelligence)" parsed to ICS 381 & Princ. Artificial Intelligence');

  // Test 6: Banner pattern 5: "261-SWE-387-01(Software Project Management)"
  const sweCourse = parseBlackboardCourseString('261-SWE-387-01(Software Project Management)');
  if (sweCourse.code !== 'SWE 387') throw new Error(`Expected 'SWE 387', got ${sweCourse.code}`);
  if (sweCourse.name !== 'Software Project Management') throw new Error(`Expected 'Software Project Management', got ${sweCourse.name}`);
  console.log('✅ Test 6: "261-SWE-387-01(Software Project Management)" parsed to SWE 387 & Software Project Management');

  // Test 7: Banner slug: "261-ENGL-214-common-eld-coordinated"
  const englSlug = parseBlackboardCourseString('261-ENGL-214-common-eld-coordinated');
  if (englSlug.code !== 'ENGL 214') throw new Error(`Expected 'ENGL 214', got ${englSlug.code}`);
  if (englSlug.name !== 'Common Eld Coordinated') throw new Error(`Expected 'Common Eld Coordinated', got ${englSlug.name}`);
  console.log('✅ Test 7: "261-ENGL-214-common-eld-coordinated" parsed to ENGL 214 & Common Eld Coordinated');

  // Test 8: Standalone compact codes: engl214, bus200, ics381, swe387
  if (parseBlackboardCourseString('engl214').code !== 'ENGL 214') throw new Error('engl214 failed');
  if (parseBlackboardCourseString('bus200').code !== 'BUS 200') throw new Error('bus200 failed');
  if (parseBlackboardCourseString('ics381').code !== 'ICS 381') throw new Error('ics381 failed');
  if (parseBlackboardCourseString('swe387').code !== 'SWE 387') throw new Error('swe387 failed');
  console.log('✅ Test 8: Compact codes "engl214", "bus200", "ics381", "swe387" correctly parsed to "ENGL 214", etc.');

  // Test 9: extractCourseAndTitle with Banner calendar name
  const taskWithBanner = extractCourseAndTitle('Homework 1', '_39482_1', '261-BUS-200-04(Business & Entrepreneurship-LEC)');
  if (taskWithBanner.courseCode !== 'BUS 200') throw new Error(`Expected 'BUS 200', got ${taskWithBanner.courseCode}`);
  if (taskWithBanner.courseName !== 'Business & Entrepreneurship') throw new Error(`Expected 'Business & Entrepreneurship', got ${taskWithBanner.courseName}`);
  if (taskWithBanner.cleanTitle !== 'Homework 1') throw new Error(`Expected cleanTitle 'Homework 1', got ${taskWithBanner.cleanTitle}`);
  console.log('✅ Test 9: extractCourseAndTitle with Banner calendar name extracted clean code and name');

  // Test 10: Bracketed prefix "[CS301 - Operating Systems] Lab 3: Page Replacement"
  const case1 = extractCourseAndTitle('[CS301 - Operating Systems] Lab 3: Page Replacement', '_58291_1', '58291');
  if (case1.courseCode !== 'CS 301' && case1.courseCode !== 'CS301') throw new Error(`Expected courseCode CS 301, got ${case1.courseCode}`);
  if (case1.courseName !== 'Operating Systems') throw new Error(`Expected courseName Operating Systems, got ${case1.courseName}`);
  if (case1.cleanTitle !== 'Lab 3: Page Replacement') throw new Error(`Expected cleanTitle 'Lab 3: Page Replacement', got ${case1.cleanTitle}`);
  console.log('✅ Test 10: Bracketed prefix "[CS301 - Operating Systems]" correctly extracted');

  // Test 11: Colon separator "CS 301: Assignment 1 - CPU Scheduling"
  const case3 = extractCourseAndTitle('CS 301: Assignment 1 - CPU Scheduling', '10482', '10482');
  if (case3.courseCode !== 'CS 301') throw new Error(`Expected courseCode CS 301, got ${case3.courseCode}`);
  if (case3.cleanTitle !== 'Assignment 1 - CPU Scheduling') throw new Error(`Expected cleanTitle 'Assignment 1 - CPU Scheduling', got ${case3.cleanTitle}`);
  console.log('✅ Test 11: Colon separated course code "CS 301: Assignment 1" correctly extracted');

  // Test 12: getDisplayCourseName on task with banner courseId
  const testTask = {
    courseId: '261-SWE-387-01(Software Project Management)',
    courseName: 'Course',
    courseCode: 'Course',
    title: 'Deliverable 1'
  };
  const display = getDisplayCourseName(undefined, testTask);
  if (display !== 'SWE 387') {
    throw new Error(`getDisplayCourseName should have parsed 'SWE 387' from task.courseId, got ${display}`);
  }
  console.log('✅ Test 12: getDisplayCourseName correctly parsed "SWE 387" from task with "Course" defaults');

  // Test 13: getDisplayCourseTooltip formats full name
  const courseObj = {
    id: '_123_1',
    code: 'BUS 200',
    name: 'Business & Entrepreneurship',
    color: '#3B82F6'
  };
  const tooltip = getDisplayCourseTooltip(courseObj);
  if (tooltip !== 'BUS 200 - Business & Entrepreneurship') {
    throw new Error(`Expected 'BUS 200 - Business & Entrepreneurship', got ${tooltip}`);
  }
  console.log('✅ Test 13: getDisplayCourseTooltip correctly generated "BUS 200 - Business & Entrepreneurship"');

  console.log('\n🎉 ALL 13 COURSE PARSING & TITLE EXTRACTION TESTS PASSED!\n');
}

runCourseParsingTests();
