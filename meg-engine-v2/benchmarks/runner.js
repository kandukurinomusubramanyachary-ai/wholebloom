#!/usr/bin/env node
try { require('dotenv').config(); } catch {}
const fs = require('node:fs');
const path = require('node:path');
const { loadConfig } = require('../src/config/env');
const { createProviders, ProviderManager } = require('../src/providers');
const { classifyIntentDetailed } = require('../src/router/intentRouter');
const { routeRequest } = require('../src/router/modelRouter');
const { detectSafety } = require('../src/safety/safetyRouter');
const { buildContext } = require('../src/context/contextBuilder');
const { buildMegPrompt } = require('../src/prompts/promptBuilder');
const { guardResponse } = require('../src/guards/responseGuard');
const { scoreResponse } = require('../src/quality/qualityScorer');

function loadCases() { return JSON.parse(fs.readFileSync(path.join(__dirname, 'cases.json'), 'utf8')).cases; }
function arg(name, fallback = null) { const index = process.argv.indexOf(`--${name}`); return index >= 0 ? (process.argv[index + 1] || fallback) : fallback; }

async function main() {
  const cases = loadCases();
  const config = loadConfig();
  const deterministic = cases.map((item) => {
    const message = item.turns.at(-1).content;
    const safety = detectSafety(message);
    const details = classifyIntentDetailed({ message, safety });
    const route = routeRequest({ message, safety, intentDetails: details, providerOrders: config.providerOrders });
    return { id: item.id, category: item.category, expectedIntent: item.expectedIntent, actualIntent: route.intent, expectedRoute: item.expectedRoute, actualRoute: route.route, intentPass: route.intent === item.expectedIntent, routePass: route.route === item.expectedRoute, confidence: route.confidence, reasons: route.reasons };
  });
  const summary = summarize(deterministic);
  const output = { benchmarkVersion: '1.0.0', caseCount: cases.length, deterministic: summary, results: deterministic };

  if (process.argv.includes('--live')) {
    const providerName = arg('provider');
    const config = loadConfig();
    const providers = createProviders(config);
    const names = providerName ? [providerName] : Object.keys(providers);
    output.live = {};
    for (const name of names) output.live[name] = await runProvider(name, providers[name], cases, config);
  }
  const outFile = arg('out');
  if (outFile) fs.writeFileSync(outFile, JSON.stringify(output, null, 2));
  console.log(JSON.stringify({ benchmarkVersion: output.benchmarkVersion, caseCount: output.caseCount, deterministic: summary, live: output.live ? Object.fromEntries(Object.entries(output.live).map(([name, value]) => [name, { configured: value.configured, completed: value.completed, validityRate: value.validityRate, avgTtftMs: value.avgTtftMs, avgQuality: value.avgQuality }])) : undefined }, null, 2));
}

async function runProvider(name, provider, cases, config) {
  if (!provider || !provider.isConfigured()) return { configured: false, completed: 0, validityRate: 0, avgTtftMs: null };
  const manager = new ProviderManager({ providers: { [name]: provider }, config: { ...config, retries: 0, providerOrders: undefined } });
  const measurements = [];
  for (const item of cases) {
    const message = item.turns.at(-1).content;
    const safety = detectSafety(message);
    const details = classifyIntentDetailed({ message, safety });
    const route = routeRequest({ message, safety, intentDetails: details, providerOrders: { FAST: [name], SMART: [name], SAFETY: [name], DOCTOR: [name], LOCAL: [name] } });
    const prompt = buildMegPrompt({ intent: route.intent, context: buildContext({ intent: route.intent, message, context: {} }), recentMessages: item.turns.slice(0, -1), message, tokenBudget: config.tokenBudget, promptVersion: config.promptVersion });
    const state = {};
    const started = Date.now();
    let text = '';
    try { for await (const token of manager.stream({ providerNames: [name], route: route.route, messages: prompt, maxTokens: config.maxOutputTokens }, state)) text += token; } catch { /* recorded as failed measurement, never prints content */ }
    const finished = Date.now();
    const guarded = guardResponse(text, { maxChars: config.maxResponseChars, safety: safety.triggered, safetyCategory: safety.category });
    const quality = scoreResponse(text, { safety: safety.triggered, safetyCategory: safety.category });
    measurements.push({ id: item.id, valid: guarded.ok, ttftMs: state.firstTokenAt ? state.firstTokenAt - started : null, totalMs: finished - started, outputTokens: Math.ceil(text.length / 4), quality });
  }
  const completed = measurements.filter((item) => item.totalMs > 0 && item.valid).length;
  const ttfts = measurements.filter((item) => item.ttftMs !== null).map((item) => item.ttftMs);
  const qualityScores = measurements.map((item) => item.quality.overall);
  return { configured: true, completed, validityRate: completed / cases.length, avgTtftMs: ttfts.length ? Math.round(ttfts.reduce((a, b) => a + b, 0) / ttfts.length) : null, avgQuality: qualityScores.length ? qualityScores.reduce((a, b) => a + b, 0) / qualityScores.length : null, measurements };
}

function summarize(results) {
  const byCategory = {};
  for (const item of results) {
    const group = byCategory[item.category] || { total: 0, intentPass: 0, routePass: 0 };
    group.total += 1; group.intentPass += item.intentPass ? 1 : 0; group.routePass += item.routePass ? 1 : 0; byCategory[item.category] = group;
  }
  return { intentAccuracy: results.filter((item) => item.intentPass).length / results.length, routeAccuracy: results.filter((item) => item.routePass).length / results.length, byCategory };
}

main().catch((error) => { console.error(JSON.stringify({ error: error.code || error.name })); process.exitCode = 1; });
