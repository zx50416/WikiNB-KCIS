/**
 * 預核名單（roster）— 只有名單內帳號可收驗證碼／設密碼／登入
 * 正式環境可由 Google Workspace 或 CSV 同步；測試用 JSON。
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { normalizeEmail } from './domain.js';

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

export function isPreApproved(email) {
  return Boolean(findRosterEntry(email));
}

export function getRosterPath() {
  ensureRoster();
  return ROSTER_FILE;
}
