/**
 * Auth + Codex API client
 * - 本機 dev：打 auth.url（http://127.0.0.1:8788）
 * - GitHub Pages：打 auth.productionUrl（主機 HTTPS Tunnel → Mac／未來 Windows 的 Auth+Codex）
 */
function readAuthConfig() {
  const el = document.getElementById('auth-config');
  if (el?.textContent) {
    try {
      return JSON.parse(el.textContent);
    } catch {
      /* ignore */
    }
  }
  return {};
}

function getAuthBase() {
  const cfg = readAuthConfig();
  const local = (
    cfg.url ||
    import.meta.env.PUBLIC_AUTH_URL ||
    'http://127.0.0.1:8788'
  ).replace(/\/$/, '');
  const production = String(
    cfg.productionUrl || import.meta.env.PUBLIC_AUTH_PRODUCTION_URL || '',
  ).replace(/\/$/, '');

  if (typeof location !== 'undefined') {
    const onPages = location.hostname.endsWith('github.io');
    // 線上 Pages：連部署主機（Mac／未來 Windows）的 HTTPS Auth+Codex
    if (onPages) {
      if (production) return production;
      return local; // 尚未設定 productionUrl 時會觸發 mixed-content 提示
    }
    // 本機開發網站
    if (location.hostname === '127.0.0.1' || location.hostname === 'localhost') {
      return local;
    }
    if (production) return production;
  }
  return local;
}

export function getAuthUrl() {
  return getAuthBase();
}

async function authFetch(path, options = {}) {
  const res = await fetch(`${getAuthBase()}${path}`, {
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
    ...options,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    let message = data.error || data.message;
    if (!message) {
      if (res.status === 404) {
        message = 'Auth API 找不到此功能，請重新啟動主機上的 npm run auth';
      } else {
        message = `連線失敗（HTTP ${res.status}）`;
      }
    }
    const err = new Error(message);
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}

export function getAuthMixedContentBlock() {
  if (typeof location === 'undefined') return null;
  const base = getAuthBase();
  const pageIsHttps = location.protocol === 'https:';
  const authIsHttp = /^http:\/\//i.test(base);
  if (!(pageIsHttps && authIsHttp)) return null;

  const cfg = readAuthConfig();
  const hasProd = Boolean(String(cfg.productionUrl || '').trim());
  return {
    online: false,
    reason: 'mixed-content',
    message: hasProd
      ? '主機 Auth 設定異常（仍指向 HTTP）。請檢查 config/sites.json 的 productionUrl 是否為 HTTPS Tunnel。'
      : '線上站需連「主機」上的 Auth（HTTPS）。請在部署主機（目前 Mac，未來 Windows）執行 host 腳本並把 Tunnel 網址寫入 productionUrl 後重新部署。詳見 docs/HOST_DEPLOY.md。',
  };
}

export async function checkAuthHealth() {
  const blocked = getAuthMixedContentBlock();
  if (blocked) return blocked;
  try {
    return await authFetch('/api/health');
  } catch {
    return {
      online: false,
      reason: 'offline',
      message: 'Auth 未連線。請在本機專案資料夾執行 npm run auth（預設 http://127.0.0.1:8788）。',
    };
  }
}

export async function fetchMe() {
  try {
    return await authFetch('/api/auth/me');
  } catch (err) {
    if (err.status === 401) return { ok: false, authenticated: false };
    throw err;
  }
}

export async function lookupEmail(email) {
  return authFetch('/api/auth/lookup', {
    method: 'POST',
    body: JSON.stringify({ email }),
  });
}

export async function sendAuthCode(email, purpose = 'setup') {
  return authFetch('/api/auth/send-code', {
    method: 'POST',
    body: JSON.stringify({ email, purpose }),
  });
}

export async function verifyAuthCode(email, code, purpose = 'setup') {
  return authFetch('/api/auth/verify-code', {
    method: 'POST',
    body: JSON.stringify({ email, code, purpose }),
  });
}

export async function setPasswordWithCode({ email, code, password, purpose = 'setup' }) {
  return authFetch('/api/auth/set-password', {
    method: 'POST',
    body: JSON.stringify({ email, code, password, purpose }),
  });
}

export async function loginWithPassword(email, password) {
  return authFetch('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
}

export async function logout() {
  try {
    await authFetch('/api/auth/logout', { method: 'POST', body: '{}' });
  } catch {
    /* ignore */
  }
}

export async function fetchCodexModels() {
  return authFetch('/api/codex/models');
}

export async function stopCodex() {
  return authFetch('/api/codex/stop', { method: 'POST', body: '{}' });
}

export async function codexChatStream(message, onEvent = () => {}, options = {}) {
  const headers = {
    'Content-Type': 'application/json',
    Accept: 'text/event-stream',
  };
  const res = await fetch(`${getAuthBase()}/api/codex/chat?stream=1`, {
    method: 'POST',
    credentials: 'include',
    headers,
    body: JSON.stringify({
      message,
      model: options.model,
      reasoningEffort: options.reasoningEffort,
      history: options.history || [],
    }),
    signal: options.signal,
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || data.detail || `HTTP ${res.status}`);
  }
  if (!res.body) throw new Error('瀏覽器不支援串流');

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let finalPayload = null;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const parts = buffer.split('\n\n');
      buffer = parts.pop() || '';
      for (const part of parts) {
        const line = part
          .split('\n')
          .filter((l) => l.startsWith('data:'))
          .map((l) => l.slice(5).trim())
          .join('');
        if (!line) continue;
        try {
          const payload = JSON.parse(line);
          onEvent(payload);
          if (payload.type === 'done' || payload.type === 'error') finalPayload = payload;
        } catch {
          onEvent({ type: 'log', text: line });
        }
      }
    }
  } catch (err) {
    if (err?.name === 'AbortError') {
      return { type: 'done', ok: true, stopped: true, answer: '（已停止）' };
    }
    throw err;
  }

  if (!finalPayload) throw new Error('串流中斷');
  if (finalPayload.type === 'error' && !finalPayload.answer) {
    throw new Error(finalPayload.error || finalPayload.detail || '執行失敗');
  }
  return finalPayload;
}

export async function isLoggedIn() {
  const me = await fetchMe();
  return Boolean(me.authenticated && me.user);
}

export async function mountNavAuth() {
  const loginLink = document.getElementById('nav-login');
  const logoutBtn = document.getElementById('nav-logout');
  const userLabel = document.getElementById('nav-user');
  const codexLink = document.getElementById('nav-codex');

  const update = async () => {
    let me = { authenticated: false };
    try {
      me = await fetchMe();
    } catch {
      me = { authenticated: false };
    }
    const loggedIn = Boolean(me.authenticated && me.user);
    loginLink?.classList.toggle('hidden', loggedIn);
    logoutBtn?.classList.toggle('hidden', !loggedIn);
    codexLink?.classList.toggle('hidden', !loggedIn);
    if (userLabel) {
      if (loggedIn) {
        userLabel.textContent = me.user.name || me.user.email;
        userLabel.classList.remove('hidden');
      } else {
        userLabel.classList.add('hidden');
      }
    }
    document.dispatchEvent(
      new CustomEvent('wikinb:auth-change', { detail: { loggedIn, user: me.user || null } }),
    );
  };

  logoutBtn?.addEventListener('click', async (e) => {
    e.preventDefault();
    await logout();
    await update();
    window.location.href = document.documentElement.dataset.base || '/';
  });

  await update();
  return { update };
}
