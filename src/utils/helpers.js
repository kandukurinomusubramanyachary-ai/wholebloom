import { differenceInCalendarDays, addDays, format, parseISO, isValid } from 'date-fns';
import { CYCLE_PHASES } from './constants';

export function getCycleDay(periodStartDate, referenceDate = new Date()) {
  if (!periodStartDate) return null;
  const start = typeof periodStartDate === 'string' ? parseISO(periodStartDate) : periodStartDate;
  if (!isValid(start)) return null;
  const day = differenceInCalendarDays(referenceDate, start) + 1;
  return day > 0 ? day : null;
}

export function getCyclePhase(cycleDay, cycleLength = null) {
  if (!cycleDay || !cycleLength || cycleLength < 21) return null;
  const estimatedOvulation = Math.max(7, cycleLength - 14);
  if (cycleDay <= 5) return 'menstrual';
  if (cycleDay < estimatedOvulation - 1) return 'follicular';
  if (cycleDay <= estimatedOvulation + 1) return 'ovulatory';
  return 'luteal';
}

export function getPhaseInfo(cycleDay, cycleLength = null) {
  const phase = getCyclePhase(cycleDay, cycleLength);
  return phase ? { ...CYCLE_PHASES[phase], estimated: true } : null;
}

export function calculateAverageCycleLength(periods) {
  if (!periods || periods.length < 2) return null;
  const sorted = [...periods]
    .map(p => typeof p.startDate === 'string' ? parseISO(p.startDate) : p.startDate)
    .filter(isValid)
    .sort((a, b) => a - b);
  
  if (sorted.length < 2) return null;
  
  let total = 0;
  for (let i = 1; i < sorted.length; i++) {
    total += differenceInCalendarDays(sorted[i], sorted[i - 1]);
  }
  return Math.round(total / (sorted.length - 1));
}

export function predictNextPeriod(periods) {
  if (!periods || periods.length < 2) return null;
  const avgLength = calculateAverageCycleLength(periods);
  if (!avgLength || periods.length === 0) return null;
  
  const lastPeriod = [...periods]
    .map(p => ({ ...p, date: typeof p.startDate === 'string' ? parseISO(p.startDate) : p.startDate }))
    .filter(p => isValid(p.date))
    .sort((a, b) => b.date - a.date)[0];
  
  if (!lastPeriod) return null;
  return addDays(lastPeriod.date, avgLength);
}

export function formatDate(date, pattern = 'MMM d, yyyy') {
  if (!date) return '';
  const d = typeof date === 'string' ? parseISO(date) : date;
  if (!isValid(d)) return '';
  return format(d, pattern);
}

export function isSameDay(a, b) {
  if (!a || !b) return false;
  const da = typeof a === 'string' ? parseISO(a) : a;
  const db = typeof b === 'string' ? parseISO(b) : b;
  if (!isValid(da) || !isValid(db)) return false;
  return format(da, 'yyyy-MM-dd') === format(db, 'yyyy-MM-dd');
}

export function getMonthData(year, month) {
  const days = new Date(year, month + 1, 0).getDate();
  const firstDay = new Date(year, month, 1).getDay();
  return { days, firstDay };
}

export function calculateCorrelations(checkins) {
  if (!checkins || checkins.length < 14) return [];
  
  const insights = [];
  
  // Sleep -> Mood correlation
  const sleepMoodData = checkins.filter(c => c.sleep != null && c.mood);
  if (sleepMoodData.length >= 10) {
    const shortSleepEntries = sleepMoodData.filter(c => c.sleep < 5);
    const lowSleepBadMood = shortSleepEntries.filter(c => c.mood === 'low' || c.mood === 'irritated').length;
    const ratio = shortSleepEntries.length ? lowSleepBadMood / shortSleepEntries.length : 0;
    if (ratio > 0.6) {
      insights.push({
        id: 'sleep-mood',
        title: 'Sleep & Mood',
        observation: 'You tend to feel more tender when sleep is under 5 hours.',
        confidence: Math.round(ratio * 100),
        icon: '🌙',
      });
    }
  }
  
  // Cycle phase -> symptoms
  const phaseSymptoms = {};
  checkins.forEach(c => {
    if (c.cycleDay && c.symptoms?.length) {
      const phase = getCyclePhase(c.cycleDay, c.cycleLength);
      if (!phase) return;
      if (!phaseSymptoms[phase]) phaseSymptoms[phase] = {};
      c.symptoms.forEach(s => {
        phaseSymptoms[phase][s] = (phaseSymptoms[phase][s] || 0) + 1;
      });
    }
  });
  
  Object.entries(phaseSymptoms).forEach(([phase, symptoms]) => {
    const topSymptom = Object.entries(symptoms).sort((a, b) => b[1] - a[1])[0];
    if (topSymptom && topSymptom[1] >= 3) {
      const phaseLabel = CYCLE_PHASES[phase]?.label || phase;
      insights.push({
        id: `phase-${phase}`,
        title: `${phaseLabel} Phase`,
        observation: `You often notice ${topSymptom[0].replace('_', '')} during the ${phaseLabel.toLowerCase()} phase.`,
        confidence: Math.min(90, topSymptom[1] * 15),
        icon: '📊',
      });
    }
  });
  
  return insights;
}

export function generateMonthlySummary(checkins, periods, month, year) {
  const monthCheckins = checkins.filter(c => {
    const d = typeof c.date === 'string' ? parseISO(c.date) : c.date;
    return d.getMonth() === month && d.getFullYear() === year;
  });
  
  const totalCheckins = monthCheckins.length;
  const sleepEntries = monthCheckins.filter((item) => item.sleep != null);
  const avgSleep = sleepEntries.length > 0
    ? (sleepEntries.reduce((sum, c) => sum + c.sleep, 0) / sleepEntries.length).toFixed(1)
    : 0;
  
  const symptomCounts = {};
  monthCheckins.forEach(c => {
    c.symptoms?.forEach(s => {
      symptomCounts[s] = (symptomCounts[s] || 0) + 1;
    });
  });
  
  const topSymptoms = Object.entries(symptomCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([id, count]) => ({ id, count }));
  
  return {
    totalCheckins,
    avgSleep,
    topSymptoms,
    month: format(new Date(year, month, 1), 'MMMM yyyy'),
  };
}
