import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import bcrypt from 'bcryptjs';
import { normalizeEmail } from './domain.js';

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

/** 從 roster 建立／更新使用者殼（尚未設密碼） */
export function ensureUserFromRoster(rosterEntry) {
  const store = readStore();
  const key = normalizeEmail(rosterEntry.email);
  const now = new Date().toISOString();
  let user = store.users.find((u) => normalizeEmail(u.email) === key);

  if (!user) {
    user = {
      email: key,
      name: rosterEntry.name || key,
      role: rosterEntry.role || 'student',
      teacherId: rosterEntry.teacherId || '',
      passwordHash: '',
      passwordSetAt: null,
      createdAt: now,
      updatedAt: now,
      lastLoginAt: null,
    };
    store.users.push(user);
  } else {
    user.name = rosterEntry.name || user.name;
    user.role = rosterEntry.role || user.role;
    if (rosterEntry.teacherId) user.teacherId = rosterEntry.teacherId;
    user.updatedAt = now;
  }

  writeStore(store);
  return { ...user };
}

export async function setPassword(email, password) {
  const store = readStore();
  const key = normalizeEmail(email);
  const user = store.users.find((u) => normalizeEmail(u.email) === key);
  if (!user) throw new Error('找不到使用者');
  user.passwordHash = await bcrypt.hash(String(password), 10);
  user.passwordSetAt = new Date().toISOString();
  user.updatedAt = user.passwordSetAt;
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

export function listUsers() {
  return readStore().users.map(publicUser);
}

export function getUsersFilePath() {
  ensureStore();
  return USERS_FILE;
}
