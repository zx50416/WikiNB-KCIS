import crypto from 'node:crypto';
import nodemailer from 'nodemailer';

const pending = new Map(); // email -> { code, expiresAt, purpose }
const CODE_TTL_MS = 10 * 60 * 1000;

export function createLoginCode(email, purpose = 'setup') {
  const code = String(crypto.randomInt(100000, 999999));
  const key = String(email).trim().toLowerCase();
  pending.set(key, { code, purpose, expiresAt: Date.now() + CODE_TTL_MS });
  return { code, expiresIn: CODE_TTL_MS / 1000 };
}

function readPendingCode(email, code, purpose) {
  const key = String(email).trim().toLowerCase();
  const row = pending.get(key);
  if (!row || row.expiresAt < Date.now()) {
    pending.delete(key);
    return { ok: false, error: '驗證碼已過期，請重新寄送' };
  }
  if (purpose && row.purpose !== purpose) {
    return { ok: false, error: '驗證碼用途不符，請重新寄送' };
  }
  if (String(code).trim() !== row.code) {
    return { ok: false, error: '驗證碼錯誤' };
  }
  return { ok: true, purpose: row.purpose, key };
}

/** 檢查驗證碼正確與否，但不消耗（之後設密碼再消耗） */
export function checkLoginCode(email, code, purpose) {
  const result = readPendingCode(email, code, purpose);
  if (!result.ok) return result;
  return { ok: true, purpose: result.purpose };
}

/** 驗證並消耗驗證碼（設密碼時使用） */
export function verifyLoginCode(email, code, purpose) {
  const result = readPendingCode(email, code, purpose);
  if (!result.ok) return result;
  pending.delete(result.key);
  return { ok: true, purpose: result.purpose };
}

export async function sendCodeEmail(email, code) {
  const subject = `WikiNB KCIS 驗證碼：${code}`;
  const text = `你的驗證碼是：${code}\n\n10 分鐘內有效。若不是你本人操作，請忽略此信。`;

  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
    if (process.env.DEV_LOG_CODE !== 'false') {
      console.log('\n📧 [DEV] 驗證碼（未設定 SMTP，僅終端機）:', code);
      console.log('   收件:', email, '\n');
    }
    return { dev: true };
  }

  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: Number(process.env.SMTP_PORT || 587),
    secure: false,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });

  await transporter.sendMail({
    from: process.env.SMTP_FROM || process.env.SMTP_USER,
    to: email,
    subject,
    text,
  });
  return { dev: false };
}
