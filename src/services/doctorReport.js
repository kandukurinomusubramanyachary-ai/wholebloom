import { differenceInCalendarDays, isWithinInterval, parseISO } from 'date-fns';

export const DEFAULT_DOCTOR_REPORT_SETTINGS = {
  range: '90',
  startDate: null,
  endDate: null,
  includeEmotionalNotes: false,
  includeCycles: true,
  includeSymptoms: true,
  includeMedicines: true,
  includeLifestyle: true,
  includeMeg: false,
  questions: '',
};

function inRange(dateValue, startDate, endDate) {
  if (!dateValue) return false;
  const date = parseISO(dateValue);
  if (!startDate || !endDate) return true;
  return isWithinInterval(date, { start: parseISO(startDate), end: parseISO(endDate) });
}

function counts(values) {
  const result = {};
  values.filter(Boolean).forEach((value) => {
    result[value] = (result[value] || 0) + 1;
  });
  return Object.entries(result)
    .sort((a, b) => b[1] - a[1])
    .map(([name, count]) => ({ name, count }));
}

export function buildDoctorReport(state, options = {}) {
  const settings = { ...DEFAULT_DOCTOR_REPORT_SETTINGS, ...options };
  const { startDate, endDate } = settings;
  const checkins = (state.checkins || []).filter((item) => inRange(item.date, startDate, endDate));
  const periods = (state.periods || []).filter((item) => inRange(item.startDate, startDate, endDate));
  const meals = (state.meals || []).filter((item) => inRange(item.date, startDate, endDate));
  const movements = (state.movements || []).filter((item) => inRange(item.date, startDate, endDate));
  const medications = (state.medications || []).filter((item) => inRange(item.date, startDate, endDate));

  const orderedPeriods = [...periods].sort((a, b) => a.startDate.localeCompare(b.startDate));
  const cycleLengths = orderedPeriods.slice(1).map((item, index) =>
    differenceInCalendarDays(parseISO(item.startDate), parseISO(orderedPeriods[index].startDate))
  ).filter((days) => days > 0);
  const periodDurations = orderedPeriods.map((item) => item.endDate
    ? differenceInCalendarDays(parseISO(item.endDate), parseISO(item.startDate)) + 1
    : null
  ).filter((days) => days != null && days > 0);
  const sleepEntries = checkins.filter((item) => item.sleep != null);
  const sleepAverage = sleepEntries.length
    ? sleepEntries.reduce((sum, item) => sum + item.sleep, 0) / sleepEntries.length
    : null;
  const symptomCounts = counts(checkins.flatMap((item) => item.symptoms || []));
  const moodCounts = counts(checkins.map((item) => item.mood));
  const medicationFromCheckins = checkins
    .filter((item) => item.medicationTaken || item.medicationName)
    .map((item) => ({ date: item.date, name: item.medicationName || 'Medication or supplement taken' }));

  return {
    generatedAt: new Date().toISOString(),
    profile: {
      name: state.profile?.name || 'Not provided',
      trackingMode: state.settings?.trackingMode || state.profile?.trackingMode || 'cycle',
      goals: state.settings?.goals || state.profile?.goals || [],
    },
    range: {
      startDate: startDate || 'All records',
      endDate: endDate || 'All records',
    },
    cycles: settings.includeCycles ? {
      starts: orderedPeriods.map((item) => item.startDate),
      lengths: cycleLengths,
      durations: periodDurations,
      variation: cycleLengths.length
        ? Math.max(...cycleLengths) - Math.min(...cycleLengths)
        : null,
    } : null,
    symptoms: settings.includeSymptoms ? symptomCounts : [],
    sleep: settings.includeLifestyle ? {
      averageHours: sleepAverage,
      entries: sleepEntries.length,
    } : null,
    moods: settings.includeEmotionalNotes ? moodCounts : [],
    meals: settings.includeLifestyle ? {
      entries: meals.length,
      proteinIncluded: meals.filter((item) => item.protein).length,
      fibreIncluded: meals.filter((item) => item.fibre).length,
      produceIncluded: meals.filter((item) => item.produce).length,
    } : null,
    movement: settings.includeLifestyle ? {
      entries: movements.length,
      completed: movements.filter((item) => item.status === 'completed').length,
      partial: movements.filter((item) => item.status === 'partial').length,
    } : null,
    medications: settings.includeMedicines ? [...medications, ...medicationFromCheckins] : [],
    concerns: settings.includeEmotionalNotes
      ? checkins
        .filter((item) => item.notes)
        .map((item) => ({ date: item.date, note: item.notes }))
      : [],
    questions: settings.questions
      .split('\n')
      .map((item) => item.trim())
      .filter(Boolean),
    megIncluded: false,
    disclaimer: 'Bloom organises self-reported information. It does not diagnose conditions or replace medical advice.',
  };
}

export function doctorReportToText(report) {
  const lines = [
    'BLOOM DOCTOR-READY SUMMARY',
    `Generated: ${new Date(report.generatedAt).toLocaleString()}`,
    `Name: ${report.profile.name}`,
    `Date range: ${report.range.startDate} to ${report.range.endDate}`,
    '',
  ];

  if (report.cycles) {
    lines.push('CYCLES');
    lines.push(`Start dates: ${report.cycles.starts.join(', ') || 'None logged'}`);
    lines.push(`Cycle lengths: ${report.cycles.lengths.join(', ') || 'Not enough completed cycles'}`);
    lines.push(`Period durations: ${report.cycles.durations.join(', ') || 'Not enough end dates'}`);
    lines.push('');
  }
  if (report.symptoms.length) {
    lines.push('FREQUENT SYMPTOMS');
    report.symptoms.slice(0, 8).forEach((item) => lines.push(`- ${item.name}: ${item.count}`));
    lines.push('');
  }
  if (report.sleep) lines.push(`SLEEP: ${report.sleep.averageHours?.toFixed(1) || 'Not available'} hour average across ${report.sleep.entries} ${report.sleep.entries === 1 ? 'entry' : 'entries'}`, '');
  if (report.meals) lines.push(`FOOD: ${report.meals.entries} meals logged; protein ${report.meals.proteinIncluded}, fibre ${report.meals.fibreIncluded}, fruit or vegetables ${report.meals.produceIncluded}`, '');
  if (report.movement) lines.push(`MOVEMENT: ${report.movement.entries} entries; ${report.movement.completed} completed, ${report.movement.partial} partial`, '');
  if (report.moods?.length || report.concerns?.length) {
    lines.push('OPTIONAL MOODS AND NOTES');
    report.moods?.slice(0, 8).forEach((item) => lines.push(`- ${item.name}: ${item.count}`));
    report.concerns?.forEach((item) => lines.push(`- ${item.date}: ${item.note}`));
    lines.push('');
  }
  if (report.medications.length) {
    lines.push('MEDICATIONS AND SUPPLEMENTS');
    report.medications.forEach((item) => lines.push(`- ${item.date}: ${item.name}`));
    lines.push('');
  }
  if (report.questions.length) {
    lines.push('QUESTIONS FOR THE APPOINTMENT');
    report.questions.forEach((item) => lines.push(`- ${item}`));
    lines.push('');
  }
  lines.push(report.disclaimer);
  return lines.join('\n');
}
