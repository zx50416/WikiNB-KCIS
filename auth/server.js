import cors from 'cors';
import cookieParser from 'cookie-parser';
import dotenv from 'dotenv';
import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { normalizeEmail } from './lib/domain.js';
import { chatOnce, chatStream, getModelsPayload, stopJob } from './lib/llm.js';
import { createLoginCode, checkLoginCode, sendCodeEmail, verifyLoginCode } from './lib/mail-code.js';
import { findRosterEntry, getRosterPath, isPreApproved } from './lib/roster.js';
import {
  createSessionToken,
  getSessionCookieName,
  sessionCookieOptions,
  verifySessionToken,
} from './lib/session.js';
import {
  ensureUserFromRoster,
  getUsersFilePath,
  hasPassword,
  publicUser,
  setPassword,
  verifyPassword,
} from './lib/users.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '.env') });

const PORT = Number(process.env.PORT || 8788);
const PROJECT_ROOT = process.env.PROJECT_ROOT || path.resolve(__dirname, '..');
process.env.PROJECT_ROOT = PROJECT_ROOT;

const app = express();
app.use(express.json({ limit: '2mb' }));
app.use(cookieParser());
const allowedOrigins = [
  process.env.FRONTEND_ORIGIN || 'http://127.0.0.1:4321',
  'http://localhost:4321',
  'http://127.0.0.1:4321',
  'https://zx50416.github.io',
  ...(process.env.FRONTEND_ORIGINS || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),
];

app.use(
  cors({
    origin(origin, cb) {
      if (!origin) {
        cb(null, true);
        return;
      }
      cb(
        null,
        allowedOrigins.some((o) => origin === o || origin.startsWith(o.replace(/\/$/, ''))),
      );
    },
    credentials: true,
  }),
);

/** Chrome Private Network Access：公開 HTTPS 站打本機 Auth 的 preflight */
app.use((req, res, next) => {
  if (req.headers['access-control-request-private-network'] === 'true') {
    res.setHeader('Access-Control-Allow-Private-Network', 'true');
  }
  next();
});

async function readSession(req) {
  return verifySessionToken(req.cookies?.[getSessionCookieName()]);
}

async function requireAuth(req, res, next) {
  const session = await readSession(req);
  if (!session) {
    res.status(401).json({ error: '未登入或 session 已過期' });
    return;
  }
  req.user = session;
  next();
}

app.get('/api/health', (_req, res) => {
  res.json({
    online: true,
    service: 'wikinb-kcis-api',
    authMode: 'roster+password',
    llmProvider: process.env.LLM_PROVIDER || 'codex',
    rosterFile: getRosterPath(),
    usersFile: getUsersFilePath(),
  });
});

app.get('/api/auth/config', (_req, res) => {
  res.json({
    ok: true,
    mode: 'roster',
    message: '僅預核名單帳號可設密碼登入；老師與學生流程相同。',
  });
});

app.get('/api/auth/me', async (req, res) => {
  const session = await readSession(req);
  if (!session) {
    res.status(401).json({ ok: false, authenticated: false });
    return;
  }
  res.json({ ok: true, authenticated: true, user: session });
});

app.post('/api/auth/logout', (_req, res) => {
  res.clearCookie(getSessionCookieName(), { path: '/' });
  res.json({ ok: true });
});

/**
 * 第一步：只送 Email
 * - 不在名單 → 拒絕
 * - 首次（未設密碼）→ 自動寄驗證碼，回 step=setup
 * - 已設密碼 → 回 step=password（前端顯示密碼欄）
 */
app.post('/api/auth/lookup', async (req, res) => {
  try {
    const email = normalizeEmail(req.body?.email);
    if (!email) {
      res.status(400).json({ error: '請輸入 Email' });
      return;
    }
    const roster = findRosterEntry(email);
    if (!roster) {
      res.status(403).json({ error: '此帳號未在預核名單中，請聯繫管理員開通。' });
      return;
    }

    ensureUserFromRoster(roster);
    const ready = hasPassword(email);

    if (ready) {
      res.json({
        ok: true,
        step: 'password',
        email,
        name: roster.name || email,
        message: '請輸入密碼登入',
      });
      return;
    }

    const { code, expiresIn } = createLoginCode(email, 'setup');
    const sendResult = await sendCodeEmail(email, code);
    res.json({
      ok: true,
      step: 'setup',
      email,
      name: roster.name || email,
      expiresIn,
      purpose: 'setup',
      message: sendResult.dev
        ? '首次使用：驗證碼已顯示於 Auth 終端機（未設定 SMTP）'
        : '首次使用：驗證碼已寄至你的信箱',
      dev: Boolean(sendResult.dev),
    });
  } catch (err) {
    console.error('lookup:', err);
    res.status(500).json({ error: '無法驗證 Email，請稍後再試' });
  }
});

/** 寄驗證碼：必須在 roster；用途 setup（首次／重設） */
app.post('/api/auth/send-code', async (req, res) => {
  try {
    const email = normalizeEmail(req.body?.email);
    const purpose = req.body?.purpose === 'reset' ? 'reset' : 'setup';
    if (!email) {
      res.status(400).json({ error: '請輸入 Email' });
      return;
    }
    const roster = findRosterEntry(email);
    if (!roster) {
      res.status(403).json({ error: '此帳號未在預核名單中，無法註冊或重設密碼。請聯繫管理員。' });
      return;
    }

    ensureUserFromRoster(roster);
    const { code, expiresIn } = createLoginCode(email, purpose);
    const sendResult = await sendCodeEmail(email, code);
    res.json({
      ok: true,
      expiresIn,
      purpose,
      hasPassword: hasPassword(email),
      message: sendResult.dev
        ? '驗證碼已顯示於 Auth 終端機（未設定 SMTP）'
        : '驗證碼已寄出，請查收信箱',
      dev: Boolean(sendResult.dev),
    });
  } catch (err) {
    console.error('send-code:', err);
    res.status(500).json({ error: '寄送驗證碼失敗' });
  }
});

