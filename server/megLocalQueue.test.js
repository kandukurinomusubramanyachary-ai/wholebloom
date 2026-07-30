const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const babel = require('@babel/core');

function loadQueueModule() {
  const filename = path.resolve(__dirname, '../src/services/megLocalQueue.js');
  const transformed = babel.transformFileSync(filename, {
    babelrc: false,
    configFile: false,
    presets: [['babel-preset-expo', { lazyImports: false }]],
  });
  const moduleValue = { exports: {} };
  const evaluate = new Function(
    'require',
    'module',
    'exports',
    '__filename',
    '__dirname',
    transformed.code
  );
  evaluate(require, moduleValue, moduleValue.exports, filename, path.dirname(filename));
  return moduleValue.exports;
}

const queue = loadQueueModule();

test('Meg local merge retains a failed delivery marker while adding remote fields', () => {
  const merged = queue.mergeMegConversations(
    [{
      id: 'conversation-1',
      updatedAt: '2026-07-30T10:00:00.000Z',
      messages: [{
        id: 'message-1',
        role: 'user',
        text: 'Hello',
        createdAt: '2026-07-30T10:00:00.000Z',
        deliveryStatus: 'failed',
      }],
    }],
    [{
      id: 'conversation-1',
      updatedAt: '2026-07-30T10:01:00.000Z',
      messageCount: 1,
      messages: [{
        id: 'message-1',
        role: 'user',
        text: 'Hello',
        createdAt: '2026-07-30T10:00:00.000Z',
      }],
    }]
  );

  assert.equal(merged.length, 1);
  assert.equal(merged[0].messageCount, 1);
  assert.equal(merged[0].messages[0].deliveryStatus, 'failed');
});

test('Meg failed final message can be rebuilt as an idempotent retry request', () => {
  const messages = [{
    id: 'message-1',
    role: 'user',
    text: 'I have a headache',
    deliveryStatus: 'failed',
  }];
  const retry = queue.recoverableMegRequest(messages, 'conversation-1', 'explain');

  assert.equal(retry.messageId, 'message-1');
  assert.equal(retry.conversationId, 'conversation-1');
  assert.equal(retry.message, 'I have a headache');
  assert.equal(retry.mode, 'explain');
  assert.equal(queue.recoverableMegRequest([
    ...messages,
    { id: 'assistant-1', role: 'assistant', text: 'Reply' },
  ], 'conversation-1'), null);
});

test('Meg delivery status changes only the selected user message', () => {
  const messages = [
    { id: 'user-1', role: 'user', deliveryStatus: 'pending' },
    { id: 'assistant-1', role: 'assistant' },
  ];
  const failed = queue.setMegMessageDelivery(messages, 'user-1', 'failed');

  assert.equal(failed[0].deliveryStatus, 'failed');
  assert.deepEqual(failed[1], messages[1]);
});
