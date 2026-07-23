/**
 * 角色覆寫名單（roster）
 * - 登入資格改由 domain.js（網域／例外信箱）決定
 * - roster 用來標註 teacher／admin，或把誤標學生改回老師
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { isAllowedLoginEmail, normalizeEmail } from './domain.js';
import { effectiveRosterEntry } from './account.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, '..', 'data');
const ROSTER_FILE = path.join(DATA_DIR, 'roster.json');
const EXAMPLE_FILE = path.join(DATA_DIR, 'roster.example.json');

function ensureRoster() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(ROSTER_FILE) && fs.existsSync(EXAMPLE_FILE)) {
    fs.copyFileSync(EXAMPLE_FILE, ROSTER_FILE);
  }
  if (!fs.existsSync(ROSTER_FILE)) {
    fs.writeFileSync(ROSTER_FILE, '[]', 'utf8');
  }
}

export function loadRoster() {
  ensureRoster();
  try {
    const raw = JSON.parse(fs.readFileSync(ROSTER_FILE, 'utf8'));
    return Array.isArray(raw) ? raw : [];
  } catch {
    return [];
  }
}

export function findRosterEntry(email) {
  const key = normalizeEmail(email);
  return (
    loadRoster().find((row) => normalizeEmail(row.email) === key) || null
  );
}

/** @deprecated 改用 isAllowedToLogin；保留相容 */
export function isPreApproved(email) {
  return isAllowedToLogin(email);
}

export function isAllowedToLogin(email) {
  return isAllowedLoginEmail(email);
}

/** 取得可登入者的有效開通資料（含無名單的學校信箱） */
export function resolveLoginRoster(email) {
  if (!isAllowedToLogin(email)) return null;
  return effectiveRosterEntry(findRosterEntry(email), email);
}

export function getRosterPath() {
  ensureRoster();
  return ROSTER_FILE;
}
