const fs = require('node:fs');
const path = require('node:path');
const { evaluateTurn } = require('../src/engine');

const cases = JSON.parse(fs.readFileSync(path.join(__dirname, 'cases.json'), 'utf8'));
const now = new Date('2026-09-06T05:30:00.000Z');

let passed = 0;
const failures = [];

for (const item of cases) {
  const result = evaluateTurn({
    message: item.message,
    context: item.context || {},
    intent: item.intent || 'casual',
    recentMessages: item.recentMessages || [],
    memories: item.memories || [],
    now,
  });

  const actualFamily = result.intervention.selected.family;
  const actualRisk = result.state.risk.level;
  const familyPass = actualFamily === item.expectedFamily;
  const riskPass = actualRisk === item.expectedRisk;
  const ok = familyPass && riskPass;

  if (ok) passed += 1;
  else failures.push({
    id: item.id,
    expectedFamily: item.expectedFamily,
    actualFamily,
    expectedRisk: item.expectedRisk,
    actualRisk,
    needs: result.state.needs,
    evidence: result.state.evidence,
    candidates: result.intervention.candidates,
  });

  process.stdout.write(`${ok ? 'PASS' : 'FAIL'} ${item.id} -> ${actualFamily} / risk=${actualRisk}\n`);
}

const accuracy = cases.length ? passed / cases.length : 0;
process.stdout.write(`\nMeg v3 intervention benchmark: ${passed}/${cases.length} (${(accuracy * 100).toFixed(1)}%)\n`);

if (failures.length) {
  process.stdout.write(`${JSON.stringify({ failures }, null, 2)}\n`);
  process.exitCode = 1;
}
