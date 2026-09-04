import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, Platform, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from '../components/Icon';
import Svg, { Circle } from 'react-native-svg';
import {
  addDays,
  addMonths,
  differenceInCalendarDays,
  eachDayOfInterval,
  endOfMonth,
  format,
  getYear,
  isBefore,
  isSameMonth,
  isToday,
  isValid,
  parseISO,
  startOfMonth,
  subMonths,
} from 'date-fns';
import { useApp } from '../context/AppContext';
import { localDateKey } from '../utils/dateKey';
import { COLORS, createThemedStyles } from '../utils/constants';
import { MotionScrollView, ScrollReveal, useReducedMotion } from '../components/Motion';
import BrandMark from '../components/BrandMark';

const WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const PHONE_MAX_WIDTH = 430;
const DEFAULT_PERIOD_DAYS = 5;

function safeDate(value) {
  if (!value) return null;
  const date = typeof value === 'string' ? parseISO(value) : value;
  return isValid(date) ? date : null;
}

function dateKey(date) {
  return localDateKey(date);
}

function periodLength(period) {
  return differenceInCalendarDays(period.end, period.start) + 1;
}

function addRange(target, start, end) {
  if (!start || !end || isBefore(end, start)) return;
  eachDayOfInterval({ start, end }).forEach((day) => target.add(dateKey(day)));
}

function normalizePeriods(periods = []) {
  const today = new Date();
  return periods
    .map((period) => {
      const start = safeDate(period.startDate);
      if (!start) return null;
      const requestedEnd = safeDate(period.endDate);
      const daysSinceStart = differenceInCalendarDays(today, start);
      const openEnd = daysSinceStart >= 0 && daysSinceStart <= 10 ? today : start;
      const end = requestedEnd && !isBefore(requestedEnd, start) ? requestedEnd : openEnd;
      return { ...period, start, end, ongoing: !requestedEnd };
    })
    .filter(Boolean)
    .sort((a, b) => a.start - b.start);
}

function buildTimelineModel(periods, predictionDetail, predictionValue, checkins) {
  const normalizedPeriods = normalizePeriods(periods);
  const prediction = safeDate(predictionDetail?.nextPeriodStart || predictionValue);
  const predictionEnd = safeDate(predictionDetail?.nextPeriodEnd)
    || (prediction ? addDays(prediction, DEFAULT_PERIOD_DAYS - 1) : null);
  const pmsStart = safeDate(predictionDetail?.pmsStart);
  const pmsEnd = safeDate(predictionDetail?.pmsEnd);
  const loggedDays = new Set();
  const predictedDays = new Set();
  const pmsDays = new Set();
  const symptomDays = new Set();
  const checkinDays = new Set();

  normalizedPeriods.forEach((period) => addRange(loggedDays, period.start, period.end));
  if (prediction && predictionEnd) addRange(predictedDays, prediction, predictionEnd);
  if (pmsStart && pmsEnd) addRange(pmsDays, pmsStart, pmsEnd);

  (checkins || []).forEach((checkin) => {
    if (checkin.date) checkinDays.add(checkin.date);
    if (checkin.date && ['light', 'medium', 'heavy'].includes(checkin.flow)) loggedDays.add(checkin.date);
    if (checkin.date && checkin.symptoms?.length) symptomDays.add(checkin.date);
  });

  const cycleLengths = normalizedPeriods.slice(0, -1).map((period, index) =>
    differenceInCalendarDays(normalizedPeriods[index + 1].start, period.start)
  ).filter((length) => length > 0);
  const variation = cycleLengths.length > 1
    ? Math.max(...cycleLengths) - Math.min(...cycleLengths)
    : null;
  const predictionConfidence = predictionDetail?.confidence
    || (cycleLengths.length < 2 || variation == null
      ? 'low'
      : variation >= 8 ? 'low' : variation >= 4 ? 'medium' : 'high');

  return {
    periods: normalizedPeriods,
    prediction,
    predictionEnd,
    predictionDetail,
    loggedDays,
    predictedDays,
    pmsDays,
    symptomDays,
    checkinDays,
    cycleLengths,
    predictionConfidence,
  };
}
function dateVisual(day, model) {
  const key = dateKey(day);
  return {
    logged: model.loggedDays.has(key),
    predicted: model.predictedDays.has(key) && !model.loggedDays.has(key),
    pms: model.pmsDays.has(key) && !model.predictedDays.has(key) && !model.loggedDays.has(key),
    symptom: model.symptomDays.has(key),
    checkin: model.checkinDays.has(key),
    today: isToday(day),
  };
}

function dateStatus(visual) {
  const labels = [];
  if (visual.logged) labels.push('Period logged');
  else if (visual.predicted) labels.push('Estimated period');
  else if (visual.pms) labels.push('Estimated PMS window');
  if (visual.symptom) labels.push('Symptoms logged');
  else if (visual.checkin) labels.push('Check-in logged');
  return labels.length ? labels.join(' · ') : 'No entries for this day';
}

function DottedRing({ size, color, strokeWidth = 1.5 }) {
  const radius = size / 2 - strokeWidth;
  return (
    <View style={[styles.ringOverlay, { width: size, height: size }]}>
      <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill='transparent'
          stroke={color}
          strokeWidth={strokeWidth}
          strokeDasharray='2 2.5'
          strokeLinecap='round'
        />
      </Svg>
    </View>
  );
}

