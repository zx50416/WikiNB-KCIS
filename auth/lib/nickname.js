/**
 * 暱稱規則：中文、英文字母、底線 _、半形句點 .
 * 長度 2～20
 * 老師／管理員暱稱不可與其他老師重複；學生暱稱不檢查唯一
 */
import { isTeacherRole } from './account.js';
import { normalizeEmail } from './domain.js';

export const NICKNAME_MIN = 2;
export const NICKNAME_MAX = 20;
export const NICKNAME_PATTERN = /^[\u4e00-\u9fffA-Za-z_.]+$/;

export const NICKNAME_HINT_ZH =
  '僅允許中文、英文、( _  . )；長度限制2至20個字元。';
export const NICKNAME_HINT_EN =
  'Only Chinese, English letters, ( _  . ) are allowed; length 2–20 characters.';

export const NICKNAME_TAKEN_ZH = '此暱稱已被其他老師使用，請換一個。';
export const NICKNAME_TAKEN_EN = 'This display name is already used by another teacher.';

export function normalizeNicknameKey(nickname) {
  return String(nickname || '')
    .trim()
    .toLowerCase();
}

export function validateNickname(raw) {
  const nickname = String(raw || '').trim();
  if (!nickname) {
    return { ok: false, error: '請填寫暱稱 / Please enter a display name', nickname: '' };
  }
  if (nickname.length < NICKNAME_MIN || nickname.length > NICKNAME_MAX) {
    return {
      ok: false,
      error: NICKNAME_HINT_ZH,
      nickname,
    };
  }
  if (!NICKNAME_PATTERN.test(nickname)) {
    return {
      ok: false,
      error: NICKNAME_HINT_ZH,
      nickname,
    };
  }
  return { ok: true, nickname, error: null };
}

/**
 * 僅老師／管理員彼此不可撞名；學生不參與唯一檢查。
 */
export function findTeacherNicknameConflict(users, nickname, excludeEmail = '') {
  const key = normalizeNicknameKey(nickname);
  if (!key) return null;
  const self = normalizeEmail(excludeEmail);
  return (
    (users || []).find((u) => {
      if (!isTeacherRole(u?.role)) return false;
      if (self && normalizeEmail(u.email) === self) return false;
      return normalizeNicknameKey(u.nickname) === key;
    }) || null
  );
}

export function assertTeacherNicknameAvailable(users, nickname, excludeEmail = '') {
  const clash = findTeacherNicknameConflict(users, nickname, excludeEmail);
  if (clash) {
    throw new Error(`${NICKNAME_TAKEN_ZH} / ${NICKNAME_TAKEN_EN}`);
  }
}
