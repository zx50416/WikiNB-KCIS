/**
 * Teacher-friendly Markdown helpers
 */

/** Filename stem: letters (any language), numbers, _ - . — no spaces */
export const FILENAME_STEM_PATTERN = /^[\p{L}\p{N}_.-]+$/u;

export function isValidFilenameStem(stem) {
  const s = String(stem || '').trim();
  return s.length >= 1 && s.length <= 80 && FILENAME_STEM_PATTERN.test(s) && !/\s/.test(s);
}

/** 台北時間：2026年7月23日 上午／下午 */
export function formatTaipeiDateLabel(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Taipei',
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    hourCycle: 'h23',
  }).formatToParts(date);
  const get = (type) => parts.find((p) => p.type === type)?.value || '';
  const hour = Number(get('hour') || 0);
  const period = hour < 12 ? '上午' : '下午';
  return `${get('year')}年${get('month')}月${get('day')}日 ${period}`;
}

export function taipeiDateISO(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Taipei',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const get = (type) => parts.find((p) => p.type === type)?.value || '';
  return `${get('year')}-${get('month')}-${get('day')}`;
}

export function splitFrontmatter(content) {
  const text = String(content || '');
  const m = text.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!m) return { data: {}, body: text };
  const block = m[1];
  const body = m[2];
  const data = {};
  for (const line of block.split('\n')) {
    const kv = line.match(/^([A-Za-z0-9_-]+):\s*(.*)$/);
    if (!kv) continue;
    const key = kv[1];
    let val = kv[2].trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (key === 'keywords' || key === 'tags') continue;
    data[key] = val;
  }
  return { data, body };
}

export function buildMarkdownDocument({ title, description, body, existing = '' }) {
  const today = new Date().toISOString().slice(0, 10);
  const { data } = splitFrontmatter(existing);
  const q = (v) => JSON.stringify(String(v ?? ''));
  const lines = [
    '---',
    `title: ${q(title || data.title || 'Untitled')}`,
    `description: ${q(description ?? data.description ?? '')}`,
    `status: published`,
    `audience: ${data.audience || 'students'}`,
    `date: ${data.date || today}`,
    `updated: ${today}`,
  ];
  if (data.teacher) lines.push(`teacher: ${q(data.teacher)}`);
  if (data.teacher_id) lines.push(`teacher_id: ${q(data.teacher_id)}`);
  if (data.subject) lines.push(`subject: ${q(data.subject)}`);
  if (data.subject_id) lines.push(`subject_id: ${q(data.subject_id)}`);
  lines.push('---', '', String(body || '').replace(/^\n+/, ''));
  return lines.join('\n');
}

export function wrapSelection(textarea, before, after = before, placeholder = 'text') {
  if (!textarea) return;
  const start = textarea.selectionStart ?? 0;
  const end = textarea.selectionEnd ?? 0;
  const value = textarea.value;
  const selected = value.slice(start, end) || placeholder;
  const next = value.slice(0, start) + before + selected + after + value.slice(end);
  textarea.value = next;
  const cursorStart = start + before.length;
  const cursorEnd = cursorStart + selected.length;
  textarea.focus();
  textarea.setSelectionRange(cursorStart, cursorEnd);
  textarea.dispatchEvent(new Event('input', { bubbles: true }));
}

export function prefixLines(textarea, prefix) {
  if (!textarea) return;
  const start = textarea.selectionStart ?? 0;
  const end = textarea.selectionEnd ?? 0;
  const value = textarea.value;
  const lineStart = value.lastIndexOf('\n', start - 1) + 1;
  const lineEnd = value.indexOf('\n', end);
  const blockEnd = lineEnd === -1 ? value.length : lineEnd;
  const block = value.slice(lineStart, blockEnd);
  const nextBlock = block
    .split('\n')
    .map((line) => (line.startsWith(prefix) ? line : `${prefix}${line || ''}`))
    .join('\n');
  textarea.value = value.slice(0, lineStart) + nextBlock + value.slice(blockEnd);
  textarea.focus();
  textarea.setSelectionRange(lineStart, lineStart + nextBlock.length);
  textarea.dispatchEvent(new Event('input', { bubbles: true }));
}
