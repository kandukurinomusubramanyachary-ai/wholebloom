const test = require('node:test');
const assert = require('node:assert/strict');
const { RequestCoordinator } = require('../src/reliability/requestCoordinator');

test('request coordinator has one owner for concurrent identical work', async () => {
  const coordinator = new RequestCoordinator();
  const first = coordinator.begin('same'); const second = coordinator.begin('same');
  assert.equal(first.owner, true); assert.equal(second.owner, false);
  first.resolve?.({ text: 'one generation' });
  assert.deepEqual(await second.promise, { text: 'one generation' });
  assert.equal(coordinator.size(), 0);
});