function CalendarToggle({ value, onChange }) {
  const reduceMotion = useReducedMotion();
  const position = useRef(new Animated.Value(value === 'year' ? 1 : 0)).current;
  const [toggleWidth, setToggleWidth] = useState(204);
  const segmentWidth = Math.max(0, (toggleWidth - 8) / 2);

  useEffect(() => {
    Animated.timing(position, {
      toValue: value === 'year' ? 1 : 0,
      duration: reduceMotion ? 0 : 190,
      easing: Easing.bezier(0.23, 1, 0.32, 1),
      useNativeDriver: Platform.OS !== 'web',
    }).start();
  }, [position, reduceMotion, value]);

  return (
    <View
      style={styles.toggle}
      accessibilityRole='tablist'
      onLayout={(event) => setToggleWidth(event.nativeEvent.layout.width)}
    >
      <Animated.View
        style={[
          styles.toggleIndicator,
          styles.nonInteractive,
          { width: segmentWidth, transform: [{ translateX: Animated.multiply(position, segmentWidth) }] },
        ]}
      />
      {['Month', 'Year'].map((option) => {
        const selected = value === option.toLowerCase();
        return (
          <Pressable
            key={option}
            onPress={() => onChange(option.toLowerCase())}
            hitSlop={{ top: 5, bottom: 5 }}
            accessibilityRole='tab'
            accessibilityState={{ selected }}
            style={({ pressed, hovered, focused }) => [
              styles.toggleOption,
              hovered && !selected && styles.toggleOptionHovered,
              focused && styles.controlFocus,
              pressed && styles.pressed,
            ]}
          >
            <Text style={[styles.toggleText, selected && styles.toggleTextSelected]}>{option}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function TimelineHeader({ mode, focusDate, onModeChange, onMove, onToday, onClose }) {
  const title = mode === 'month' ? format(focusDate, 'MMMM yyyy') : String(getYear(focusDate));
  const subtitle = mode === 'month'
    ? 'Tap a day to see what you recorded.'
    : 'Tap a month to open the full calendar.';

  return (
    <View style={styles.header}>
      {mode === 'month' ? (
        <>
          <View style={styles.brandBar}>
            <BrandMark size='small' showWordmark={false} decorative />
            <Text style={styles.brandTitle}>Bloom</Text>
            <Pressable
              onPress={onToday}
              accessibilityRole='button'
              accessibilityLabel='Return to the current month'
              style={({ pressed, focused }) => [styles.todayButton, focused && styles.controlFocus, pressed && styles.pressed]}
            >
              <Icon name='calendar-outline' size={21} color={COLORS.brand} />
            </Pressable>
          </View>
          <View style={styles.topBar}>
            <View style={styles.headerSpacer} />
            <CalendarToggle value={mode} onChange={onModeChange} />
            <View style={styles.headerSpacer} />
          </View>
        </>
      ) : (
        <View style={[styles.topBar, styles.yearTopBar]}>
          <Pressable
            onPress={onClose}
            accessibilityRole='button'
            accessibilityLabel='Close timeline'
            style={({ pressed }) => [styles.closeButton, pressed && styles.pressed]}
          >
            <Icon name='close' size={23} color={COLORS.ink} />
          </Pressable>
          <CalendarToggle value={mode} onChange={onModeChange} />
          <View style={styles.headerSpacer} />
        </View>
      )}

      <View style={styles.periodNavigation}>
        <Pressable
          onPress={() => onMove(-1)}
          accessibilityRole='button'
          accessibilityLabel={mode === 'month' ? 'Previous month' : 'Previous year'}
          style={({ pressed }) => [styles.periodArrow, pressed && styles.pressed]}
        >
          <Icon name='chevron-back' size={20} color={COLORS.ink} />
        </Pressable>
        <View style={styles.periodHeading}>
          <Text style={[styles.periodTitle, mode === 'year' && styles.yearTitle]}>{title}</Text>
          <Text style={styles.periodSubtitle}>{subtitle}</Text>
        </View>
        <Pressable
          onPress={() => onMove(1)}
          accessibilityRole='button'
          accessibilityLabel={mode === 'month' ? 'Next month' : 'Next year'}
          style={({ pressed }) => [styles.periodArrow, pressed && styles.pressed]}
        >
          <Icon name='chevron-forward' size={20} color={COLORS.ink} />
        </Pressable>
      </View>
    </View>
  );
}

function CalendarDay({ day, model, selected, onSelect }) {
  const visual = dateVisual(day, model);
  const labelParts = [format(day, 'EEEE, d MMMM yyyy'), dateStatus(visual)];

  return (
    <Pressable
      onPress={() => onSelect(day)}
      accessibilityRole='button'
      accessibilityLabel={labelParts.join('. ')}
      accessibilityState={{ selected }}
      style={({ pressed }) => [styles.dayCell, pressed && styles.dayPressed]}
    >
      <View style={styles.todaySlot} />
      <View style={[styles.dayHalo, visual.today && styles.dayHaloToday]}>
        <View style={[
          styles.dayCircle,
          visual.predicted && styles.predictedDay,
          visual.pms && styles.pmsDay,
          visual.logged && styles.loggedDay,
          selected && styles.selectedDay,
        ]}>
          {visual.predicted && !visual.logged && !selected ? <DottedRing size={34} color={COLORS.brand} /> : null}
          <Text style={[
            styles.dayNumber,
            visual.pms && styles.pmsText,
            visual.today && styles.todayNumber,
            visual.logged && styles.loggedText,
            selected && styles.selectedDayText,
          ]}>
            {format(day, 'd')}
          </Text>
        </View>
      </View>
      <View style={styles.indicatorSlot}>
        {visual.symptom ? <View style={styles.symptomDot} /> : null}
      </View>
    </Pressable>
  );
}

function MonthCalendar({ focusDate, selectedDate, model, onSelect, onOpenDay, compact }) {
  const monthStart = startOfMonth(focusDate);
  const days = eachDayOfInterval({ start: monthStart, end: endOfMonth(focusDate) });
  const emptyDays = Array.from({ length: monthStart.getDay() });
  const selectedVisual = dateVisual(selectedDate, model);

  return (
    <View style={[styles.calendarSurface, compact && styles.calendarSurfaceCompact]}>
      <View style={styles.weekRow}>
        {WEEKDAYS.map((label, index) => (
          <Text key={`${label}-${index}`} style={styles.weekLabel}>{label}</Text>
        ))}
      </View>
      <View style={styles.monthGrid}>
        {emptyDays.map((_, index) => <View key={`empty-${index}`} style={styles.dayCell} />)}
        {days.map((day) => (
          <CalendarDay
            key={dateKey(day)}
            day={day}
            model={model}
            selected={dateKey(day) === dateKey(selectedDate)}
            onSelect={onSelect}
          />
        ))}
      </View>
      <View style={styles.selectedSummary}>
        <View style={styles.selectedCopy}>
          <Text style={styles.selectedDate}>{format(selectedDate, 'EEEE, d MMMM')}</Text>
          <Text style={styles.selectedStatus}>{dateStatus(selectedVisual)}</Text>
        </View>
        <Pressable
          onPress={() => onOpenDay(selectedDate)}
          accessibilityRole='button'
          accessibilityLabel={`Open details for ${format(selectedDate, 'd MMMM')}`}
          style={({ pressed }) => [styles.openDayButton, pressed && styles.pressed]}
        >
          <Icon name='arrow-forward' size={19} color={COLORS.brand} />
        </Pressable>
      </View>
    </View>
  );
}

function miniDayStyle(day, model) {
  const visual = dateVisual(day, model);
  return {
    visual,
    circle: [
      styles.miniDayCircle,
      visual.predicted && styles.miniPredicted,
      visual.pms && styles.miniPms,
      visual.logged && styles.miniLogged,
    ],
    text: [
      styles.miniDayText,
      visual.pms && styles.miniPmsText,
      visual.logged && styles.miniLoggedText,
    ],
  };
}

function MiniMonth({ month, model, current, onPress }) {
  const start = startOfMonth(month);
  const days = eachDayOfInterval({ start, end: endOfMonth(month) });
  const emptyDays = Array.from({ length: start.getDay() });

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole='button'
      accessibilityLabel={`Open ${format(month, 'MMMM yyyy')}`}
      style={({ pressed }) => [
        styles.miniMonth,
        current && styles.miniMonthCurrent,
        pressed && styles.miniMonthPressed,
      ]}
    >
      <Text style={[styles.miniMonthTitle, current && styles.miniMonthTitleCurrent]}>{format(month, 'MMM')}</Text>
      <View style={styles.miniWeekRow}>
        {WEEKDAYS.map((label, index) => <Text key={`${label}-${index}`} style={styles.miniWeekLabel}>{label}</Text>)}
      </View>
      <View style={styles.miniGrid}>
        {emptyDays.map((_, index) => <View key={`empty-${index}`} style={styles.miniDayCell} />)}
        {days.map((day) => {
          const visualStyle = miniDayStyle(day, model);
          return (
            <View key={dateKey(day)} style={styles.miniDayCell}>
              <View style={visualStyle.circle}>
                {visualStyle.visual.predicted && !visualStyle.visual.logged ? <DottedRing size={14} color={COLORS.brand} strokeWidth={1} /> : null}
                <Text style={visualStyle.text}>{format(day, 'd')}</Text>
              </View>
            </View>
          );
        })}
      </View>
    </Pressable>
  );
}

function YearCalendar({ focusDate, model, onOpenMonth }) {
  const year = getYear(focusDate);
  const months = Array.from({ length: 12 }, (_, month) => new Date(year, month, 1));
  return (
    <View style={styles.yearGrid}>
      {months.map((month) => (
        <MiniMonth
          key={format(month, 'yyyy-MM')}
          month={month}
          model={model}
          current={isSameMonth(month, new Date())}
          onPress={() => onOpenMonth(month)}
        />
      ))}
    </View>
  );
}

function LegendMark({ type }) {
  return (
    <View style={[styles.legendMark, styles[`legend_${type}`]]}>
      {type === 'predicted' ? <DottedRing size={12} color={COLORS.brand} strokeWidth={1.1} /> : null}
    </View>
  );
}

function CalendarLegend({ confidence }) {
  const items = [
    ['logged', 'Logged period'],
    ['predicted', 'Estimated period'],
    ['pms', 'PMS window'],
    ['today', 'Today'],
    ['symptom', 'Symptoms'],
  ];
  return (
    <View style={styles.legend}>
      {items.map(([type, label]) => (
        <View key={type} style={styles.legendItem}>
          <LegendMark type={type} />
          <Text style={styles.legendText}>{label}</Text>
        </View>
      ))}
      <Text style={styles.estimateNote}>{confidence === 'low' ? 'Confidence is still building. ' : ''}Period and PMS dates are estimates based on what you have logged.</Text>
    </View>
  );
}

function CycleSummaryCard({ model, averageCycleLength, currentPhase }) {
  const latest = model.periods[model.periods.length - 1];
  const today = new Date();
  const currentCycleDay = latest && !isBefore(today, latest.start)
    ? differenceInCalendarDays(today, latest.start) + 1
    : null;
  const expectedLength = averageCycleLength || Math.max(currentCycleDay || 21, 21);
  const dotCount = Math.min(Math.max(expectedLength, 21), 35);
  const predictionRange = model.predictionDetail
    ? `${format(parseISO(model.predictionDetail.nextPeriodStart), 'd MMM')}–${format(parseISO(model.predictionDetail.nextPeriodEnd), 'd MMM')}`
    : null;
  const latestPeriodLength = latest ? periodLength(latest) : 0;
  const predictedStartDay = latest && model.prediction
    ? differenceInCalendarDays(model.prediction, latest.start) + 1
    : null;
  const predictedEndDay = latest && model.predictionEnd
    ? differenceInCalendarDays(model.predictionEnd, latest.start) + 1
    : null;
  const pmsStartDay = latest && model.predictionDetail?.pmsStart
    ? differenceInCalendarDays(parseISO(model.predictionDetail.pmsStart), latest.start) + 1
    : null;

  return (
    <View style={styles.summaryCard}>
      <View style={styles.cardHeader}>
        <View style={styles.cardIcon}><Icon name='calendar-clear-outline' size={19} color={COLORS.brand} /></View>
        <View style={styles.cardHeaderCopy}>
          <Text style={styles.cardTitle}>Current cycle</Text>
          <Text style={styles.cardSubtitle}>{latest
            ? currentCycleDay && currentPhase?.label
              ? `Day ${currentCycleDay} · ${currentPhase.label}`
              : `Started ${format(latest.start, 'd MMMM')}`
            : 'Add a period start when you are ready'}</Text>
        </View>
        {currentCycleDay ? <Text style={styles.cycleDayValue}>{currentCycleDay} {currentCycleDay === 1 ? 'day' : 'days'}</Text> : null}
      </View>

      {predictionRange ? (
        <View style={styles.predictionPanel}>
          <View style={styles.predictionPanelCopy}>
            <Text style={styles.predictionPanelLabel}>Estimated next period</Text>
            <Text style={styles.predictionPanelRange}>{predictionRange}</Text>
          </View>
          <View style={styles.confidenceBadge}>
            <Text style={styles.confidenceBadgeText}>{model.predictionDetail.confidenceLabel}</Text>
          </View>
          <Text style={styles.predictionPanelNote}>
            Based on {model.predictionDetail.dataPointsUsed} completed {model.predictionDetail.dataPointsUsed === 1 ? 'cycle' : 'cycles'}. Dates may shift as you add more logs.
          </Text>
        </View>
      ) : null}

      {latest ? (
        <>
          <View style={styles.cycleDots}>
            {Array.from({ length: dotCount }, (_, index) => {
              const day = index + 1;
              const period = day <= latestPeriodLength;
              const predicted = predictedStartDay && predictedEndDay && day >= predictedStartDay && day <= predictedEndDay;
              const pms = pmsStartDay && predictedStartDay && day >= pmsStartDay && day < predictedStartDay;
              const current = currentCycleDay === day || (day === dotCount && currentCycleDay > dotCount);
              return (
                <View
                  key={day}
                  style={[
                    styles.cycleDot,
                    pms && styles.cycleDotPms,
                    period && styles.cycleDotPeriod,
                    predicted && styles.cycleDotPredicted,
                    current && styles.cycleDotCurrent,
                  ]}
                />
              );
            })}
          </View>
          <View style={styles.dotLabels}>
            <Text style={styles.dotLabel}>Day 1</Text>
            <Text style={styles.dotLabel}>{currentCycleDay > dotCount ? `Today · day ${currentCycleDay}` : averageCycleLength ? `Usual pattern · ${averageCycleLength} days` : 'Your pattern is still forming'}</Text>
          </View>
        </>
      ) : (
        <Text style={styles.summaryEmpty}>Your current cycle will appear here after your first period date is logged.</Text>
      )}
    </View>
  );
}

function InsightRow({ label, value, last }) {
  return (
    <View style={[styles.insightRow, last && styles.insightRowLast]}>
      <Text style={styles.insightLabel}>{label}</Text>
      <Text style={styles.insightValue}>{value}</Text>
    </View>
  );
}

function CycleInsightsCard({ model, averageCycleLength, currentPhase }) {
  const latest = model.periods[model.periods.length - 1];
  const today = new Date();
  const currentCycleDay = latest && !isBefore(today, latest.start)
    ? differenceInCalendarDays(today, latest.start) + 1
    : null;
  const previousCycle = model.cycleLengths[model.cycleLengths.length - 1];
  const previousPeriod = latest ? periodLength(latest) : null;
  const variation = model.cycleLengths.length >= 2
    ? Math.max(...model.cycleLengths) - Math.min(...model.cycleLengths)
    : null;
  const cycleLength = averageCycleLength || previousCycle || 28;
  const progress = currentCycleDay
    ? Math.max(2, Math.min(100, Math.round((currentCycleDay / cycleLength) * 100)))
    : 0;

  return (
    <View style={styles.insightsSection}>
      <Text style={styles.sectionTitle}>A gentle read</Text>
      <View style={styles.insightsCard}>
        <View style={styles.gentleHeader}>
          <Text style={styles.gentleDay}>{currentCycleDay ? `Day ${currentCycleDay}` : 'Cycle day —'}</Text>
          <Text numberOfLines={1} style={styles.gentlePhase}>{currentPhase?.label || (latest ? 'Pattern still forming' : 'Add a period to begin')}</Text>
        </View>
        <View
          style={styles.gentleTrack}
          accessibilityRole='progressbar'
          accessibilityValue={{ min: 0, max: 100, now: progress }}
        >
          <View style={[styles.gentleProgress, { width: `${progress}%` }]} />
        </View>
        <View style={styles.insightList}>
          <InsightRow label='Previous cycle length' value={previousCycle ? `${previousCycle} days` : '—'} />
          <InsightRow label='Period length' value={previousPeriod ? `${previousPeriod} days` : '—'} />
          <InsightRow label='Variation' value={variation != null ? `± ${Math.ceil(variation / 2)} ${Math.ceil(variation / 2) === 1 ? 'day' : 'days'}` : '—'} last />
        </View>
      </View>
    </View>
  );
}

function CycleHistory({ model, onLogPrevious }) {
  const today = new Date();
  const entries = model.periods.slice(-3).reverse();
  return (
    <View style={styles.historySection}>
      <View style={styles.sectionHeadingRow}>
        <Text style={styles.sectionTitle}>Cycle history</Text>
        <Text style={styles.sectionCount}>{model.periods.length} logged</Text>
      </View>

      <View style={styles.historyCard}>
        {entries.length ? entries.map((period, reverseIndex) => {
          const index = model.periods.indexOf(period);
          const nextPeriod = model.periods[index + 1];
          const isCurrent = index === model.periods.length - 1;
          const cycleLength = nextPeriod
            ? differenceInCalendarDays(nextPeriod.start, period.start)
            : !isBefore(today, period.start)
              ? differenceInCalendarDays(today, period.start) + 1
              : null;
          return (
            <View key={dateKey(period.start)} style={[styles.historyRow, reverseIndex === entries.length - 1 && styles.historyRowLast]}>
              <View style={[styles.historyDot, isCurrent && styles.historyDotCurrent]} />
              <View style={styles.historyCopy}>
                <Text style={styles.historyDate}>{format(period.start, 'd MMM yyyy')}</Text>
                <Text style={styles.historyMeta}>
                  {periodLength(period)} {periodLength(period) === 1 ? 'day' : 'days'} period · {cycleLength
                    ? isCurrent
                      ? `${cycleLength} ${cycleLength === 1 ? 'day' : 'days'} so far`
                      : `${cycleLength}-day cycle`
                    : 'Cycle length pending'}
                </Text>
              </View>
              {isCurrent ? <View style={styles.currentBadge}><Text style={styles.currentBadgeText}>Current</Text></View> : null}
            </View>
          );
        }) : (
          <View style={styles.historyEmpty}>
            <Icon name='calendar-outline' size={21} color={COLORS.brand} />
            <Text style={styles.historyEmptyText}>No cycles logged yet. Begin whenever it feels useful.</Text>
          </View>
        )}

        <Pressable
          onPress={onLogPrevious}
          accessibilityRole='button'
          style={({ pressed }) => [styles.logPreviousButton, pressed && styles.pressed]}
        >
          <Icon name='add-circle-outline' size={20} color={COLORS.brand} />
          <Text style={styles.logPreviousText}>Log previous cycles</Text>
          <Icon name='chevron-forward' size={18} color={COLORS.muted} />
        </Pressable>
      </View>

      <View style={styles.supportNote}>
        <Icon name='sparkles-outline' size={18} color={COLORS.sage} />
        <Text style={styles.supportNoteText}>Log 2 or more periods to improve your personal pattern insights.</Text>
      </View>
    </View>
  );
}

function EditPeriodButton({ onPress, title = 'Log period dates', icon = 'water' }) {
  return (
    <View style={styles.bottomAction}>
      <Pressable
        onPress={onPress}
        accessibilityRole='button'
        style={({ pressed }) => [styles.editButton, pressed && styles.editButtonPressed]}
      >
        <Icon name={icon} size={20} color={COLORS.white} />
        <Text style={styles.editButtonText}>{title}</Text>
      </Pressable>
    </View>
  );
}

export default function TimelineScreen({ navigation }) {
  const { state } = useApp();
  const { width: viewportWidth } = useWindowDimensions();
  const [mode, setMode] = useState('month');
  const [focusDate, setFocusDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(new Date());
  const model = useMemo(
    () => buildTimelineModel(state.periods, state.cyclePrediction, state.nextPeriodPrediction, state.checkins),
    [state.periods, state.cyclePrediction, state.nextPeriodPrediction, state.checkins]
  );
  const narrowMonth = mode === 'month' && viewportWidth < 390;
  const compactMonth = mode === 'month' && viewportWidth <= 340;

  function changeMode(nextMode) {
    setMode(nextMode);
  }

  function movePeriod(direction) {
    setFocusDate((current) => {
      const next = mode === 'month'
        ? direction > 0 ? addMonths(current, 1) : subMonths(current, 1)
        : new Date(getYear(current) + direction, current.getMonth(), 1);
      if (mode === 'month') {
        setSelectedDate(isSameMonth(next, new Date()) ? new Date() : startOfMonth(next));
      }
      return next;
    });
  }

  function openMonth(month) {
    setFocusDate(month);
    setSelectedDate(isSameMonth(month, new Date()) ? new Date() : startOfMonth(month));
    setMode('month');
  }

  function returnToCurrentMonth() {
    const today = new Date();
    setFocusDate(today);
    setSelectedDate(today);
    setMode('month');
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <View style={[styles.phoneShell, mode === 'year' && styles.yearShell]}>
        <TimelineHeader
          mode={mode}
          focusDate={focusDate}
          onModeChange={changeMode}
          onMove={movePeriod}
          onToday={returnToCurrentMonth}
          onClose={() => navigation.navigate('Today')}
        />

        <MotionScrollView
          style={styles.scroll}
          contentContainerStyle={[
            styles.scrollContent,
            narrowMonth && styles.scrollContentNarrow,
            compactMonth && styles.scrollContentCompact,
          ]}
          showsVerticalScrollIndicator={false}
        >
          {mode === 'month' ? (
            <MonthCalendar
              focusDate={focusDate}
              selectedDate={selectedDate}
              model={model}
              onSelect={setSelectedDate}
              onOpenDay={(day) => navigation.navigate('DayDetail', { date: dateKey(day) })}
              compact={compactMonth}
            />
          ) : (
            <YearCalendar focusDate={focusDate} model={model} onOpenMonth={openMonth} />
          )}

          <ScrollReveal><CalendarLegend confidence={model.predictionConfidence} /></ScrollReveal>
          <ScrollReveal><CycleInsightsCard model={model} averageCycleLength={state.averageCycleLength} currentPhase={state.currentPhase} /></ScrollReveal>
          <ScrollReveal><CycleHistory model={model} onLogPrevious={() => navigation.navigate('LogPeriod')} /></ScrollReveal>
        </MotionScrollView>

        <EditPeriodButton
          title={mode === 'month' ? 'Log period dates' : model.periods.length ? 'Edit latest period' : 'Log period dates'}
          icon={mode === 'month' ? 'water' : 'create-outline'}
          onPress={() => {
            if (mode === 'month') {
              navigation.navigate('LogPeriod');
              return;
            }
            const latest = model.periods[model.periods.length - 1];
            navigation.navigate('LogPeriod', latest ? { periodId: latest.id || latest.startDate } : undefined);
          }}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = createThemedStyles({
  safeArea: {
    flex: 1,
    minHeight: 0,
    backgroundColor: COLORS.surfaceWarm,
    ...Platform.select({ web: { height: '100vh', maxHeight: '100vh', overflow: 'hidden' } }),
  },
  phoneShell: {
    flex: 1,
    width: '100%',
    maxWidth: PHONE_MAX_WIDTH,
    alignSelf: 'center',
    backgroundColor: COLORS.surfaceWarm,
  },
  yearShell: { maxWidth: 720 },
  header: {
    paddingHorizontal: 16,
    paddingTop: 0,
    paddingBottom: 8,
    backgroundColor: COLORS.surfaceWarm,
  },
  brandBar: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: COLORS.hairline,
  },
  brandTitle: {
    position: 'absolute',
    left: 44,
    right: 44,
    fontSize: 18,
    lineHeight: 24,
    fontWeight: '700',
    color: COLORS.brand,
    textAlign: 'center',
    pointerEvents: 'none',
  },
  todayButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  topBar: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 12,
  },
  yearTopBar: { marginTop: 0 },
  closeButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.hairline,
  },
  headerSpacer: {
    width: 44,
    height: 44,
  },
  pressed: {
    opacity: 0.66,
  },
  toggle: {
    position: 'relative',
    width: 204,
    flexShrink: 1,
    height: 44,
    flexDirection: 'row',
    alignItems: 'center',
    padding: 4,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: COLORS.hairline,
    backgroundColor: '#EEEAE7',
  },
  toggleIndicator: {
    position: 'absolute',
    top: 4,
    left: 4,
    width: 98,
    height: 34,
    borderRadius: 17,
    backgroundColor: COLORS.white,
    ...Platform.select({ web: { boxShadow: '0 2px 6px rgba(34,34,34,0.08)' } }),
  },
  nonInteractive: { pointerEvents: 'none' },
  toggleOption: {
    zIndex: 1,
    flex: 1,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({ web: { cursor: 'pointer', transitionProperty: 'background-color, opacity, transform', transitionDuration: '150ms', transitionTimingFunction: 'cubic-bezier(0.23, 1, 0.32, 1)', outlineStyle: 'none' } }),
  },
  toggleOptionHovered: { backgroundColor: 'rgba(255,255,255,0.42)' },
  controlFocus: Platform.select({ web: { outlineStyle: 'solid', outlineWidth: 2, outlineColor: COLORS.brand, outlineOffset: -2 }, default: {} }),
  toggleText: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '600',
    color: COLORS.muted,
  },
  toggleTextSelected: {
    color: COLORS.brand,
  },
  periodNavigation: {
    minHeight: 78,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    marginTop: 5,
  },
  periodArrow: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  periodHeading: {
    flex: 1,
    alignItems: 'center',
  },
  periodTitle: {
    fontSize: 22,
    lineHeight: 28,
    fontWeight: '700',
    letterSpacing: -0.35,
    color: COLORS.ink,
    textAlign: 'center',
  },
  yearTitle: {
    fontSize: 28,
    lineHeight: 34,
  },
  periodSubtitle: {
    marginTop: 2,
    fontSize: 12,
    lineHeight: 17,
    color: COLORS.muted,
    textAlign: 'center',
  },
  scroll: {
    flex: 1,
    minHeight: 0,
    ...Platform.select({ web: { overflowY: 'auto', overscrollBehavior: 'contain' } }),
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 6,
    paddingBottom: 104,
  },
  scrollContentNarrow: {
    paddingHorizontal: 14,
  },
  scrollContentCompact: {
    paddingHorizontal: 5,
  },
  calendarSurface: {
    paddingTop: 14,
    paddingHorizontal: 10,
    paddingBottom: 0,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.hairline,
    backgroundColor: COLORS.white,
    overflow: 'hidden',
  },
  calendarSurfaceCompact: {
    paddingHorizontal: 0,
  },
  weekRow: {
    flexDirection: 'row',
    paddingHorizontal: 1,
    marginBottom: 3,
  },
  weekLabel: {
    width: `${100 / 7}%`,
    fontSize: 11,
    lineHeight: 15,
    fontWeight: '600',
    color: COLORS.muted,
    textAlign: 'center',
  },
  monthGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  dayCell: {
    width: `${100 / 7}%`,
    minHeight: 61,
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingTop: 1,
  },
  dayPressed: {
    opacity: 0.58,
  },
  todaySlot: {
    height: 7,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayHalo: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  dayHaloToday: {
    borderColor: COLORS.sage,
  },
  dayCircle: {
    position: 'relative',
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  ringOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
  },
  dayNumber: {
    fontSize: 15,
    lineHeight: 19,
    fontWeight: '500',
    color: COLORS.ink,
  },
  todayNumber: {
    fontWeight: '800',
  },
  pmsDay: {
    backgroundColor: COLORS.sageLight,
  },
  pmsText: {
    color: COLORS.sage,
    fontWeight: '700',
  },
  predictedDay: {
    backgroundColor: COLORS.blush,
  },
  loggedDay: {
    backgroundColor: COLORS.cycle,
  },
  selectedDay: {
    backgroundColor: COLORS.brand,
  },
  loggedText: {
    color: COLORS.white,
    fontWeight: '800',
  },
  selectedDayText: {
    color: COLORS.white,
    fontWeight: '800',
  },
  indicatorSlot: {
    height: 7,
    alignItems: 'center',
    justifyContent: 'center',
  },
  symptomDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: COLORS.muted,
  },
  selectedSummary: {
    minHeight: 65,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 6,
    paddingLeft: 8,
    paddingRight: 2,
    borderTopWidth: 1,
    borderTopColor: COLORS.hairline,
  },
  selectedCopy: {
    flex: 1,
  },
  selectedDate: {
    fontSize: 14,
    lineHeight: 19,
    fontWeight: '700',
    color: COLORS.ink,
  },
  selectedStatus: {
    marginTop: 2,
    fontSize: 12,
    lineHeight: 17,
    color: COLORS.muted,
  },
  openDayButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.brandSoft,
  },
  yearGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: 10,
  },
  miniMonth: {
    width: '31.8%',
    minHeight: 151,
    paddingHorizontal: 7,
    paddingTop: 9,
    paddingBottom: 8,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.hairline,
    backgroundColor: COLORS.white,
  },
  miniMonthCurrent: {
    borderColor: '#D8B2A6',
    backgroundColor: COLORS.surfaceWarm,
  },
  miniMonthPressed: {
    opacity: 0.66,
  },
  miniMonthTitle: {
    marginBottom: 6,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '700',
    color: COLORS.ink,
  },
  miniMonthTitleCurrent: {
    color: COLORS.brand,
  },
  miniWeekRow: {
    flexDirection: 'row',
    marginBottom: 2,
  },
  miniWeekLabel: {
    width: `${100 / 7}%`,
    fontSize: 6.5,
    lineHeight: 9,
    fontWeight: '700',
    color: COLORS.muted,
    textAlign: 'center',
  },
  miniGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  miniDayCell: {
    width: `${100 / 7}%`,
    height: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  miniDayCircle: {
    position: 'relative',
    width: 14,
    height: 14,
    borderRadius: 7,
    alignItems: 'center',
    justifyContent: 'center',
  },
  miniDayText: {
    fontSize: 7,
    lineHeight: 9,
    fontWeight: '500',
    color: COLORS.body,
  },
  miniPredicted: {
    backgroundColor: COLORS.blush,
  },
  miniPms: {
    backgroundColor: COLORS.sageLight,
  },
  miniLogged: {
    backgroundColor: COLORS.cycle,
  },
  miniPmsText: {
    color: COLORS.sage,
    fontWeight: '800',
  },
  miniLoggedText: {
    color: COLORS.white,
    fontWeight: '800',
  },
  legend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    columnGap: 13,
    rowGap: 8,
    paddingHorizontal: 2,
    paddingVertical: 15,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendMark: {
    position: 'relative',
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  legend_logged: {
    backgroundColor: COLORS.cycle,
  },
  legend_predicted: {
    backgroundColor: COLORS.blush,
  },
  legend_pms: {
    backgroundColor: COLORS.sageLight,
    borderWidth: 1,
    borderColor: COLORS.sage,
  },
  legend_today: {
    borderWidth: 2,
    borderColor: COLORS.ink,
    backgroundColor: COLORS.white,
  },
  legend_symptom: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: COLORS.muted,
  },
  legendText: {
    fontSize: 11,
    lineHeight: 15,
    color: COLORS.body,
  },
  estimateNote: {
    width: '100%',
    marginTop: 2,
    fontSize: 10.5,
    lineHeight: 15,
    color: COLORS.muted,
  },
  summaryCard: {
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.hairline,
    backgroundColor: COLORS.white,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
  },
  cardIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.brandSoft,
  },
  cardHeaderCopy: {
    flex: 1,
  },
  cardTitle: {
    fontSize: 16,
    lineHeight: 21,
    fontWeight: '700',
    color: COLORS.ink,
  },
  cardSubtitle: {
    marginTop: 2,
    fontSize: 12,
    lineHeight: 17,
    color: COLORS.muted,
  },
  cycleDayValue: {
    paddingVertical: 6,
    paddingHorizontal: 9,
    borderRadius: 999,
    backgroundColor: COLORS.brandSoft,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '800',
    color: COLORS.brand,
  },
  predictionPanel: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 8,
    marginTop: 14,
    padding: 12,
    borderRadius: 12,
    backgroundColor: COLORS.brandSoft,
  },
  predictionPanelCopy: { flex: 1, minWidth: 150 },
  predictionPanelLabel: { fontSize: 11, lineHeight: 15, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.4, color: COLORS.muted },
  predictionPanelRange: { marginTop: 2, fontSize: 18, lineHeight: 23, fontWeight: '800', color: COLORS.brand },
  confidenceBadge: { paddingVertical: 5, paddingHorizontal: 8, borderRadius: 999, backgroundColor: COLORS.white },
  confidenceBadgeText: { fontSize: 10.5, lineHeight: 14, fontWeight: '700', color: COLORS.brand },
  predictionPanelNote: { width: '100%', fontSize: 11, lineHeight: 16, color: COLORS.body },
  cycleDots: {
    minHeight: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 20,
  },
  cycleDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: COLORS.hairline,
  },
  cycleDotPeriod: {
    backgroundColor: COLORS.cycle,
  },
  cycleDotPms: {
    backgroundColor: '#96AA91',
  },
  cycleDotPredicted: {
    borderWidth: 1,
    borderColor: COLORS.brand,
    backgroundColor: COLORS.blush,
  },
  cycleDotCurrent: {
    backgroundColor: COLORS.ink,
    transform: [{ scale: 1.45 }],
  },
  dotLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    marginTop: 3,
  },
  dotLabel: {
    flexShrink: 1,
    fontSize: 10.5,
    lineHeight: 15,
    color: COLORS.muted,
  },
  summaryEmpty: {
    marginTop: 14,
    fontSize: 13,
    lineHeight: 19,
    color: COLORS.body,
  },
  insightsSection: {
    marginTop: 2,
  },
  insightsCard: {
    marginTop: 10,
    paddingHorizontal: 14,
    paddingVertical: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.hairline,
    backgroundColor: COLORS.surfaceSoft,
  },
  sectionTitle: {
    fontSize: 18,
    lineHeight: 24,
    fontWeight: '700',
    letterSpacing: -0.2,
    color: COLORS.ink,
  },
  gentleHeader: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: 12,
  },
  gentleDay: {
    fontSize: 16,
    lineHeight: 22,
    fontWeight: '700',
    color: COLORS.ink,
  },
  gentlePhase: {
    flexShrink: 1,
    fontSize: 12,
    lineHeight: 17,
    color: COLORS.muted,
    textAlign: 'right',
  },
  gentleTrack: {
    height: 6,
    marginTop: 8,
    borderRadius: 3,
    backgroundColor: COLORS.hairline,
    overflow: 'hidden',
  },
  gentleProgress: {
    height: 6,
    borderRadius: 3,
    backgroundColor: COLORS.brand,
  },
  insightList: {
    marginTop: 12,
  },
  insightRow: {
    minHeight: 38,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 16,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.hairline,
  },
  insightRowLast: {
    borderBottomWidth: 0,
  },
  insightLabel: {
    flex: 1,
    fontSize: 12,
    lineHeight: 17,
    color: COLORS.muted,
  },
  insightValue: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '700',
    color: COLORS.ink,
    textAlign: 'right',
  },
  historySection: {
    marginTop: 22,
  },
  sectionHeadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 10,
    paddingHorizontal: 2,
  },
  sectionCount: {
    fontSize: 11,
    lineHeight: 15,
    color: COLORS.muted,
  },
  historyCard: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.hairline,
    backgroundColor: COLORS.white,
    overflow: 'hidden',
  },
  historyRow: {
    minHeight: 66,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.hairline,
  },
  historyRowLast: {
    borderBottomWidth: 1,
  },
  historyDot: {
    width: 9,
    height: 9,
    borderRadius: 5,
    borderWidth: 1.5,
    borderColor: COLORS.cycle,
    backgroundColor: COLORS.white,
  },
  historyDotCurrent: {
    backgroundColor: COLORS.cycle,
  },
  historyCopy: {
    flex: 1,
  },
  historyDate: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '700',
    color: COLORS.ink,
  },
  historyMeta: {
    marginTop: 2,
    fontSize: 11,
    lineHeight: 16,
    color: COLORS.muted,
  },
  currentBadge: {
    paddingVertical: 5,
    paddingHorizontal: 7,
    borderRadius: 999,
    backgroundColor: COLORS.brandSoft,
  },
  currentBadgeText: {
    fontSize: 9.5,
    lineHeight: 13,
    fontWeight: '800',
    color: COLORS.brand,
  },
  historyEmpty: {
    minHeight: 74,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.hairline,
  },
  historyEmptyText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 18,
    color: COLORS.body,
  },
  logPreviousButton: {
    minHeight: 54,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    paddingHorizontal: 14,
  },
  logPreviousText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '700',
    color: COLORS.ink,
  },
  supportNote: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 9,
    marginTop: 10,
    padding: 13,
    borderRadius: 12,
    backgroundColor: COLORS.sageLight,
  },
  supportNoteText: {
    flex: 1,
    fontSize: 11.5,
    lineHeight: 17,
    color: COLORS.body,
  },
  bottomAction: {
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 12,
    borderTopWidth: 1,
    borderTopColor: COLORS.hairline,
    backgroundColor: COLORS.canvas,
  },
  editButton: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 999,
    backgroundColor: COLORS.brand,
  },
  editButtonPressed: {
    opacity: 0.88,
    transform: [{ scale: 0.985 }],
  },
  editButtonText: {
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '700',
    color: COLORS.white,
  },
});
