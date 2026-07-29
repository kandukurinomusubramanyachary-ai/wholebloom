import { format, isValid, parseISO } from 'date-fns';

const LOCAL_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export function localDateKey(value = new Date()) {
  if (typeof value === 'string' && LOCAL_DATE_PATTERN.test(value)) {
    const parsed = parseISO(value);
    if (isValid(parsed) && format(parsed, 'yyyy-MM-dd') === value) return value;
  }

  const date = value instanceof Date ? value : new Date(value);
  if (!isValid(date)) return format(new Date(), 'yyyy-MM-dd');
  return format(date, 'yyyy-MM-dd');
}

export function requireLocalDateKey(value, label = 'date') {
  if (typeof value !== 'string' || !LOCAL_DATE_PATTERN.test(value)) {
    throw new Error(`Bloom needs a valid local ${label}.`);
  }

  const parsed = parseISO(value);
  if (!isValid(parsed) || format(parsed, 'yyyy-MM-dd') !== value) {
    throw new Error(`Bloom needs a valid local ${label}.`);
  }

  return value;
}