/** 只驗證驗證碼是否正確（不登入、不消耗；設密碼時再消耗） */
app.post('/api/auth/verify-code', async (req, res) => {
  try {
    const email = normalizeEmail(req.body?.email);
    const code = String(req.body?.code || '');
    const purpose = req.body?.purpose === 'reset' ? 'reset' : 'setup';
    if (!email || !code) {
      res.status(400).json({ error: '請輸入 Email 與驗證碼' });
      return;
    }
    if (!isPreApproved(email)) {
      res.status(403).json({ error: '此帳號未在預核名單中' });
      return;
    }
    const checked = checkLoginCode(email, code, purpose);
    if (!checked.ok) {
      res.status(400).json({ error: checked.error });
      return;
    }
    res.json({ ok: true, message: '驗證碼正確，請設定新密碼' });
  } catch (err) {
    console.error('verify-code:', err);
    res.status(500).json({ error: '驗證失敗' });
  }
});

/** 驗證碼正確後設定／重設密碼，並直接登入 */
app.post('/api/auth/set-password', async (req, res) => {
  try {
    const email = normalizeEmail(req.body?.email);
    const code = String(req.body?.code || '');
    const password = String(req.body?.password || '');
    const purpose = req.body?.purpose === 'reset' ? 'reset' : 'setup';

    if (!email || !code || password.length < 8) {
      res.status(400).json({ error: '請提供 Email、驗證碼，且密碼至少 8 碼' });
      return;
    }
    if (!isPreApproved(email)) {
      res.status(403).json({ error: '此帳號未在預核名單中' });
      return;
    }

    const checked = verifyLoginCode(email, code, purpose);
    if (!checked.ok) {
      res.status(400).json({ error: checked.error });
      return;
    }

    const roster = findRosterEntry(email);
    ensureUserFromRoster(roster);
    const user = await setPassword(email, password);
    const token = await createSessionToken(user);
    res.cookie(getSessionCookieName(), token, sessionCookieOptions());
    res.json({
      ok: true,
      user: publicUser(user),
      message: purpose === 'reset' ? '密碼已重設並登入' : '密碼已設定並登入',
    });
  } catch (err) {
    console.error('set-password:', err);
    res.status(500).json({ error: '設定密碼失敗' });
  }
});

/** 日常登入：Email + 密碼（不再每次驗證信箱） */
app.post('/api/auth/login', async (req, res) => {
  try {
    const email = normalizeEmail(req.body?.email);
    const password = String(req.body?.password || '');
    if (!email || !password) {
      res.status(400).json({ error: '請輸入 Email 與密碼' });
      return;
    }
    if (!isPreApproved(email)) {
      res.status(403).json({ error: '此帳號未在預核名單中' });
      return;
    }
    if (!hasPassword(email)) {
      res.status(400).json({
        error: '尚未設定密碼。請改用「首次設定／忘記密碼」寄驗證碼。',
        needSetup: true,
      });
      return;
    }
    const user = await verifyPassword(email, password);
    if (!user) {
      res.status(401).json({ error: 'Email 或密碼錯誤' });
      return;
    }
    const token = await createSessionToken(user);
    res.cookie(getSessionCookieName(), token, sessionCookieOptions());
    res.json({ ok: true, user, message: '登入成功' });
  } catch (err) {
    console.error('login:', err);
    res.status(500).json({ error: '登入失敗' });
  }
});

app.get('/api/codex/models', requireAuth, (_req, res) => {
  res.json(getModelsPayload());
});

app.post('/api/codex/stop', requireAuth, (req, res) => {
  const key = req.user?.email || '';
  const result = stopJob(key);
  res.json({
    ok: true,
    stopped: result.stopped,
    message: result.stopped ? '已送出停止訊號' : '目前沒有執行中的工作',
  });
});

app.post('/api/codex/chat', requireAuth, async (req, res) => {
  const { message, model, reasoningEffort, history } = req.body || {};
  if (!message?.trim()) {
    res.status(400).json({ error: '請輸入訊息' });
    return;
  }

  const wantStream =
    String(req.query.stream || '') === '1' ||
    (req.headers.accept || '').includes('text/event-stream');

  if (wantStream) {
    chatStream(res, {
      message,
      history,
      model,
      reasoningEffort,
      sessionKey: req.user.email,
    });
    return;
  }

  try {
    const result = await chatOnce({ message, history, model, reasoningEffort });
    res.json({ ok: true, ...result });
  } catch (err) {
    console.error('chat:', err);
    res.status(500).json({
      error: err.message || 'AI 執行失敗',
      detail: String(err.message || err).slice(0, 400),
    });
  }
});

app.listen(PORT, () => {
  console.log(`\n🔐 WikiNB KCIS API  http://127.0.0.1:${PORT}`);
  console.log(`   Auth: roster + email code + password`);
  console.log(`   Roster: ${getRosterPath()}`);
  console.log(`   LLM: ${process.env.LLM_PROVIDER || 'codex'}`);
  console.log(`   Project: ${PROJECT_ROOT}\n`);
});
