const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const babel = require('@babel/core');

function loadSourceModule(filename, cache = new Map()) {
  const absolute = path.resolve(filename);
  if (cache.has(absolute)) return cache.get(absolute).exports;
  const transformed = babel.transformFileSync(absolute, {
    babelrc: false,
    configFile: false,
    presets: [['babel-preset-expo', { lazyImports: false }]],
  });
  const moduleValue = { exports: {} };
  cache.set(absolute, moduleValue);
  const localRequire = (request) => {
    if (!request.startsWith('.')) return require(request);
    const resolved = require.resolve(path.resolve(path.dirname(absolute), request));
    return loadSourceModule(resolved, cache);
  };
  const evaluate = new Function(
    'require',
    'module',
    'exports',
    '__filename',
    '__dirname',
    transformed.code
  );
  evaluate(localRequire, moduleValue, moduleValue.exports, absolute, path.dirname(absolute));
  return moduleValue.exports;
}

const projectRoot = path.resolve(__dirname, '..');
const prediction = loadSourceModule(path.join(projectRoot, 'src/services/cyclePrediction.js'));
const validation = loadSourceModule(path.join(projectRoot, 'src/services/periodValidation.js'));
const dates = loadSourceModule(path.join(projectRoot, 'src/utils/dateKey.js'));

test('first-ever period is retained without fabricating a prediction', () => {
  const periods = [{ id: 'first', startDate: '2024-01-04', endDate: '2024-01-08' }];
  const pattern = prediction.calculateCyclePattern(periods);

  assert.equal(pattern.periods.length, 1);
  assert.equal(pattern.periodLength, 5);
  assert.equal(pattern.cycleLength, null);
  assert.equal(pattern.confidence, 'low');
  assert.equal(prediction.predictCycle(periods, [], '2024-01-09'), null);
});
test('one previous cycle produces a history-based low-confidence estimate', () => {
  const periods = [
    { id: 'one', startDate: '2024-01-01', endDate: '2024-01-05' },
    { id: 'two', startDate: '2024-02-07', endDate: '2024-02-11' },
  ];
  const result = prediction.predictCycle(periods, [], '2024-02-12');

  assert.equal(result.cycleLength, 37);
  assert.equal(result.nextPeriodStart, '2024-03-15');
  assert.equal(result.confidence, 'low');
  assert.equal(result.dataPointsUsed, 1);
});

test('irregular history is used without a 28-day assumption or judgement', () => {
  const periods = ['2024-01-01', '2024-01-22', '2024-03-02', '2024-03-27', '2024-05-21']
    .map((startDate, index) => ({ id: `irregular-${index}`, startDate, endDate: startDate }));
  const pattern = prediction.calculateCyclePattern(periods);

  assert.deepEqual(pattern.cycleLengths, [21, 40, 25, 55]);
  assert.equal(pattern.cycleLength, 40);
  assert.equal(pattern.confidence, 'low');
  assert.notEqual(pattern.cycleLength, 28);
});

test('missing end dates remain valid and do not invent a recorded duration', () => {
  const periods = [
    { id: 'complete', startDate: '2024-01-01', endDate: '2024-01-03' },
    { id: 'ongoing', startDate: '2024-02-01', endDate: null },
  ];
  const pattern = prediction.calculateCyclePattern(periods);
  const result = prediction.predictCycle(periods, [], '2024-02-02');

  assert.equal(pattern.periods.length, 2);
  assert.equal(pattern.periods[1].end, null);
  assert.equal(pattern.periodLength, 3);
  assert.equal(result.nextPeriodStart, '2024-03-03');
});

test('duplicate starts are rejected and ignored safely in legacy prediction history', () => {
  const existing = { id: 'existing', startDate: '2024-01-01', endDate: '2024-01-05' };
  const duplicate = { id: 'duplicate', startDate: '2024-01-01', endDate: '2024-01-06' };
  const result = validation.validatePeriodChange(duplicate, [existing]);
  const pattern = prediction.calculateCyclePattern([existing, duplicate]);

  assert.equal(result.valid, false);
  assert.equal(result.code, 'period-date-conflict');
  assert.equal(pattern.periods.length, 1);
  assert.equal(pattern.ignoredDataPoints, 1);
});

test('overlapping ranges are rejected while adjacent ranges remain valid', () => {
  const existing = { id: 'existing', startDate: '2024-01-01', endDate: '2024-01-05' };
  const overlap = validation.validatePeriodChange(
    { startDate: '2024-01-05', endDate: '2024-01-08' },
    [existing]
  );
  const adjacent = validation.validatePeriodChange(
    { startDate: '2024-01-06', endDate: '2024-01-08' },
    [existing]
  );
  const legacyPattern = prediction.calculateCyclePattern([
    existing,
    { id: 'overlap', startDate: '2024-01-04', endDate: '2024-01-09' },
    { id: 'later', startDate: '2024-02-04', endDate: '2024-02-08' },
  ]);

  assert.equal(overlap.code, 'period-overlap');
  assert.equal(adjacent.valid, true);
  assert.equal(legacyPattern.periods.length, 2);
  assert.equal(legacyPattern.ignoredDataPoints, 1);
});

