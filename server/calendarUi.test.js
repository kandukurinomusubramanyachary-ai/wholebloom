const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const projectRoot = path.resolve(__dirname, '..');
const read = (relativePath) => fs.readFileSync(path.join(projectRoot, relativePath), 'utf8');

test('Log Period uses the same tappable calendar for start and end dates', () => {
  const screen = read('src/screens/LogPeriodScreen.js');

  assert.match(screen, /CalendarDatePicker/);
  assert.match(screen, /setDatePickerTarget\('start'\)/);
  assert.match(screen, /setDatePickerTarget\('end'\)/);
  assert.match(screen, /minimumDate=\{datePickerTarget === 'end' \? startDate : undefined\}/);
  assert.match(screen, /disableNext=\{startDate >= today\}/);
  assert.match(screen, /End date cannot be before the start date\./);
});

test('calendar exposes month, year, Today and accessible date navigation controls', () => {
  const picker = read('src/components/CalendarDatePicker.js');

  assert.match(picker, /Choose a month/);
  assert.match(picker, /Choose a year/);
  assert.match(picker, /Previous month,/);
  assert.match(picker, /Next month,/);
  assert.match(picker, /Choose month and year, currently/);
  assert.match(picker, /accessibilityLabel=\{`Select \$\{format\(cellDate, 'MMMM d, yyyy'\)/);
  assert.match(picker, /accessibilityLabel='Select today'/);
  assert.match(picker, /minHeight: 44/);
});
