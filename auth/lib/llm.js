/**
 * LLM Adapter — Gemini（預設）／Codex CLI
 */
import { execFile, spawn } from 'node:child_process';
import { promisify } from 'node:util';
import fs from 'node:fs';
import path from 'node:path';

const execFileAsync = promisify(execFile);

/** @type {Map<string, { kill?: Function, abort?: AbortController } | import('node:child_process').ChildProcess>} */
const activeJobs = new Map();

const CODEX_MODELS = [
  { id: 'gpt-5.6-terra', label: 'gpt-5.6-terra（預設）' },
  { id: 'gpt-5.5', label: 'gpt-5.5' },
  { id: 'gpt-5.3-codex', label: 'gpt-5.3-codex' },
  { id: 'o4-mini', label: 'o4-mini' },
];

const GEMINI_MODELS = [
  { id: 'gemini-flash-latest', label: 'gemini-flash-latest（預設）' },
  { id: 'gemini-flash-lite-latest', label: 'gemini-flash-lite-latest' },
  { id: 'gemini-2.0-flash', label: 'gemini-2.0-flash' },
  { id: 'gemini-2.0-flash-lite', label: 'gemini-2.0-flash-lite' },
];

const CODEX_EFFORTS = [
  { id: 'low', label: '低（較快）' },
  { id: 'medium', label: '中（預設）' },
  { id: 'high', label: '高（較慢、較深）' },
];

function provider() {
  return String(process.env.LLM_PROVIDER || 'gemini').toLowerCase();
}

function projectRoot() {
  return process.env.PROJECT_ROOT || path.resolve(process.cwd(), '..');
}

function geminiApiKey() {
  return String(process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || '').trim();
}

function geminiApiMode() {
  const mode = String(process.env.GEMINI_API_MODE || '').trim().toLowerCase();
  if (mode === 'vertex' || mode === 'apikey') return mode;
  // 有 GCP 專案＋服務帳號時預設走 Vertex（帳號密碼.md 的 cloud SA）
  if (process.env.GOOGLE_CLOUD_PROJECT && process.env.GOOGLE_SERVICE_ACCOUNT_FILE) {
    return 'vertex';
  }
  return 'apikey';
}

function defaultGeminiModel() {
  return process.env.LLM_MODEL || 'gemini-flash-latest';
}

function cloudProject() {
  return String(process.env.GOOGLE_CLOUD_PROJECT || '').trim();
}

function cloudLocation() {
  return String(process.env.GOOGLE_CLOUD_LOCATION || 'us-central1').trim();
}