test('editing a start date moves only that entry and preserves its recorded fields', () => {
  const existing = {
    id: 'period-one',
    startDate: '2024-01-01',
    endDate: '2024-01-05',
    flow: 'heavy',
    source: 'manual',
    note: 'preserve me',
  };
  const other = { id: 'period-two', startDate: '2024-02-01', endDate: '2024-02-04' };
  const edited = { ...existing, startDate: '2024-01-02', endDate: '2024-01-06' };
  const checked = validation.validatePeriodChange(edited, [existing, other], {
    previousId: existing.id,
    previousStartDate: existing.startDate,
  });
  const merged = validation.mergePeriodChange([existing, other], edited, {
    previousId: existing.id,
    previousStartDate: existing.startDate,
  });

  assert.equal(checked.valid, true);
  assert.deepEqual(merged.map((item) => item.startDate), ['2024-01-02', '2024-02-01']);
  assert.equal(merged[0].note, 'preserve me');
  assert.equal(merged[0].flow, 'heavy');
});

test('editing an end date rejects overlap and accepts a non-overlapping range', () => {
  const first = { id: 'first', startDate: '2024-01-01', endDate: '2024-01-04' };
  const second = { id: 'second', startDate: '2024-01-08', endDate: '2024-01-11' };
  const options = { previousId: first.id, previousStartDate: first.startDate };

  assert.equal(
    validation.validatePeriodChange({ ...first, endDate: '2024-01-08' }, [first, second], options).code,
    'period-overlap'
  );
  assert.equal(
    validation.validatePeriodChange({ ...first, endDate: '2024-01-07' }, [first, second], options).valid,
    true
  );
});

test('deleting a period removes the intended model entry without mutating history', () => {
  const history = [
    { id: 'first', startDate: '2024-01-01' },
    { id: 'second', startDate: '2024-02-01' },
  ];
  const result = validation.removePeriodEntry(history, 'first');

  assert.deepEqual(result, [{ id: 'second', startDate: '2024-02-01' }]);
  assert.equal(history.length, 2);
});

test('leap-day and December-to-January calculations stay on local calendar dates', () => {
  const leap = prediction.predictCycle([
    { startDate: '2024-02-01', endDate: '2024-02-04' },
    { startDate: '2024-02-29', endDate: '2024-03-03' },
  ], [], '2024-03-01');
  const yearBoundary = prediction.predictCycle([
    { startDate: '2023-12-15', endDate: '2023-12-19' },
    { startDate: '2024-01-15', endDate: '2024-01-19' },
  ], [], '2024-01-20');

  assert.equal(leap.cycleLength, 28);
  assert.equal(leap.nextPeriodStart, '2024-03-28');
  assert.equal(yearBoundary.cycleLength, 31);
  assert.equal(yearBoundary.nextPeriodStart, '2024-02-15');
});

test('near-midnight Date values retain the device-local calendar key', () => {
  const beforeMidnight = new Date(2024, 11, 31, 23, 59, 59, 999);
  const afterMidnight = new Date(2025, 0, 1, 0, 0, 0, 1);

  assert.equal(dates.localDateKey(beforeMidnight), '2024-12-31');
  assert.equal(dates.localDateKey(afterMidnight), '2025-01-01');
  assert.equal(dates.localDateKey('2024-02-29'), '2024-02-29');
});

test('malformed cached history is ignored without crashing valid predictions', () => {
  const malformed = [
    null,
    {},
    { startDate: '2024-02-30' },
    { startDate: 'not-a-date', endDate: '2024-01-02' },
    { startDate: '2024-01-01', endDate: '2023-12-31' },
    { id: 'valid-one', startDate: '2024-01-01', endDate: '2024-01-04' },
    { id: 'valid-two', startDate: '2024-02-01', endDate: null },
  ];
  const pattern = prediction.calculateCyclePattern(malformed);
  const result = prediction.predictCycle(malformed, [], '2024-02-02');

  assert.equal(pattern.periods.length, 2);
  assert.equal(pattern.ignoredDataPoints, 5);
  assert.equal(result.cycleLength, 31);
  assert.match(result.confidenceNote, /ignored 5 conflicting or invalid logs/);
});

test('short and long cycle intervals are retained instead of forced to a standard length', () => {
  const pattern = prediction.calculateCyclePattern([
    { startDate: '2024-01-01', endDate: '2024-01-02' },
    { startDate: '2024-01-11', endDate: '2024-01-12' },
    { startDate: '2024-05-10', endDate: '2024-05-12' },
  ]);

  assert.deepEqual(pattern.cycleLengths, [10, 120]);
  assert.notEqual(pattern.cycleLength, 28);
});
