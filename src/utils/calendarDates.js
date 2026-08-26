import {
  addDays,
  endOfMonth,
  endOfWeek,
  format,
  isAfter,
  isBefore,
  isValid,
  parseISO,
  startOfMonth,
  startOfWeek,
} from 'date-fns';
import { localDateKey } from './dateKey';

export const CALENDAR_YEAR_LOOKBACK = 100;

export function parseCalendarDate(value) {
  if (typeof value !== 'string') return null;
  const parsed = parseISO(value);
  return isValid(parsed) && format(parsed, 'yyyy-MM-dd') === value ? parsed : null;
}

export function calendarBounds({ minimumDate, maximumDate } = {}) {
  const maximum = parseCalendarDate(maximumDate) || parseCalendarDate(localDateKey());
  const defaultMinimum = new Date(maximum.getFullYear() - CALENDAR_YEAR_LOOKBACK, 0, 1);
  const requestedMinimum = parseCalendarDate(minimumDate);
  const minimum = requestedMinimum && !isAfter(requestedMinimum, maximum)
    ? requestedMinimum
    : defaultMinimum;
  return { minimum, maximum };
}

export function isCalendarDateSelectable(value, bounds) {
  const date = parseCalendarDate(value);
  if (!date) return false;
  const { minimum, maximum } = calendarBounds(bounds);
  return !isBefore(date, minimum) && !isAfter(date, maximum);
}

export function calendarMonthCells(monthValue) {
  const parsed = parseCalendarDate(monthValue) || parseCalendarDate(localDateKey());
  const monthStart = startOfMonth(parsed);
  const gridStart = startOfWeek(monthStart, { weekStartsOn: 0 });
  const gridEnd = endOfWeek(endOfMonth(monthStart), { weekStartsOn: 0 });
  const cells = [];
  for (let date = gridStart; !isAfter(date, gridEnd); date = addDays(date, 1)) {
    cells.push({
      dateKey: localDateKey(date),
      day: date.getDate(),
      inMonth: date.getMonth() === monthStart.getMonth(),
    });
  }
  return cells;
}

export function monthHasSelectableDate(year, monthIndex, bounds) {
  const { minimum, maximum } = calendarBounds(bounds);
  const monthStart = new Date(year, monthIndex, 1);
  const monthEnd = endOfMonth(monthStart);
  return !isBefore(monthEnd, minimum) && !isAfter(monthStart, maximum);
}

export function calendarYears(bounds) {
  const { minimum, maximum } = calendarBounds(bounds);
  const years = [];
  for (let year = maximum.getFullYear(); year >= minimum.getFullYear(); year -= 1) {
    years.push(year);
  }
  return years;
}