function resolveServiceAccountPath() {
  const fromEnv = String(process.env.GOOGLE_SERVICE_ACCOUNT_FILE || '').trim();
  const candidates = [];
  if (fromEnv) {
    if (path.isAbsolute(fromEnv)) candidates.push(fromEnv);
    else {
      candidates.push(path.resolve(process.cwd(), fromEnv));
      candidates.push(path.resolve(projectRoot(), fromEnv));
      candidates.push(path.resolve(projectRoot(), 'auth', fromEnv.replace(/^auth\//, '')));
    }
  }
  candidates.push(path.resolve(projectRoot(), 'auth/secrets/drive-sa.json'));
  for (const p of candidates) {
    if (p && fs.existsSync(p)) return p;
  }
  return '';
}

async function getVertexAccessToken() {
  const { getGoogleAccessToken } = await import('./google-auth.js');
  return getGoogleAccessToken('https://www.googleapis.com/auth/cloud-platform');
}

function vertexModelUrl(model, stream = false) {
  const project = cloudProject();
  const location = cloudLocation();
  if (!project) throw new Error('尚未設定 GOOGLE_CLOUD_PROJECT');
  const action = stream ? 'streamGenerateContent' : 'generateContent';
  const host =
    location === 'global'
      ? 'https://aiplatform.googleapis.com'
      : `https://${location}-aiplatform.googleapis.com`;
  return `${host}/v1/projects/${encodeURIComponent(project)}/locations/${encodeURIComponent(location)}/publishers/google/models/${encodeURIComponent(model)}:${action}${stream ? '?alt=sse' : ''}`;
}

function readCodexDefault(field, fallback) {
  try {
    const cfgPath = path.join(process.env.HOME || '', '.codex', 'config.toml');
    if (!fs.existsSync(cfgPath)) return fallback;
    const text = fs.readFileSync(cfgPath, 'utf8');
    const re = new RegExp(`^\\s*${field}\\s*=\\s*"([^"]+)"`, 'm');
    const m = text.match(re);
    return m?.[1] || fallback;
  } catch {
    return fallback;
  }
}

function listWikiSnapshot() {
  const wikiDir = path.join(projectRoot(), 'wiki', 'teachers');
  if (!fs.existsSync(wikiDir)) return '（尚無 wiki）';
  const names = [];
  const walk = (dir, prefix = '') => {
    for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
      const rel = prefix ? `${prefix}/${ent.name}` : ent.name;
      if (ent.isDirectory()) walk(path.join(dir, ent.name), rel);
      else if (ent.name.endsWith('.md')) names.push(rel);
    }
  };
  walk(wikiDir);
  return names.slice(0, 80).join(', ') || '（尚無筆記）';
}

/** 讀取筆記全文（截斷）供 Gemini 當教材上下文 */
function loadWikiCorpus(maxChars = 48000) {
  const wikiDir = path.join(projectRoot(), 'wiki', 'teachers');
  if (!fs.existsSync(wikiDir)) return '（尚無 wiki 筆記）';
  const chunks = [];
  let used = 0;
  const walk = (dir, prefix = '') => {
    for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
      const rel = prefix ? `${prefix}/${ent.name}` : ent.name;
      if (ent.isDirectory()) {
        walk(path.join(dir, ent.name), rel);
        continue;
      }
      if (!ent.name.endsWith('.md')) continue;
      if (used >= maxChars) return;
      const raw = fs.readFileSync(path.join(dir, ent.name), 'utf8');
      const body = raw.slice(0, 3500);
      const piece = `\n---\n檔案：teachers/${rel}\n${body}\n`;
      if (used + piece.length > maxChars) return;
      chunks.push(piece);
      used += piece.length;
    }
  };
  walk(wikiDir);
  return chunks.join('') || '（尚無筆記）';
}

function buildSystemPrompt() {
  return `你是 WikiNB · KCIS 的學習複習助理（Gemini × KCIS）。

規則：
- 依下方 wiki/teachers/ 教材回答；標示來源老師／科目／檔名
- 可依 keywords（老師名、科目）篩選；使用者沒指定就用全部已發布內容
- 使用繁體中文；可用 Markdown
- 推測請標明；教材沒有的內容請誠實說不知道

專案目錄：${projectRoot()}
wiki 檔名快照：${listWikiSnapshot()}

教材內容：
${loadWikiCorpus()}`;
}

function buildPrompt(message, history) {
  const hist = Array.isArray(history)
    ? history
        .slice(-16)
        .map((t) => `${t.role === 'assistant' ? '助手' : '使用者'}：${String(t.content || '').slice(0, 2500)}`)
        .join('\n\n')
    : '';

  return `${buildSystemPrompt()}
${hist ? `\n稍早對話：\n${hist}\n` : ''}
使用者問題：
${String(message || '').trim()}`;
}

function buildGeminiContents(message, history) {
  const contents = [];
  if (Array.isArray(history)) {
    for (const turn of history.slice(-16)) {
      const role = turn.role === 'assistant' ? 'model' : 'user';
      const text = String(turn.content || '').trim();
      if (!text) continue;
      contents.push({ role, parts: [{ text: text.slice(0, 8000) }] });
    }
  }
  contents.push({ role: 'user', parts: [{ text: String(message || '').trim() }] });
  return contents;
}

export function getModelsPayload() {
  if (provider() === 'gemini') {
    const defaultModel = defaultGeminiModel();
    return {
      ok: true,
      provider: 'gemini',
      mode: geminiApiMode(),
      defaultModel,
      defaultEffort: 'default',
      models: [{ id: defaultModel, label: '預設' }],
      efforts: [{ id: 'default', label: '預設' }],
      tips: [
        'Gemini × KCIS：依 wiki 筆記回答。',
        geminiApiMode() === 'vertex'
          ? `Vertex AI（專案 ${cloudProject() || '?'} · ${cloudLocation()}）`
          : geminiApiKey()
            ? 'API Key 已設定。'
            : '⚠ 尚未設定 GEMINI_API_KEY',
      ],
    };
  }

  if (provider() === 'codex') {
    const defaultModel = readCodexDefault('model', 'gpt-5.6-terra');
    const defaultEffort = readCodexDefault('model_reasoning_effort', 'medium');
    return {
      ok: true,
      provider: 'codex',
      defaultModel,
      defaultEffort,
      models: [{ id: defaultModel, label: '預設' }],
      efforts: [{ id: defaultEffort, label: '預設' }],
      tips: ['簡單問答約 15–60 秒；複雜題可能更久。'],
    };
  }

  return {
    ok: false,
    provider: provider(),
    defaultModel: 'default',
    defaultEffort: 'default',
    models: [{ id: 'default', label: '預設' }],
    efforts: [{ id: 'default', label: '預設' }],
    tips: [`LLM_PROVIDER=${provider()} 尚未實作`],
    error: `LLM_PROVIDER=${provider()} 尚未實作；請設 LLM_PROVIDER=gemini`,
  };
}

export function stopJob(sessionKey) {
  const job = activeJobs.get(sessionKey);
  if (!job) return { stopped: false };
  if (typeof job.abort === 'function' || job.abort instanceof AbortController) {
    const ctrl = job.abort instanceof AbortController ? job.abort : null;
    ctrl?.abort();
    if (typeof job.kill === 'function') job.kill();
    activeJobs.delete(sessionKey);
    return { stopped: true };
  }
  if (job.kill && !job.killed) {
    job.kill('SIGTERM');
    setTimeout(() => {
      if (!job.killed) job.kill('SIGKILL');
    }, 1500);
    return { stopped: true };
  }
  return { stopped: false };
}

function extractCodexText(ev) {
  if (!ev || typeof ev !== 'object') return '';
  const candidates = [];
  const push = (v) => {
    if (typeof v === 'string' && v.trim()) candidates.push(v.trim());
  };
  push(ev.text);
  push(ev.message);
  push(ev.content);
  push(ev.delta);
  push(ev.msg?.message);
  push(ev.item?.text);
  const type = String(ev.type || ev.msg?.type || '');
  const itemType = String(ev.item?.type || '');
  if (
    /agent_message|output_text|message\.delta|assistant/i.test(type) ||
    /agent_message|message/i.test(itemType)
  ) {
    return candidates[0] || '';
  }
  return '';
}

function summarizeCodexEvent(ev) {
  const t = ev.type || ev.msg?.type || ev.item?.type || 'event';
  if (/reasoning|thinking/i.test(t)) return '思考中';
  if (/agent_message|message/i.test(t)) return '產生回覆';
  if (/tool|command|exec/i.test(t)) return '執行工具';
  if (/error/i.test(t)) return '錯誤';
  if (/complete|done/i.test(t)) return '完成';
  return t;
}

function extractGeminiText(payload) {
  const parts = payload?.candidates?.[0]?.content?.parts;
  if (!Array.isArray(parts)) return '';
  return parts
    .map((p) => (typeof p?.text === 'string' ? p.text : ''))
    .join('');
}

function geminiRequestBody(message, history) {
  return {
    systemInstruction: { parts: [{ text: buildSystemPrompt() }] },
    contents: buildGeminiContents(message, history),
    generationConfig: {
      temperature: 0.7,
      maxOutputTokens: 4096,
    },
  };
}

function formatGeminiHttpError(res, data) {
  const detail = data?.error?.message || JSON.stringify(data).slice(0, 400);
  if (res.status === 403 || /denied access|PERMISSION_DENIED/i.test(detail)) {
    return (
      'Gemini／Vertex 權限被拒（403）。若走 Vertex：請在 GCP 啟用 Vertex AI API，並給服務帳號 Vertex AI User 角色。' +
      ' 若走 API Key：請到 https://aistudio.google.com/apikey 開新金鑰。'
    );
  }
  if (res.status === 429 || /quota|RESOURCE_EXHAUSTED/i.test(detail)) {
    return 'Gemini 配額用盡（429）。請檢查 GCP／AI Studio 用量或啟用計費。';
  }
  return `Gemini API ${res.status}: ${detail}`;
}

async function geminiGenerateApiKey({ message, history, model, signal }) {
  const key = geminiApiKey();
  if (!key) throw new Error('尚未設定 GEMINI_API_KEY（請填 auth/.env）');
  const chosenModel = model || defaultGeminiModel();
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(chosenModel)}:generateContent?key=${encodeURIComponent(key)}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(geminiRequestBody(message, history)),
    signal,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(formatGeminiHttpError(res, data));
  const answer = extractGeminiText(data).trim() || '（無回應）';
  return { answer, model: chosenModel, provider: 'gemini', mode: 'apikey', raw: data };
}

