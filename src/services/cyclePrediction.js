import {
  addDays,
  differenceInCalendarDays,
  isAfter,
  isBefore,
  isValid,
  parseISO,
  subDays,
} from 'date-fns';
import { localDateKey } from '../utils/dateKey';
import { periodRange } from './periodValidation';

const DEFAULT_PERIOD_DAYS = 5;

function toDate(value) {
  if (!value) return null;
  const date = typeof value === 'string' ? parseISO(value) : value;
  return isValid(date) ? date : null;
}

function dateKey(date) {
  return localDateKey(date);
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function average(values) {
  if (!values.length) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function standardDeviation(values) {
  if (values.length < 2) return null;
  const mean = average(values);
  return Math.sqrt(average(values.map((value) => (value - mean) ** 2)));
}

function weightedAverage(values) {
  if (!values.length) return null;
  const totalWeight = values.reduce((sum, _, index) => sum + index + 1, 0);
  return values.reduce((sum, value, index) => sum + value * (index + 1), 0) / totalWeight;
}

export function calculateCyclePattern(periods = []) {
  const source = Array.isArray(periods) ? periods : [];
  const candidates = source
    .map((period) => {
      const range = periodRange(period);
      return range
        ? { ...period, start: range.start, end: range.endDate ? range.end : null }
        : null;
    })
    .filter(Boolean)
    .sort((a, b) => a.start - b.start);

  const normalized = candidates.reduce((result, period) => {
    const previous = result[result.length - 1];
    if (!previous) return [period];

    if (previous.start.getTime() === period.start.getTime()) {
      const previousEnd = previous.end?.getTime() || previous.start.getTime();
      const periodEnd = period.end?.getTime() || period.start.getTime();
      const preferPeriod = periodEnd > previousEnd
        || (periodEnd === previousEnd && String(period.id || '').localeCompare(String(previous.id || '')) > 0);
      return preferPeriod ? [...result.slice(0, -1), period] : result;
    }

    if (previous.end && !isBefore(previous.end, period.start)) {
      return [...result.slice(0, -1), period];
    }

    return [...result, period];
  }, []);

  const cycleLengths = normalized.slice(1).map((period, index) =>
    differenceInCalendarDays(period.start, normalized[index].start)
  ).filter((days) => days > 0);

  const periodLengths = normalized.map((period) => {
    if (!period.end || isBefore(period.end, period.start)) return null;
    return differenceInCalendarDays(period.end, period.start) + 1;
  }).filter((days) => days >= 1 && days <= 14);

  const cycleLength = weightedAverage(cycleLengths);
  const deviation = standardDeviation(cycleLengths);
  const periodLength = clamp(Math.round(average(periodLengths) || DEFAULT_PERIOD_DAYS), 2, 10);

  let confidence = 'low';
  if (cycleLengths.length >= 6 && deviation != null && deviation <= 1.5) confidence = 'high';
  else if (cycleLengths.length >= 3 && deviation != null && deviation <= 3) confidence = 'medium';

  return {
    periods: normalized,
    cycleLengths,
    cycleLength: cycleLength == null ? null : Math.round(cycleLength),
    periodLength,
    deviation,
    confidence,
    dataPointsUsed: cycleLengths.length,
    ignoredDataPoints: source.length - normalized.length,
  };
}

function symptomAdjustment(checkins, referenceDate, predictedStart) {
  if (!checkins?.length) return 0;
  const daysToPrediction = differenceInCalendarDays(predictedStart, referenceDate);
  if (daysToPrediction < -2 || daysToPrediction > 10) return 0;

  const pmsSignals = new Set([
    'cramps',
    'bloating',
    'headache',
    'fatigue',
    'breast_tenderness',
    'cravings',
    'mood_swings',
    'lower_back_pain',
    'irritability',
  ]);
  const recentStart = subDays(referenceDate, 6);
  const recent = checkins.filter((checkin) => {
    const date = toDate(checkin.date);
    return date && !isBefore(date, recentStart) && !isAfter(date, referenceDate);
  });
  const score = recent.reduce((total, checkin) => {
    const symptomScore = (checkin.symptoms || []).filter((id) => pmsSignals.has(id)).length;
    const moodScore = ['irritated', 'overwhelmed', 'emotionally_sensitive'].includes(checkin.mood) ? 1 : 0;
    return total + symptomScore + moodScore;
  }, 0);

  return score >= 3 ? -1 : 0;
}

export function predictCycle(periods = [], checkins = [], referenceValue = new Date()) {
  const pattern = calculateCyclePattern(periods);
  if (!pattern.cycleLength || pattern.periods.length < 2) return null;

  const referenceDate = toDate(referenceValue) || new Date();
  const latest = pattern.periods[pattern.periods.length - 1];
  const baseStart = addDays(latest.start, pattern.cycleLength);
  const adjustmentDays = symptomAdjustment(checkins, referenceDate, baseStart);
  const nextPeriodStart = addDays(baseStart, adjustmentDays);
  const nextPeriodEnd = addDays(nextPeriodStart, pattern.periodLength - 1);
  const pmsWindowDays = clamp(Math.round(pattern.cycleLength * 0.12), 3, 10);
  const pmsStart = subDays(nextPeriodStart, pmsWindowDays);
  const pmsEnd = subDays(nextPeriodStart, 1);

  const confidenceCopy = {
    low: {
      label: 'Confidence is building',
      note: 'More completed cycles will make this estimate more personal.',
    },
    medium: {
      label: 'Moderate confidence',
      note: 'This estimate follows your recent cycle pattern.',
    },
    high: {
      label: 'Higher confidence',
      note: 'Your recent logged cycles have followed a steadier pattern.',
    },
  }[pattern.confidence];
  const confidenceNote = pattern.ignoredDataPoints > 0
    ? `${confidenceCopy.note} Bloom ignored ${pattern.ignoredDataPoints} conflicting or invalid ${pattern.ignoredDataPoints === 1 ? 'log' : 'logs'} in this estimate.`
    : confidenceCopy.note;

  return {
    nextPeriodStart: dateKey(nextPeriodStart),
    nextPeriodEnd: dateKey(nextPeriodEnd),
    pmsStart: dateKey(pmsStart),
    pmsEnd: dateKey(pmsEnd),
    cycleLength: pattern.cycleLength,
    periodLength: pattern.periodLength,
    confidence: pattern.confidence,
    confidenceLabel: confidenceCopy.label,
    confidenceNote,
    dataPointsUsed: pattern.dataPointsUsed,
    ignoredDataPoints: pattern.ignoredDataPoints,
    symptomAdjustmentDays: adjustmentDays,
    daysUntilPeriod: differenceInCalendarDays(nextPeriodStart, referenceDate),
  };
}

export function predictionStateForDate(value, prediction) {
  const date = toDate(value);
  if (!date || !prediction) return { predictedPeriod: false, pms: false };
  const predictedStart = toDate(prediction.nextPeriodStart);
  const predictedEnd = toDate(prediction.nextPeriodEnd);
  const pmsStart = toDate(prediction.pmsStart);
  const pmsEnd = toDate(prediction.pmsEnd);
  return {
    predictedPeriod: predictedStart && predictedEnd
      ? !isBefore(date, predictedStart) && !isAfter(date, predictedEnd)
      : false,
    pms: pmsStart && pmsEnd
      ? !isBefore(date, pmsStart) && !isAfter(date, pmsEnd)
      : false,
  };
}
