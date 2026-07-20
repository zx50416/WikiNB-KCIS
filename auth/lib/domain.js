/**
 * 僅允許學校網域信箱（預設 kcis.com.tw）
 */
export function normalizeEmail(email) {
  return String(email || '')
    .trim()
    .toLowerCase();
}

export function getAllowedDomain() {
  return String(process.env.ALLOWED_EMAIL_DOMAIN || 'kcis.com.tw')
    .trim()
    .toLowerCase()
    .replace(/^@/, '');
}

export function isAllowedSchoolEmail(email) {
  const normalized = normalizeEmail(email);
  const domain = getAllowedDomain();
  if (!normalized.includes('@')) return false;
  return normalized.endsWith(`@${domain}`);
}

export function rejectReasonForEmail(email) {
  const domain = getAllowedDomain();
  if (!email) return `請使用 @${domain} 學校 Google 帳號登入`;
  if (!isAllowedSchoolEmail(email)) {
    return `僅限 @${domain} 信箱。目前帳號不被允許註冊或登入。`;
  }
  return null;
}
