import { StorageService } from '../services/storage';
import { stripHtml } from '../services/blackboardApi';
import { formatAnnouncementDate } from '../components/AnnouncementCard';
import { Announcement } from '../types/task';

async function runAnnouncementsTests() {
  console.log('🧪 Starting Announcements Feature Test Suite...\n');

  // 1. Test stripHtml
  const dirtyHtml = '<p>Hello <b>Students</b>,<br/>Please note that <i>Bldg 24</i> &amp; Room 120 is booked.&nbsp;</p>';
  const cleanText = stripHtml(dirtyHtml);
  console.log('1. stripHtml output:\n', cleanText);
  if (cleanText.includes('<') || cleanText.includes('>')) throw new Error('stripHtml should remove all HTML tags');
  if (!cleanText.includes('Bldg 24 & Room 120')) throw new Error('stripHtml should decode &amp; and &nbsp;');
  if (!cleanText.includes('Hello Students')) throw new Error('stripHtml should extract text content');
  console.log('✅ Test 1: stripHtml properly strips tags and decodes HTML entities');

  // 2. Test formatAnnouncementDate
  const now = new Date();
  const tenMinsAgo = new Date(now.getTime() - 10 * 60 * 1000).toISOString();
  const threeHoursAgo = new Date(now.getTime() - 3 * 60 * 60 * 1000).toISOString();
  if (!formatAnnouncementDate(tenMinsAgo).includes('10m ago')) {
    throw new Error('formatAnnouncementDate should return minutes ago');
  }
  if (!formatAnnouncementDate(threeHoursAgo).includes('3h ago')) {
    throw new Error('formatAnnouncementDate should return hours ago');
  }
  console.log('✅ Test 2: formatAnnouncementDate formats relative times accurately');

  // 3. Test StorageService getAnnouncements
  await StorageService.resetToMockData();
  let announcements = await StorageService.getAnnouncements();
  console.log('3. Initial announcements count:', announcements.length);
  if (announcements.length === 0) throw new Error('Expected initial demo announcements to be present');
  console.log('✅ Test 3: StorageService loads initial announcements');

  // 4. Test markAnnouncementRead
  const firstAnn = announcements[0];
  await StorageService.markAnnouncementRead(firstAnn.id, true);
  announcements = await StorageService.getAnnouncements();
  const updatedFirst = announcements.find((a) => a.id === firstAnn.id);
  if (!updatedFirst?.isRead) throw new Error('Announcement should be marked as read');
  console.log('✅ Test 4: markAnnouncementRead correctly updates isRead status');

  // 5. Test markAllAnnouncementsRead
  await StorageService.markAllAnnouncementsRead();
  announcements = await StorageService.getAnnouncements();
  const unreadCount = announcements.filter((a) => !a.isRead).length;
  if (unreadCount !== 0) throw new Error(`Expected 0 unread announcements, found ${unreadCount}`);
  console.log('✅ Test 5: markAllAnnouncementsRead marks all as read');

  // 6. Test upsertAnnouncements preserves isRead state
  const newAnnouncement: Announcement = {
    id: 'test_ann_999',
    courseId: 'CS301_FALL26',
    courseName: 'Operating Systems',
    courseCode: 'CS 301',
    title: 'Lab 4 Announcement',
    content: 'Lab 4 has been posted.',
    created: new Date().toISOString(),
    isRead: false,
    lastSynced: new Date().toISOString()
  };

  const upsertRes = await StorageService.upsertAnnouncements([newAnnouncement, firstAnn]);
  console.log('6. upsertAnnouncements result:', upsertRes);
  announcements = await StorageService.getAnnouncements();
  const verifiedFirst = announcements.find((a) => a.id === firstAnn.id);
  if (!verifiedFirst?.isRead) throw new Error('upsertAnnouncements should preserve previous isRead state');
  const verifiedNew = announcements.find((a) => a.id === 'test_ann_999');
  if (!verifiedNew) throw new Error('upsertAnnouncements should add new announcement');
  console.log('✅ Test 6: upsertAnnouncements preserves read states and adds new items');

  console.log('\n🎉 ALL ANNOUNCEMENTS TESTS PASSED!\n');
}

runAnnouncementsTests();