async function geminiGenerateVertex({ message, history, model, signal }) {
  const chosenModel = model || defaultGeminiModel();
  const token = await getVertexAccessToken();
  const url = vertexModelUrl(chosenModel, false);
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(geminiRequestBody(message, history)),
    signal,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(formatGeminiHttpError(res, data));
  const answer = extractGeminiText(data).trim() || '（無回應）';
  return { answer, model: chosenModel, provider: 'gemini', mode: 'vertex', raw: data };
}

async function geminiGenerate(opts) {
  if (geminiApiMode() === 'vertex') return geminiGenerateVertex(opts);
  return geminiGenerateApiKey(opts);
}

/** 非串流（fallback） */
export async function chatOnce({ message, history, model, reasoningEffort }) {
  if (provider() === 'gemini') {
    const result = await geminiGenerate({ message, history, model });
    return {
      answer: result.answer,
      model: result.model,
      reasoningEffort: reasoningEffort || 'medium',
      provider: 'gemini',
    };
  }

  if (provider() !== 'codex') {
    throw new Error(`LLM_PROVIDER=${provider()} 尚未實作；請設 LLM_PROVIDER=gemini 或 codex`);
  }
  const prompt = buildPrompt(message, history);
  const chosenModel = model || readCodexDefault('model', 'gpt-5.6-terra');
  const effort = reasoningEffort || readCodexDefault('model_reasoning_effort', 'medium');
  const { stdout, stderr } = await execFileAsync(
    'codex',
    [
      'exec',
      '--color',
      'never',
      '--sandbox',
      'read-only',
      '--ephemeral',
      '-m',
      chosenModel,
      '-c',
      `model_reasoning_effort="${effort}"`,
      '-',
    ],
    {
      cwd: projectRoot(),
      timeout: 180000,
      maxBuffer: 10 * 1024 * 1024,
      input: prompt,
    },
  );
  return {
    answer: stdout?.trim() || stderr?.trim() || '（無回應）',
    model: chosenModel,
    reasoningEffort: effort,
    provider: 'codex',
  };
}

