import { compareAsc, isAfter, isBefore, isValid, parseISO } from 'date-fns';
import { localDateKey } from '../utils/dateKey';

const LOCAL_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export const PERIOD_ERROR_CODES = {
  invalidStart: 'period-invalid-start',
  invalidEnd: 'period-invalid-end',
  invalidRange: 'period-invalid-range',
  futureStart: 'period-future-start',
  futureEnd: 'period-future-end',
  duplicateStart: 'period-date-conflict',
  overlap: 'period-overlap',
};

function dateFromKey(value) {
  if (typeof value !== 'string' || !LOCAL_DATE_PATTERN.test(value)) return null;
  const parsed = parseISO(value);
  if (!isValid(parsed)) return null;
  const [year, month, day] = value.split('-').map(Number);
  if (
    parsed.getFullYear() !== year
    || parsed.getMonth() !== month - 1
    || parsed.getDate() !== day
  ) return null;
  return parsed;
}

function invalid(code, message, conflict = null) {
  return { valid: false, code, message, conflict };
}

export function periodRange(period) {
  if (!period || typeof period !== 'object' || Array.isArray(period)) return null;
  const start = dateFromKey(period.startDate);
  if (!start) return null;
  const hasEnd = period.endDate !== null
    && period.endDate !== undefined
    && period.endDate !== '';
  const end = hasEnd ? dateFromKey(period.endDate) : start;
  if (!end || isBefore(end, start)) return null;
  return { start, end, startDate: period.startDate, endDate: hasEnd ? period.endDate : null };
}

export function periodsOverlap(first, second) {
  const firstRange = periodRange(first);
  const secondRange = periodRange(second);
  if (!firstRange || !secondRange) return false;
  return !isBefore(firstRange.end, secondRange.start)
    && !isBefore(secondRange.end, firstRange.start);
}

function isExcluded(period, options) {
  if (options.previousId && period.id === options.previousId) return true;
  return Boolean(
    options.previousStartDate
    && period.startDate === options.previousStartDate
  );
}

export function validatePeriodChange(candidate, history = [], options = {}) {
  const start = dateFromKey(candidate?.startDate);
  if (!start) {
    return invalid(PERIOD_ERROR_CODES.invalidStart, 'Choose a valid period start date.');
  }

  const hasEnd = candidate.endDate !== null
    && candidate.endDate !== undefined
    && candidate.endDate !== '';
  const end = hasEnd ? dateFromKey(candidate.endDate) : start;
  if (hasEnd && !end) {
    return invalid(PERIOD_ERROR_CODES.invalidEnd, 'Choose a valid period end date.');
  }
  if (isBefore(end, start)) {
    return invalid(PERIOD_ERROR_CODES.invalidRange, 'End date cannot be before the start date.');
  }
  const maximumDate = dateFromKey(options.maximumDate || localDateKey());
  if (maximumDate && isAfter(start, maximumDate)) {
    return invalid(PERIOD_ERROR_CODES.futureStart, 'Start date cannot be in the future.');
  }
  if (maximumDate && isAfter(end, maximumDate)) {
    return invalid(PERIOD_ERROR_CODES.futureEnd, 'End date cannot be in the future.');
  }

  const comparableCandidate = {
    ...candidate,
    startDate: candidate.startDate,
    endDate: hasEnd ? candidate.endDate : null,
  };
  const otherPeriods = (Array.isArray(history) ? history : [])
    .filter((period) => period && typeof period === 'object' && !isExcluded(period, options));

  const duplicate = otherPeriods.find((period) => period.startDate === candidate.startDate);
  if (duplicate) {
    return invalid(
      PERIOD_ERROR_CODES.duplicateStart,
      'A period is already logged for this start date.',
      duplicate
    );
  }

  const overlap = otherPeriods.find((period) => periodsOverlap(comparableCandidate, period));
  if (overlap) {
    return invalid(
      PERIOD_ERROR_CODES.overlap,
      'These dates overlap another logged period.',
      overlap
    );
  }

  return {
    valid: true,
    code: null,
    message: '',
    period: comparableCandidate,
  };
}

export function assertValidPeriodChange(candidate, history = [], options = {}) {
  const result = validatePeriodChange(candidate, history, options);
  if (result.valid) return result.period;
  const error = new Error(result.message);
  error.code = result.code;
  error.conflict = result.conflict;
  throw error;
}

export function mergePeriodChange(history = [], savedPeriod, options = {}) {
  const periods = Array.isArray(history) ? history : [];
  if (!savedPeriod?.startDate) return [...periods];
  const previous = periods.find((period) => (
    (options.previousId && period.id === options.previousId)
    || (options.previousStartDate && period.startDate === options.previousStartDate)
  ));
  const merged = previous ? { ...previous, ...savedPeriod } : { ...savedPeriod };
  return periods
    .filter((period) => (
      period !== previous
      && period.startDate !== savedPeriod.startDate
    ))
    .concat(merged)
    .sort((first, second) => compareAsc(
      dateFromKey(first.startDate) || new Date(0),
      dateFromKey(second.startDate) || new Date(0)
    ));
}

export function removePeriodEntry(history = [], idOrStartDate) {
  return (Array.isArray(history) ? history : []).filter((period) => (
    period?.id !== idOrStartDate && period?.startDate !== idOrStartDate
  ));
}
