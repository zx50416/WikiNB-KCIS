/**
 * 探測 Vertex／API Key Gemini
 * 用法：cd auth && node scripts/probe-gemini.js
 */
import dotenv from 'dotenv';
import path from 'node:path';
import dns from 'node:dns';
import { fileURLToPath } from 'node:url';

try {
  dns.setDefaultResultOrder('ipv4first');
} catch {
  /* ignore */
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '..', '.env'), override: true });
process.env.PROJECT_ROOT = path.resolve(__dirname, '../..');

const { chatOnce, getModelsPayload } = await import('../lib/llm.js');

console.log('models payload:', JSON.stringify(getModelsPayload(), null, 2));

const models = [
  process.env.LLM_MODEL || 'gemini-2.0-flash',
  'gemini-2.0-flash',
  'gemini-2.0-flash-lite',
  'gemini-2.5-flash',
  'gemini-1.5-flash',
];

const tried = new Set();
for (const model of models) {
  if (tried.has(model)) continue;
  tried.add(model);
  process.stdout.write(`try ${model} … `);
  try {
    const r = await chatOnce({
      message: '用一句繁中回覆：OK',
      history: [],
      model,
    });
    console.log('OK');
    console.log('mode=', r.provider, 'model=', r.model);
    console.log('answer=', String(r.answer).slice(0, 200));
    process.exit(0);
  } catch (err) {
    console.log('FAIL', err.message.slice(0, 180));
  }
}

process.exit(2);
