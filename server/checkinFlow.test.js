const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const babel = require('@babel/core');

function loadSourceModule(filename) {
  const absolute = path.resolve(filename);
  const transformed = babel.transformFileSync(absolute, {
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
  evaluate(require, moduleValue, moduleValue.exports, absolute, path.dirname(absolute));
  return moduleValue.exports;
}

const projectRoot = path.resolve(__dirname, '..');
const { normalizeCheckin } = loadSourceModule(path.join(projectRoot, 'src/models.js'));

test('malformed legacy check-in fields are safe before the form renders or saves', () => {
  const checkin = normalizeCheckin({
    date: '2026-08-25',
    symptoms: { cramps: true },
    symptomSeverity: [],
    movement: { note: { legacy: true } },
    movementNote: { legacy: true },
    medication: { taken: 'yes', name: { legacy: true } },
    medicationName: { legacy: true },
    notes: { legacy: true },
  });

  assert.deepEqual(checkin.symptoms, []);
  assert.deepEqual(checkin.symptomSeverity, {});
  assert.equal(checkin.movement, null);
  assert.equal(checkin.movementNote, null);
  assert.equal(checkin.medicationName, null);
  assert.equal(checkin.medicationTaken, null);
  assert.equal(checkin.notes, '');
});

test('legacy nested text values normalize to form-safe strings', () => {
  const checkin = normalizeCheckin({
    date: '2026-08-25',
    movement: { note: 'Gentle walk' },
    medication: { taken: true, name: 'Vitamin D' },
    notes: null,
  });

  assert.equal(checkin.movementNote, 'Gentle walk');
  assert.equal(checkin.medicationName, 'Vitamin D');
  assert.equal(checkin.medicationTaken, true);
  assert.equal(checkin.notes, '');
  assert.doesNotThrow(() => {
    checkin.movementNote.trim();
    checkin.medicationName.trim();
    checkin.notes.trim();
  });
});

test('current numeric check-in choices survive normalization', () => {
  const checkin = normalizeCheckin({
    date: '2026-08-25',
    energy: 7,
    sleepDuration: 8,
    water: 6,
    stress: 3,
  });

  assert.equal(checkin.energy, 7);
  assert.equal(checkin.sleepDuration, 8);
  assert.equal(checkin.water, 6);
  assert.equal(checkin.stress, 3);
});

test('Today launch and check-in save retain duplicate and recoverable-error guards', () => {
  const todaySource = fs.readFileSync(
    path.join(projectRoot, 'src/screens/TodayScreen.js'),
    'utf8'
  );
  const checkinSource = fs.readFileSync(
    path.join(projectRoot, 'src/screens/DailyCheckInScreen.js'),
    'utf8'
  );

  assert.match(todaySource, /if \(checkinLaunchRef\.current\)/);
  assert.match(todaySource, /loading=\{opening\}/);
  assert.match(todaySource, /could not open the check-in\. Please try again/);
  assert.match(checkinSource, /if \(savingRef\.current\) return/);
  assert.match(checkinSource, /typeof existingCheckin\?\.medication\?\.name === 'string'/);
  assert.match(checkinSource, /Try saving again/);
  assert.ok(
    checkinSource.indexOf('try {\n      const movementValue = movement.trim();') >= 0,
    'draft preparation must remain inside the recoverable save boundary'
  );
});
