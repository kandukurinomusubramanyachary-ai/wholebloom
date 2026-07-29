import { differenceInCalendarDays, parseISO } from 'date-fns';

const LABELS = {
  emotionally_sensitive: 'emotionally sensitive',
  back_pain: 'back pain',
  breast_tenderness: 'breast tenderness',
  hair_fall: 'hair fall',
  pelvic_discomfort: 'pelvic discomfort',
};

function label(value) {
  return LABELS[value] || String(value || '').replace(/_/g, ' ');
}

function topValue(values) {
  const counts = {};
  values.filter(Boolean).forEach((value) => {
    counts[value] = (counts[value] || 0) + 1;
  });
  const winner = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
  return winner ? { value: winner[0], count: winner[1] } : null;
}

function symptomTiming(dateValue, starts) {
  const date = parseISO(dateValue);
  const previous = [...starts].reverse().find((start) => start <= date);
  if (previous) {
    const cycleDay = differenceInCalendarDays(date, previous) + 1;
    if (cycleDay >= 1 && cycleDay <= 5) return 'period days';
  }
  const next = starts.find((start) => start > date);
  if (next) {
    const daysBefore = differenceInCalendarDays(next, date);
    if (daysBefore >= 1 && daysBefore <= 10) return 'the days before a period';
  }
  return null;
}

function insight(id, title, category, observation, evidence, confidenceLabel, nextStep) {
  return {
    id,
    title,
    category,
    observation,
    evidence,
    confidenceLabel,
    nextStep,
    disclaimer: 'This is an observation from your logs, not a diagnosis.',
  };
}

export function buildPersonalInsights({ checkins = [], periods = [], meals = [], movements = [] }) {
  const sorted = [...checkins].sort((a, b) => a.date.localeCompare(b.date));
  if (!sorted.length) return [];

  const results = [];
  const latest = sorted[sorted.length - 1];
  const latestSignals = [
    latest.mood ? `mood: ${label(latest.mood)}` : null,
    latest.energy != null ? `energy ${latest.energy}/10` : null,
    latest.sleep != null ? `${latest.sleep} hours of sleep` : null,
  ].filter(Boolean);

  results.push(insight(
    'daily-summary',
    'Your latest check-in',
    'Weekly progress',
    latestSignals.length
      ? `On ${latest.date}, you logged ${latestSignals.join(', ')}.`
      : `You made a check-in on ${latest.date}.`,
    '1 recent check-in',
    'Early observation',
    'Keep noticing only what feels useful today.'
  ));

  if (sorted.length >= 3) {
    const symptom = topValue(sorted.flatMap((item) => item.symptoms || []));
    const mood = topValue(sorted.map((item) => item.mood));
    if (symptom) {
      results.push(insight(
        'frequent-symptom',
        'A symptom you have noticed',
        'Symptoms',
        `${label(symptom.value)} appears most often in your recent check-ins.`,
        `${symptom.count} of ${sorted.length} check-ins`,
        'Emerging pattern',
        `If it helps, add a short note the next time you notice ${label(symptom.value)}.`
      ));
    }
    if (mood) {
      results.push(insight(
        'frequent-mood',
        'Your recent mood notes',
        'Mood',
        `${label(mood.value)} is the mood you logged most often so far.`,
        `${mood.count} of ${sorted.length} check-ins`,
        'Emerging pattern',
        'There is nothing you need to change; this is simply a point to notice.'
      ));
    }
  }

  if (sorted.length >= 7) {
    const recent = sorted.slice(-7);
    const sleepEntries = recent.filter((item) => item.sleep != null);
    const averageSleep = sleepEntries.length
      ? sleepEntries.reduce((sum, item) => sum + item.sleep, 0) / sleepEntries.length
      : null;
    if (averageSleep != null) {
      results.push(insight(
        'weekly-sleep',
        'Sleep across recent check-ins',
        'Sleep',
        `You logged an average of ${averageSleep.toFixed(1)} hours of sleep in your latest entries.`,
        `${sleepEntries.length} sleep entries`,
        'Repeated pattern',
        'Choose one evening this week to make bedtime a little easier.'
      ));
    }

    const recentDates = new Set(recent.map((item) => item.date));
    const mealDays = new Set(meals.filter((item) => recentDates.has(item.date)).map((item) => item.date));
    const movementDays = new Set(
      movements
        .filter((item) => recentDates.has(item.date) && item.status !== 'not_today')
        .map((item) => item.date)
    );
    if (meals.length || movements.length) {
      results.push(insight(
        'weekly-rhythm',
        'Your weekly care rhythm',
        'Food and movement',
        `You logged meals on ${mealDays.size} days and movement on ${movementDays.size} days in this window.`,
        'Your latest 7 check-in dates',
        'Repeated pattern',
        'Pick whichever part of this rhythm feels most supportive to repeat.'
      ));
    }
  }

  if (sorted.length >= 14) {
    const paired = sorted.filter((item) => item.sleep != null && item.energy != null);
    const shortSleep = paired.filter((item) => item.sleep < 6);
    const shortSleepLowEnergy = shortSleep.filter((item) => item.energy <= 4);
    if (shortSleep.length >= 3) {
      results.push(insight(
        'sleep-energy',
        'Sleep and energy',
        'Sleep',
        `You logged lower energy on ${shortSleepLowEnergy.length} of ${shortSleep.length} days when sleep was under 6 hours.`,
        `${paired.length} entries containing both sleep and energy`,
        shortSleep.length >= 6 ? 'Stronger personal pattern' : 'Repeated pattern',
        'On a shorter-sleep day, consider choosing a gentler movement goal.'
      ));
    }
  }

  const starts = periods
    .map((item) => item.startDate)
    .filter(Boolean)
    .map(parseISO)
    .sort((a, b) => a - b);
  if (starts.length >= 3) {
    const lengths = starts.slice(1).map((date, index) =>
      differenceInCalendarDays(date, starts[index])
    ).filter((days) => days > 0);
    const min = Math.min(...lengths);
    const max = Math.max(...lengths);
    results.push(insight(
      'cycle-variation',
      'Cycle length comparison',
      'Cycle changes',
      min === max
        ? `Your completed cycles were both ${min} days long.`
        : `Your completed cycles ranged from ${min} to ${max} days.`,
      `${lengths.length} completed cycle intervals`,
      lengths.length >= 3 ? 'Stronger personal pattern' : 'Repeated pattern',
      'You can bring this range to a doctor appointment if you want to discuss cycle variation.'
    ));
  }

  if (starts.length >= 2 && sorted.length >= 4) {
    const timingCounts = {};
    sorted.forEach((checkin) => {
      const timing = symptomTiming(checkin.date, starts);
      if (!timing) return;
      (checkin.symptoms || []).forEach((symptom) => {
        const key = `${symptom}|${timing}`;
        timingCounts[key] = (timingCounts[key] || 0) + 1;
      });
    });
    const strongest = Object.entries(timingCounts).sort((a, b) => b[1] - a[1])[0];
    if (strongest && strongest[1] >= 2) {
      const [symptom, timing] = strongest[0].split('|');
      results.push(insight(
        'symptom-timing',
        'A symptom near this part of your cycle',
        'Symptoms',
        `${label(symptom)} appears most often in ${timing} so far.`,
        `${strongest[1]} check-ins in the same part of a logged cycle`,
        strongest[1] >= 4 ? 'Repeated personal pattern' : 'Emerging pattern',
        `Keep logging ${label(symptom)} when it feels useful. Bloom will update this pattern as your cycle history grows.`
      ));
    }
  }
  return results;
}
