const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const { GroqProvider } = require('../src/providers/groq');
const { OpenRouterProvider } = require('../src/providers/openrouter');
const { OllamaProvider } = require('../src/providers/ollama');
const { GeminiProvider } = require('../src/providers/gemini');

async function collect(iterable) { let result = ''; for await (const token of iterable) result += token; return result; }
async function serverFor(handler) { const server = http.createServer(handler); await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve)); return server; }

test('OpenAI-compatible adapters normalize streamed provider payloads', async () => {
  const server = await serverFor((req, res) => { res.writeHead(200, { 'content-type': 'text/event-stream' }); res.write('data: {"choices":[{"delta":{"content":"hello "}}]}\n\n'); res.write('data: {"choices":[{"delta":{"content":"world"}}]}\n\n'); res.end('data: [DONE]\n\n'); });
  try {
    const url = `http://127.0.0.1:${server.address().port}/v1`;
    assert.equal(await collect(new GroqProvider({ apiKey: 'x', model: 'm', baseUrl: url }).stream({ messages: [] })), 'hello world');
    assert.equal(await collect(new OpenRouterProvider({ apiKey: 'x', model: 'm', baseUrl: url }).stream({ messages: [] })), 'hello world');
  } finally { await new Promise((resolve) => server.close(resolve)); }
});

test('Gemini and Ollama adapters normalize their native streams', async () => {
  const server = await serverFor((req, res) => {
    if (req.url.includes('streamGenerateContent')) {
      res.writeHead(200, { 'content-type': 'text/event-stream' }); res.end('data: {"candidates":[{"content":{"parts":[{"text":"nam"}]}}]}\n\ndata: {"candidates":[{"content":{"parts":[{"text":"aste"}]}}]}\n\n');
    } else {
      res.writeHead(200, { 'content-type': 'application/x-ndjson' }); res.end('{"message":{"content":"local"}}\n{"done":true}\n');
    }
  });
  try {
    const url = `http://127.0.0.1:${server.address().port}`;
    assert.equal(await collect(new GeminiProvider({ apiKey: 'x', model: 'm', baseUrl: url }).stream({ messages: [] })), 'namaste');
    assert.equal(await collect(new OllamaProvider({ url, model: 'm' }).stream({ messages: [] })), 'local');
  } finally { await new Promise((resolve) => server.close(resolve)); }
});
