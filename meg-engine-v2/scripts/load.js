#!/usr/bin/env node
try { require('dotenv').config(); } catch {}
const { performance } = require('node:perf_hooks');

const baseUrl = value('--base-url', process.env.MEG_BASE_URL || 'http://127.0.0.1:8787');
const levels = (value('--levels', '1,10,25,50') || '1,10,25,50').split(',').map(Number).filter((n) => Number.isFinite(n) && n > 0);
const rounds = Number(value('--rounds', '1')) || 1;

function value(flag, fallback) { const index = process.argv.indexOf(flag); return index >= 0 ? process.argv[index + 1] : fallback; }
async function one(index, level) {
  const started = performance.now();
  const controller = new AbortController();
  try {
    const headers = { 'Content-Type': 'application/json', Accept: 'text/event-stream' };
    if (process.env.MEG_API_KEY) headers.Authorization = `Bearer ${process.env.MEG_API_KEY}`;
    const response = await fetch(`${baseUrl}/v2/chat`, {
      method: 'POST', headers, signal: controller.signal,
      body: JSON.stringify({ userId: `load-${level}`, conversationId: `load-${level}-${index}`, message: 'What is PCOS?', messageId: `load-${level}-${index}-${Date.now()}` }),
    });
    if (!response.ok || !response.body) return { ok: false, status: response.status, totalMs: performance.now() - started, ttftMs: null };
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let ttftMs = null;
    while (true) {
      const { value: chunk, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(chunk, { stream: true });
      if (ttftMs === null && /event: (?:token|replace)\n/.test(buffer)) ttftMs = performance.now() - started;
    }
    return { ok: buffer.includes('event: done'), status: response.status, totalMs: performance.now() - started, ttftMs };
  } catch (error) { return { ok: false, status: 0, totalMs: performance.now() - started, ttftMs: null, error: error.name }; }
}

function percentile(values, p) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  return Math.round(sorted[Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1)]);
}

async function main() {
  const results = [];
  for (const level of levels) {
    for (let round = 0; round < rounds; round += 1) {
      const batch = await Promise.all(Array.from({ length: level }, (_, index) => one(index + round * level, level)));
      results.push({ concurrency: level, round, total: batch.length, errors: batch.filter((item) => !item.ok).length, p50TotalMs: percentile(batch.map((item) => item.totalMs), 50), p95TotalMs: percentile(batch.map((item) => item.totalMs), 95), p99TotalMs: percentile(batch.map((item) => item.totalMs), 99), p50TtftMs: percentile(batch.filter((item) => item.ttftMs !== null).map((item) => item.ttftMs), 50), p95TtftMs: percentile(batch.filter((item) => item.ttftMs !== null).map((item) => item.ttftMs), 95) });
    }
  }
  const summary = { baseUrl, levels, rounds, results };
  console.log(JSON.stringify(summary, null, 2));
}

main().catch((error) => { console.error(JSON.stringify({ error: error.name })); process.exitCode = 1; });
