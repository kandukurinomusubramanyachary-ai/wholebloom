import { localDateKey } from '../../../utils/dateKey';

// Pure aggregation of saved guided sessions into the numbers the header shows.
// A session shape: { id, exerciseId, name, sets, reps, mode, durationSec, completedAt }

export function summarizeSessions(sessions = [], now = new Date()) {
  const safe = Array.isArray(sessions) ? sessions : [];
  const todayKey = localDateKey(now);

  let totalReps = 0;
  let totalMinutes = 0;
  const dayKeys = new Set();

  safe.forEach((session) => {
    totalReps += Number(session.reps) || 0;
    totalMinutes += (Number(session.durationSec) || 0) / 60;
    if (session.completedAt) dayKeys.add(localDateKey(new Date(session.completedAt)));
  });

  return {
    sessionCount: safe.length,
    totalReps,
    totalMinutes: Math.round(totalMinutes),
    activeDays: dayKeys.size,
    streak: currentStreak(dayKeys, now),
    todayCount: safe.filter((s) => s.completedAt && localDateKey(new Date(s.completedAt)) === todayKey).length,
    weekBars: weekBars(safe, now),
  };
}

function currentStreak(dayKeys, now) {
  let streak = 0;
  const cursor = new Date(now);
  // Allow "today not yet done" to still show yesterday's streak.
  if (!dayKeys.has(localDateKey(cursor))) cursor.setDate(cursor.getDate() - 1);
  while (dayKeys.has(localDateKey(cursor))) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

// Reps per day for the last 7 days, oldest → newest, for the mini bar chart.
export function weekBars(sessions = [], now = new Date()) {
  const bars = [];
  for (let i = 6; i >= 0; i -= 1) {
    const day = new Date(now);
    day.setDate(day.getDate() - i);
    const key = localDateKey(day);
    const reps = sessions
      .filter((s) => s.completedAt && localDateKey(new Date(s.completedAt)) === key)
      .reduce((sum, s) => sum + (Number(s.reps) || 0), 0);
    bars.push({ key, label: day.toLocaleDateString(undefined, { weekday: 'narrow' }), reps });
  }
  return bars;
}
