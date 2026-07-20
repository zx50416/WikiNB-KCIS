/**
 * LLM Adapter — 預設 Codex CLI；之後可改 LLM_PROVIDER=openai|custom
 */
import { execFile, spawn } from 'node:child_process';
import { promisify } from 'node:util';
import fs from 'node:fs';
import path from 'node:path';

const execFileAsync = promisify(execFile);

/** @type {Map<string, import('node:child_process').ChildProcess>} */
const activeJobs = new Map();

const CODEX_MODELS = [
  { id: 'gpt-5.6-terra', label: 'gpt-5.6-terra（預設）' },
  { id: 'gpt-5.5', label: 'gpt-5.5' },
  { id: 'gpt-5.3-codex', label: 'gpt-5.3-codex' },
  { id: 'o4-mini', label: 'o4-mini' },
];

const CODEX_EFFORTS = [
  { id: 'low', label: '低（較快）' },
  { id: 'medium', label: '中（預設）' },
  { id: 'high', label: '高（較慢、較深）' },
];

function provider() {
  return String(process.env.LLM_PROVIDER || 'codex').toLowerCase();
}

function projectRoot() {
  return process.env.PROJECT_ROOT || path.resolve(process.cwd(), '..');
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

function buildPrompt(message, history) {
  const hist = Array.isArray(history)
    ? history
        .slice(-16)
        .map((t) => `${t.role === 'assistant' ? '助手' : '使用者'}：${String(t.content || '').slice(0, 2500)}`)
        .join('\n\n')
    : '';

  return `你是 WikiNB · KCIS 的學習複習助理（本機 adapter：${provider()}）。

規則：
- 依 wiki/teachers/ 教材回答；標示來源老師／科目／檔名
- 可依 keywords（老師名、科目）篩選；使用者沒指定就用全部已發布內容
- 使用繁體中文；可用 Markdown
- 推測請標明

專案目錄：${projectRoot()}
wiki 快照：${listWikiSnapshot()}
${hist ? `\n稍早對話：\n${hist}\n` : ''}
使用者問題：
${String(message || '').trim()}`;
}

export function getModelsPayload() {
  if (provider() === 'codex') {
    const defaultModel = readCodexDefault('model', 'gpt-5.6-terra');
    const defaultEffort = readCodexDefault('model_reasoning_effort', 'medium');
    const models = [...CODEX_MODELS];
    if (!models.some((m) => m.id === defaultModel)) {
      models.unshift({ id: defaultModel, label: `${defaultModel}（本機）` });
    }
    return {
      ok: true,
      provider: 'codex',
      defaultModel,
      defaultEffort,
      models,
      efforts: CODEX_EFFORTS,
      tips: ['簡單問答約 15–60 秒；複雜題可能更久。正式環境可改 LLM_PROVIDER。'],
    };
  }

  return {
    ok: true,
    provider: provider(),
    defaultModel: process.env.LLM_MODEL || 'default',
    defaultEffort: 'medium',
    models: [{ id: process.env.LLM_MODEL || 'default', label: process.env.LLM_MODEL || 'default' }],
    efforts: CODEX_EFFORTS,
    tips: [`目前 provider=${provider()}（請實作對應 adapter）`],
  };
}

export function stopJob(sessionKey) {
  const child = activeJobs.get(sessionKey);
  if (!child || child.killed) return { stopped: false };
  child.kill('SIGTERM');
  setTimeout(() => {
    if (!child.killed) child.kill('SIGKILL');
  }, 1500);
  return { stopped: true };
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

/** 非串流（fallback） */
export async function chatOnce({ message, history, model, reasoningEffort }) {
  if (provider() !== 'codex') {
    throw new Error(`LLM_PROVIDER=${provider()} 尚未實作；請設 LLM_PROVIDER=codex 或擴充 adapter`);
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

/** SSE 串流 Codex */
export function chatStream(res, { message, history, model, reasoningEffort, sessionKey }) {
  if (provider() !== 'codex') {
    res.write(
      `data: ${JSON.stringify({ type: 'error', error: `LLM_PROVIDER=${provider()} 尚未實作` })}\n\n`,
    );
    res.end();
    return;
  }

  const prompt = buildPrompt(message, history);
  const chosenModel = model || readCodexDefault('model', 'gpt-5.6-terra');
  const effort = reasoningEffort || readCodexDefault('model_reasoning_effort', 'medium');

  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders?.();

  const send = (payload) => {
    if (res.writableEnded) return;
    res.write(`data: ${JSON.stringify(payload)}\n\n`);
  };

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