function beginSse(res) {
  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders?.();
}

function sseSend(res, payload) {
  if (res.writableEnded) return;
  res.write(`data: ${JSON.stringify(payload)}\n\n`);
}

async function chatStreamGemini(res, { message, history, model, reasoningEffort, sessionKey }) {
  beginSse(res);
  const chosenModel = model || defaultGeminiModel();
  const effort = reasoningEffort || 'medium';
  const startedAt = Date.now();
  const abort = new AbortController();
  const tick = setInterval(() => sseSend(res, { type: 'tick', elapsedMs: Date.now() - startedAt }), 1000);

  activeJobs.set(sessionKey || `gemini-${startedAt}`, {
    abort,
    kill: () => abort.abort(),
  });

  sseSend(res, {
    type: 'status',
    message: `啟動 Gemini（${chosenModel}）…`,
    model: chosenModel,
  });

  let stoppedByUser = false;
  res.on('close', () => {
    if (res.writableEnded) return;
    stoppedByUser = true;
    abort.abort();
  });

  try {
    const mode = geminiApiMode();
    const body = geminiRequestBody(message, history);
    let streamUrl = '';
    /** @type {Record<string, string>} */
    const headers = { 'Content-Type': 'application/json' };

    if (mode === 'vertex') {
      const token = await getVertexAccessToken();
      streamUrl = vertexModelUrl(chosenModel, true);
      headers.Authorization = `Bearer ${token}`;
      sseSend(res, {
        type: 'status',
        message: `啟動 Vertex Gemini（${chosenModel} · ${cloudLocation()}）…`,
        model: chosenModel,
      });
    } else {
      const key = geminiApiKey();
      if (!key) throw new Error('尚未設定 GEMINI_API_KEY（請填 auth/.env）');
      streamUrl = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(chosenModel)}:streamGenerateContent?alt=sse&key=${encodeURIComponent(key)}`;
    }

    const upstream = await fetch(streamUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      signal: abort.signal,
    });

    if (!upstream.ok) {
      const errText = await upstream.text().catch(() => '');
      let detail = errText.slice(0, 500);
      try {
        detail = JSON.parse(errText)?.error?.message || detail;
      } catch {
        /* ignore */
      }
      // 串流失敗 → 非串流 fallback
      sseSend(res, { type: 'status', message: '串流不可用，改用一般回覆…' });
      const once = await geminiGenerate({
        message,
        history,
        model: chosenModel,
        signal: abort.signal,
      });
      sseSend(res, { type: 'delta', text: once.answer });
      sseSend(res, {
        type: 'done',
        ok: true,
        answer: once.answer,
        elapsedMs: Date.now() - startedAt,
        model: chosenModel,
        reasoningEffort: effort,
        provider: 'gemini',
        mode,
        fallback: true,
        streamError: detail,
      });
      return;
    }

    const reader = upstream.body?.getReader();
    if (!reader) throw new Error('Gemini 未回傳串流內容');
    const decoder = new TextDecoder();
    let buffer = '';
    let answer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const blocks = buffer.split('\n\n');
      buffer = blocks.pop() || '';
      for (const block of blocks) {
        const dataLine = block
          .split('\n')
          .filter((l) => l.startsWith('data:'))
          .map((l) => l.slice(5).trim())
          .join('');
        if (!dataLine || dataLine === '[DONE]') continue;
        let parsed;
        try {
          parsed = JSON.parse(dataLine);
        } catch {
          continue;
        }
        const piece = extractGeminiText(parsed);
        if (piece) {
          answer += piece;
          sseSend(res, { type: 'delta', text: piece });
        }
      }
    }

    if (!answer.trim()) {
      const once = await geminiGenerate({
        message,
        history,
        model: chosenModel,
        signal: abort.signal,
      });
      answer = once.answer;
      sseSend(res, { type: 'delta', text: answer });
    }

    sseSend(res, {
      type: 'done',
      ok: true,
      stopped: stoppedByUser,
      answer: answer.trim() || '（無回應）',
      elapsedMs: Date.now() - startedAt,
      model: chosenModel,
      reasoningEffort: effort,
      provider: 'gemini',
      mode,
    });
  } catch (err) {
    if (abort.signal.aborted || stoppedByUser) {
      sseSend(res, {
        type: 'done',
        ok: true,
        stopped: true,
        answer: '（已停止）',
        elapsedMs: Date.now() - startedAt,
        model: chosenModel,
        provider: 'gemini',
      });
    } else {
      sseSend(res, {
        type: 'error',
        error: err?.message || 'Gemini 執行失敗',
        elapsedMs: Date.now() - startedAt,
        model: chosenModel,
      });
    }
  } finally {
    clearInterval(tick);
    if (sessionKey) activeJobs.delete(sessionKey);
    if (!res.writableEnded) res.end();
  }
}

/** SSE 串流 */
export function chatStream(res, { message, history, model, reasoningEffort, sessionKey }) {
  if (provider() === 'gemini') {
    chatStreamGemini(res, { message, history, model, reasoningEffort, sessionKey });
    return;
  }

  if (provider() !== 'codex') {
    beginSse(res);
    sseSend(res, {
      type: 'error',
      error: `LLM_PROVIDER=${provider()} 尚未實作`,
    });
    res.end();
    return;
  }

  const prompt = buildPrompt(message, history);
  const chosenModel = model || readCodexDefault('model', 'gpt-5.6-terra');
  const effort = reasoningEffort || readCodexDefault('model_reasoning_effort', 'medium');

  beginSse(res);

  const send = (payload) => sseSend(res, payload);

  send({ type: 'status', message: `啟動 Codex（${chosenModel} · ${effort}）…`, model: chosenModel });

  const startedAt = Date.now();
  const tick = setInterval(() => send({ type: 'tick', elapsedMs: Date.now() - startedAt }), 1000);

  let buffer = '';
  let fullLog = '';
  const answerParts = [];
  let stoppedByUser = false;

  const child = spawn(
    'codex',
    [
      'exec',
      '--json',
      '--color',
      'never',
      '--sandbox',
      'read-only',
      '--ephemeral',
      '-m',
      chosenModel,
      '-c',
      `model_reasoning_effort="${effort}"`,
      '-',
    ],
    { cwd: projectRoot(), env: process.env, stdio: ['pipe', 'pipe', 'pipe'] },
  );

  if (sessionKey) activeJobs.set(sessionKey, child);
  child.stdin.write(prompt);
  child.stdin.end();

  const handleChunk = (chunk, source) => {
    const text = chunk.toString('utf8');
    fullLog += text;
    buffer += text;
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      let parsed = null;
      try {
        parsed = JSON.parse(trimmed);
      } catch {
        send({ type: 'log', source, text: trimmed });
        continue;
      }
      const extracted = extractCodexText(parsed);
      if (extracted) {
        answerParts.push(extracted);
        send({ type: 'delta', text: extracted });
      }
      send({
        type: 'event',
        eventType: parsed.type || parsed.msg?.type || 'unknown',
        summary: summarizeCodexEvent(parsed),
      });
    }
  };

  child.stdout.on('data', (c) => handleChunk(c, 'stdout'));
  child.stderr.on('data', (c) => handleChunk(c, 'stderr'));

  const killTimer = setTimeout(() => {
    send({ type: 'status', message: '超過 3 分鐘，停止中…' });
    child.kill('SIGTERM');
  }, 180000);

  const cleanup = () => {
    clearInterval(tick);
    clearTimeout(killTimer);
    if (sessionKey && activeJobs.get(sessionKey) === child) activeJobs.delete(sessionKey);
  };

  res.on('close', () => {
    if (res.writableEnded) return;
    stoppedByUser = true;
    cleanup();
    if (!child.killed) {
      child.kill('SIGTERM');
      setTimeout(() => {
        if (!child.killed) child.kill('SIGKILL');
      }, 1500);
    }
  });

  child.on('error', (err) => {
    cleanup();
    send({ type: 'error', error: '無法啟動 Codex CLI', detail: String(err.message || err) });
    if (!res.writableEnded) res.end();
  });

  child.on('close', (code) => {
    cleanup();
    if (buffer.trim()) handleChunk(Buffer.from(`${buffer}\n`), 'stdout');
    const answer =
      answerParts.join('\n').trim() ||
      fullLog.trim() ||
      (stoppedByUser ? '（已停止）' : code === 0 ? '（無文字回覆）' : `結束代碼 ${code}`);

    if (res.writableEnded) return;
    if (stoppedByUser) {
      send({
        type: 'done',
        ok: true,
        stopped: true,
        answer,
        fullLog,
        elapsedMs: Date.now() - startedAt,
        model: chosenModel,
        reasoningEffort: effort,
        provider: 'codex',
      });
    } else if (code && code !== 0 && !answerParts.length) {
      send({
        type: 'error',
        error: 'Codex 執行失敗',
        detail: fullLog.slice(-800) || `exit ${code}`,
        answer,
        elapsedMs: Date.now() - startedAt,
        model: chosenModel,
      });
    } else {
      send({
        type: 'done',
        ok: true,
        answer,
        fullLog,
        exitCode: code ?? 0,
        elapsedMs: Date.now() - startedAt,
        model: chosenModel,
        reasoningEffort: effort,
        provider: 'codex',
      });
    }
    res.end();
  });
}
