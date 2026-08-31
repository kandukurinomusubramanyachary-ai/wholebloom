const test = require('node:test');
const assert = require('node:assert/strict');
const { parseSse, formatSse } = require('../src/utils/sse');

test('SSE parser handles split UTF-8 data frames', async () => {
  const encoded = new TextEncoder().encode(formatSse('token', { text: 'नमस्ते 🌸' }));
  const split = [encoded.slice(0, 3), encoded.slice(3, 9), encoded.slice(9)];
  const body = (async function* () { for (const part of split) yield part; })();
  const frames = []; for await (const frame of parseSse(body)) frames.push(JSON.parse(frame));
  assert.equal(frames[0].text, 'नमस्ते 🌸');
});
