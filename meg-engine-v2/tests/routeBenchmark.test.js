const test = require('node:test');
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');

test('deterministic benchmark fixture contains 200 cases and meets route target', () => {
  const output = execFileSync(process.execPath, ['benchmarks/runner.js'], { encoding: 'utf8' });
  const report = JSON.parse(output);
  assert.equal(report.caseCount, 200);
  assert.ok(report.deterministic.routeAccuracy >= 0.95);
});
