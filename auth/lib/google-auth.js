/**
 * 服務帳號 OAuth（用 Node 原生 fetch，避開 gaxios/node-fetch 在部分網路下 Premature close）
 */
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import dns from 'node:dns';
import { fileURLToPath } from 'node:url';

try {
  dns.setDefaultResultOrder('ipv4first');
} catch {
  /* ignore */
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function projectRoot() {
  return process.env.PROJECT_ROOT || path.resolve(__dirname, '../..');
}

export function resolveServiceAccountPath() {
  const fromEnv = String(process.env.GOOGLE_SERVICE_ACCOUNT_FILE || '').trim();
  const candidates = [];
  if (fromEnv) {
    if (path.isAbsolute(fromEnv)) candidates.push(fromEnv);
    else {
      candidates.push(path.resolve(process.cwd(), fromEnv));
      candidates.push(path.resolve(projectRoot(), fromEnv));
      candidates.push(path.resolve(projectRoot(), 'auth', fromEnv.replace(/^auth\//, '')));
      candidates.push(path.resolve(__dirname, '..', fromEnv.replace(/^auth\//, '')));
    }
  }
  candidates.push(path.join(__dirname, '..', 'secrets', 'drive-sa.json'));
  for (const p of candidates) {
    if (p && fs.existsSync(p)) return p;
  }
  return '';
}

export function loadServiceAccount() {
  const inline = String(process.env.GOOGLE_SERVICE_ACCOUNT_JSON || '').trim();
  if (inline) return JSON.parse(inline);
  const file = resolveServiceAccountPath();
  if (!file) throw new Error('尚未設定 Google 服務帳號（GOOGLE_SERVICE_ACCOUNT_FILE）');
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function b64url(input) {
  return Buffer.from(input).toString('base64url');
}

function signJwt(sa, scope) {
  const now = Math.floor(Date.now() / 1000);
  const header = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const claim = b64url(
    JSON.stringify({
      iss: sa.client_email,
      scope,
      aud: 'https://oauth2.googleapis.com/token',
      iat: now,
      exp: now + 3600,
    }),
  );
  const unsigned = `${header}.${claim}`;
  const sig = crypto.createSign('RSA-SHA256').update(unsigned).sign(sa.private_key);
  return `${unsigned}.${sig.toString('base64url')}`;
}

/** @type {Map<string, { token: string, expiresAt: number }>} */
const tokenCache = new Map();

/**
 * @param {string} scope
 * @returns {Promise<string>}
 */
export async function getGoogleAccessToken(
  scope = 'https://www.googleapis.com/auth/cloud-platform',
) {
  const cached = tokenCache.get(scope);
  if (cached && cached.expiresAt > Date.now() + 60_000) return cached.token;

  const sa = loadServiceAccount();
  const assertion = signJwt(sa, scope);
  const body = new URLSearchParams({
    grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
    assertion,
  });

  const urls = [
    'https://oauth2.googleapis.com/token',
    'https://www.googleapis.com/oauth2/v4/token',
  ];

  let lastErr = null;
  for (const url of urls) {
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        lastErr = new Error(data?.error_description || data?.error || `token HTTP ${res.status}`);
        continue;
      }
      const token = data.access_token;
      if (!token) {
        lastErr = new Error('token 回應缺少 access_token');
        continue;
      }
      const expiresIn = Number(data.expires_in || 3600);
      tokenCache.set(scope, {
        token,
        expiresAt: Date.now() + expiresIn * 1000,
      });
      return token;
    } catch (err) {
      lastErr = err;
    }
  }
  throw lastErr || new Error('無法取得 Google access token');
}
