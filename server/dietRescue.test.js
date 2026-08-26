const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const babel = require('@babel/core');

const filename = path.resolve(__dirname, '../src/services/dietRescue.js');
const transformed = babel.transformFileSync(filename, {
  babelrc: false,
  configFile: false,
  presets: [['babel-preset-expo', { lazyImports: false }]],
});
const moduleValue = { exports: {} };
new Function('require', 'module', 'exports', transformed.code)(require, moduleValue, moduleValue.exports);
const diet = moduleValue.exports;

test('every direct craving has at least four local rescues and returns exactly three', () => {
  ['sweet', 'salty', 'crunchy', 'filling', 'warm'].forEach((category) => {
    assert.ok(diet.RESCUE_CATALOG.filter((item) => item.category === category).length >= 4);
    assert.equal(diet.getRescuesForCraving(category).length, 3);
  });
});

test('Not sure mixes sweet, salty and crunchy while respecting exclusions', () => {
  const first = diet.getRescuesForCraving('not_sure');
  const second = diet.getRescuesForCraving('not_sure', { excludedIds: first.map((item) => item.id) });
  assert.equal(first.length, 3);
  assert.ok(first.every((item) => ['sweet', 'salty', 'crunchy'].includes(item.category)));
  assert.ok(second.every((item) => !first.some((prior) => prior.id === item.id)));
});

test('kit rescues rank first and kit estimates use catalog prices only', () => {
  const results = diet.getRescuesForCraving('sweet', { kitIds: ['dates-nuts'] });
  assert.equal(results[0].id, 'dates-nuts');
  assert.equal(diet.kitEstimate(['dates-nuts', 'unknown']), 55);
});
