import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import bcrypt from 'bcryptjs';
import { normalizeEmail } from './domain.js';
import { effectiveRosterEntry, isTeacherRole } from './account.js';
import { validateNickname, assertTeacherNicknameAvailable } from './nickname.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, '..', 'data');
const USERS_FILE = path.join(DATA_DIR, 'users.json');

function ensureStore() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(USERS_FILE)) {
    fs.writeFileSync(USERS_FILE, JSON.stringify({ users: [] }, null, 2), 'utf8');
  }
}

function readStore() {
  ensureStore();
  try {
    return JSON.parse(fs.readFileSync(USERS_FILE, 'utf8'));
  } catch {
    return { users: [] };
  }
}

function writeStore(store) {
  ensureStore();
  fs.writeFileSync(USERS_FILE, JSON.stringify(store, null, 2), 'utf8');
}

export function findUserByEmail(email) {
  const key = normalizeEmail(email);
  return readStore().users.find((u) => normalizeEmail(u.email) === key) || null;
}

export function publicUser(user) {
  if (!user) return null;
  const { passwordHash, ...rest } = user;
  return rest;
}

/** 從 roster／網域規則建立／更新使用者殼 */
export function ensureUserFromRoster(rosterEntry) {
  const effective = effectiveRosterEntry(rosterEntry, rosterEntry.email) || rosterEntry;
  const store = readStore();
  const key = normalizeEmail(effective.email);
  const now = new Date().toISOString();
  let user = store.users.find((u) => normalizeEmail(u.email) === key);

  if (!user) {
    user = {
      email: key,
      name: effective.name || key,
      nickname: effective.nickname || '',
      role: effective.role || 'student',
      teacherId: effective.teacherId || '',
      passwordHash: '',
      passwordSetAt: null,
      verifiedAt: null,
      createdAt: now,
      updatedAt: now,
      lastLoginAt: null,
    };
    store.users.push(user);
  } else {
    user.name = effective.name || user.name;
    // 角色以 roster／規則為準（管理員改 student→teacher 會反映進來）
    user.role = effective.role || user.role;
    if (effective.teacherId) user.teacherId = effective.teacherId;
    else if (!isTeacherRole(user.role)) user.teacherId = '';
    user.updatedAt = now;
  }

  writeStore(store);
  return { ...user };
}

export async function setPassword(email, password, { nickname } = {}) {
  const store = readStore();
  const key = normalizeEmail(email);
  const user = store.users.find((u) => normalizeEmail(u.email) === key);
  if (!user) throw new Error('找不到使用者');

  if (nickname !== undefined) {
    const checked = validateNickname(nickname);
    if (!checked.ok) throw new Error(checked.error);
    if (!user.nickname) {
      if (isTeacherRole(user.role)) {
        assertTeacherNicknameAvailable(store.users, checked.nickname, key);
      }
      user.nickname = checked.nickname;
    }
  }

  const firstTime = !user.nickname && !user.verifiedAt;
  if (firstTime && !user.nickname) {
    throw new Error('首次設定請填寫暱稱（顯示名稱）');
  }

  user.passwordHash = await bcrypt.hash(String(password), 10);
  user.passwordSetAt = new Date().toISOString();
  user.verifiedAt = user.verifiedAt || user.passwordSetAt;
  user.updatedAt = user.passwordSetAt;
  writeStore(store);
  return publicUser(user);
}

/** 驗證碼登入完成：寫入暱稱（首次）並標記已驗證 */
export function completeOtpLogin(email, { nickname } = {}) {
  const store = readStore();
  const key = normalizeEmail(email);
  const user = store.users.find((u) => normalizeEmail(u.email) === key);
  if (!user) throw new Error('找不到使用者');

  const now = new Date().toISOString();
  if (!user.nickname) {
    const checked = validateNickname(nickname || '');
    if (!checked.ok) throw new Error(checked.error);
    if (isTeacherRole(user.role)) {
      assertTeacherNicknameAvailable(store.users, checked.nickname, key);
    }
    user.nickname = checked.nickname;
  }

  user.verifiedAt = user.verifiedAt || now;
  user.lastLoginAt = now;
  user.updatedAt = now;
  writeStore(store);
  return publicUser(user);
}

export function updateNickname(email, nickname) {
  const checked = validateNickname(nickname);
  if (!checked.ok) throw new Error(checked.error);

  const store = readStore();
  const key = normalizeEmail(email);
  const user = store.users.find((u) => normalizeEmail(u.email) === key);
  if (!user) throw new Error('找不到使用者');

  if (isTeacherRole(user.role)) {
    assertTeacherNicknameAvailable(store.users, checked.nickname, key);
  }

  user.nickname = checked.nickname;
  user.updatedAt = new Date().toISOString();
  writeStore(store);
  return publicUser(user);
}

export async function verifyPassword(email, password) {
  const user = findUserByEmail(email);
  if (!user?.passwordHash) return null;
  const ok = await bcrypt.compare(String(password || ''), user.passwordHash);
  if (!ok) return null;
  const store = readStore();
  const key = normalizeEmail(email);
  const row = store.users.find((u) => normalizeEmail(u.email) === key);
  if (row) {
    row.lastLoginAt = new Date().toISOString();
    writeStore(store);
  }
  return publicUser(row || user);
}

export function hasPassword(email) {
  const user = findUserByEmail(email);
  return Boolean(user?.passwordHash);
}

/** 帳號就緒：已有暱稱（驗證碼登入為主；舊密碼帳號亦相容） */
export function isAccountReady(email) {
  const user = findUserByEmail(email);
  if (!user) return false;
  if (!String(user.nickname || '').trim()) return false;
  return Boolean(user.verifiedAt || user.passwordHash);
}

export function needsNicknameSetup(email) {
  const user = findUserByEmail(email);
  return !String(user?.nickname || '').trim();
}

export function listUsers() {
  return readStore().users.map(publicUser);
}

export function getUsersFilePath() {
  ensureStore();
  return USERS_FILE;
}
