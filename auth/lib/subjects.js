/**
 * 預設科目／處室（老師必選）
 * keywords 順序：科目或處室 → 老師暱稱（由 ensureFrontmatter 組裝）
 */
export const SUBJECT_CATALOG = [
  { id: 'math', name: '數學', nameEn: 'Math' },
  { id: 'english', name: '英文', nameEn: 'English' },
  { id: 'chinese', name: '國文', nameEn: 'Chinese' },
  { id: 'science', name: '自然', nameEn: 'Science' },
  { id: 'social', name: '社會', nameEn: 'Social Studies' },
  { id: 'pe', name: '體育', nameEn: 'PE' },
  { id: 'art', name: '藝術', nameEn: 'Art' },
  { id: 'music', name: '音樂', nameEn: 'Music' },
  { id: 'it', name: '資訊處', nameEn: 'IT Office' },
  { id: 'academic', name: '教務處', nameEn: 'Academic Affairs' },
  { id: 'student-affairs', name: '學務處', nameEn: 'Student Affairs' },
  { id: 'general', name: '一般筆記', nameEn: 'General' },
];

export function getSubjectCatalog() {
  return SUBJECT_CATALOG.map((s) => ({ ...s }));
}

export function findSubjectInCatalog(subjectId) {
  const key = String(subjectId || '')
    .trim()
    .toLowerCase();
  return SUBJECT_CATALOG.find((s) => s.id === key) || null;
}
