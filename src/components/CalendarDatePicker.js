import React, { useEffect, useMemo, useState } from 'react';
import {
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from './Icon';
import { addMonths, format, isSameDay, parseISO, startOfMonth } from 'date-fns';
import { COLORS, ELEVATION, LAYOUT, createThemedStyles } from '../utils/constants';
import { localDateKey } from '../utils/dateKey';
import {
  calendarBounds,
  calendarMonthCells,
  calendarYears,
  isCalendarDateSelectable,
  monthHasSelectableDate,
  parseCalendarDate,
} from '../utils/calendarDates';

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export default function CalendarDatePicker({
  visible,
  value,
  minimumDate,
  maximumDate = localDateKey(),
  title = 'Choose date',
  onSelect,
  onClose,
}) {
  const { height } = useWindowDimensions();
  const bounds = useMemo(
    () => calendarBounds({ minimumDate, maximumDate }),
    [minimumDate, maximumDate]
  );
  const parsedValue = parseCalendarDate(value);
  const fallbackDate = parsedValue && isCalendarDateSelectable(
    value, { minimumDate, maximumDate }
  ) ? parsedValue : bounds.maximum;
  const [visibleMonth, setVisibleMonth] = useState(startOfMonth(fallbackDate));
  const [mode, setMode] = useState('calendar');

  useEffect(() => {
    if (!visible) return;
    const nextValue = parseCalendarDate(value);
    const nextDate = nextValue && isCalendarDateSelectable(
      value, { minimumDate, maximumDate }
    ) ? nextValue : bounds.maximum;
    setVisibleMonth(startOfMonth(nextDate));
    setMode('calendar');
  }, [visible, value, bounds.maximum]);

  const monthKey = localDateKey(visibleMonth);
  const cells = useMemo(() => calendarMonthCells(monthKey), [monthKey]);
  const years = useMemo(
    () => calendarYears({ minimumDate, maximumDate }),
    [minimumDate, maximumDate]
  );
  const previousMonth = addMonths(visibleMonth, -1);
  const nextMonth = addMonths(visibleMonth, 1);
  const canGoPrevious = monthHasSelectableDate(
    previousMonth.getFullYear(), previousMonth.getMonth(), { minimumDate, maximumDate }
  );
  const canGoNext = monthHasSelectableDate(
    nextMonth.getFullYear(), nextMonth.getMonth(), { minimumDate, maximumDate }
  );

  function chooseDate(dateKey) {
    if (!isCalendarDateSelectable(dateKey, { minimumDate, maximumDate })) return;
    onSelect(dateKey);
  }

  function chooseMonth(monthIndex) {
    if (!monthHasSelectableDate(
      visibleMonth.getFullYear(), monthIndex, { minimumDate, maximumDate }
    )) return;
    setVisibleMonth(new Date(visibleMonth.getFullYear(), monthIndex, 1));
    setMode('calendar');
  }

  function chooseYear(year) {
    const requestedMonth = visibleMonth.getMonth();
    const monthIndex = monthHasSelectableDate(year, requestedMonth, { minimumDate, maximumDate })
      ? requestedMonth
      : year === bounds.maximum.getFullYear()
        ? bounds.maximum.getMonth()
        : bounds.minimum.getMonth();
    setVisibleMonth(new Date(year, monthIndex, 1));
    setMode('month');
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType='fade'
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <View style={styles.modalRoot}>
        <Pressable
          style={styles.backdrop}
          onPress={onClose}
          accessibilityRole='button'
          accessibilityLabel='Close calendar'
        />
        <SafeAreaView style={styles.safeFrame} edges={['top', 'bottom']} pointerEvents='box-none'>
          <View
            style={[styles.modalCard, { maxHeight: Math.max(320, height - 32) }]}
            accessibilityViewIsModal
          >
            <View style={styles.modalTopBar}>
              <View style={styles.modalTitleCopy}>
                <Text style={styles.modalTitle}>{title}</Text>
                <Text style={styles.modalSubtitle}>Future dates are unavailable.</Text>
              </View>
              <Pressable
                onPress={onClose}
                accessibilityRole='button'
                accessibilityLabel='Close calendar'
                style={({ pressed, hovered, focused }) => [
                  styles.iconButton,
                  hovered && styles.controlHovered,
                  focused && styles.controlFocused,
                  pressed && styles.pressed,
                ]}
              >
                <Icon name='close' size={22} color={COLORS.ink} />
              </Pressable>
            </View>

            {mode === 'calendar' ? (
              <ScrollView
                style={styles.calendarScroll}
                contentContainerStyle={styles.calendarScrollContent}
                showsVerticalScrollIndicator={Platform.OS === 'web'}
              >
                <View style={styles.monthHeader}>
                  <Pressable
                    onPress={() => canGoPrevious && setVisibleMonth(previousMonth)}
                    disabled={!canGoPrevious}
                    accessibilityRole='button'
                    accessibilityLabel={`Previous month, ${format(previousMonth, 'MMMM yyyy')}`}
                    accessibilityState={{ disabled: !canGoPrevious }}
                    style={({ pressed, hovered, focused }) => [
                      styles.iconButton,
                      !canGoPrevious && styles.disabledControl,
                      hovered && canGoPrevious && styles.controlHovered,
                      focused && styles.controlFocused,
                      pressed && canGoPrevious && styles.pressed,
                    ]}
                  >
                    <Icon name='chevron-back' size={22} color={COLORS.ink} />
                  </Pressable>
                  <Pressable
                    onPress={() => setMode('month')}
                    accessibilityRole='button'
                    accessibilityLabel={`Choose month and year, currently ${format(visibleMonth, 'MMMM yyyy')}`}
                    style={({ pressed, hovered, focused }) => [
                      styles.monthTitleButton,
                      hovered && styles.controlHovered,
                      focused && styles.controlFocused,
                      pressed && styles.pressed,
                    ]}
                  >
                    <Text style={styles.monthTitle}>{format(visibleMonth, 'MMMM yyyy')}</Text>
                    <Icon name='chevron-down' size={16} color={COLORS.brand} />
                  </Pressable>
                  <Pressable
                    onPress={() => canGoNext && setVisibleMonth(nextMonth)}
                    disabled={!canGoNext}
                    accessibilityRole='button'
                    accessibilityLabel={`Next month, ${format(nextMonth, 'MMMM yyyy')}`}
                    accessibilityState={{ disabled: !canGoNext }}
                    style={({ pressed, hovered, focused }) => [
                      styles.iconButton,
                      !canGoNext && styles.disabledControl,
                      hovered && canGoNext && styles.controlHovered,
                      focused && styles.controlFocused,
                      pressed && canGoNext && styles.pressed,
                    ]}
                  >
                    <Icon name='chevron-forward' size={22} color={COLORS.ink} />
                  </Pressable>
                </View>

                <View style={styles.weekRow} accessibilityRole='header'>
                  {WEEKDAYS.map((day) => <Text key={day} style={styles.weekday}>{day}</Text>)}
                </View>
                <View style={styles.dayGrid}>
                  {cells.map((cell) => {
                    const cellDate = parseISO(cell.dateKey);
                    const selectable = isCalendarDateSelectable(
                      cell.dateKey, { minimumDate, maximumDate }
                    );
                    const selected = value === cell.dateKey;
                    const today = isSameDay(cellDate, new Date());
                    return (
                      <Pressable
                        key={cell.dateKey}
                        onPress={() => chooseDate(cell.dateKey)}
                        disabled={!selectable}
                        accessibilityRole='button'
                        accessibilityLabel={`Select ${format(cellDate, 'MMMM d, yyyy')}${today ? ', today' : ''}`}
                        accessibilityState={{ selected, disabled: !selectable }}
                        style={({ pressed, hovered, focused }) => [
                          styles.dayCell,
                          !cell.inMonth && styles.outsideMonth,
                          today && !selected && styles.todayCell,
                          selected && styles.selectedDay,
                          !selectable && styles.disabledDay,
                          hovered && selectable && !selected && styles.dayHovered,
                          focused && styles.dayFocused,
                          pressed && selectable && styles.pressed,
                        ]}
                      >
                        <Text style={[
                          styles.dayText,
                          !cell.inMonth && styles.outsideMonthText,
                          today && !selected && styles.todayText,
                          selected && styles.selectedDayText,
                          !selectable && styles.disabledDayText,
                        ]}>
                          {cell.day}
                        </Text>
                        {today ? <View style={[styles.todayDot, selected && styles.todayDotSelected]} /> : null}
                      </Pressable>
                    );
                  })}
                </View>

                <View style={styles.calendarFooter}>
                  <Text style={styles.selectedSummary} numberOfLines={1}>
                    {parsedValue ? format(parsedValue, 'EEE, MMM d, yyyy') : 'No date selected'}
                  </Text>
                  <Pressable
                    onPress={() => chooseDate(localDateKey())}
                    accessibilityRole='button'
                    accessibilityLabel='Select today'
                    style={({ pressed, hovered, focused }) => [
                      styles.todayButton,
                      hovered && styles.controlHovered,
                      focused && styles.controlFocused,
                      pressed && styles.pressed,
                    ]}
                  >
                    <Icon name='today-outline' size={17} color={COLORS.brand} />
                    <Text style={styles.todayButtonText}>Today</Text>
                  </Pressable>
                </View>
              </ScrollView>
            ) : null}

            {mode === 'month' ? (
              <View style={styles.pickerPane}>
                <View style={styles.pickerHeadingRow}>
                  <Pressable
                    onPress={() => setMode('calendar')}
                    accessibilityRole='button'
                    accessibilityLabel='Back to calendar'
                    style={({ pressed, hovered, focused }) => [
                      styles.iconButton,
                      hovered && styles.controlHovered,
                      focused && styles.controlFocused,
                      pressed && styles.pressed,
                    ]}
                  >
                    <Icon name='chevron-back' size={22} color={COLORS.ink} />
                  </Pressable>
                  <Text style={styles.pickerHeading}>Choose a month</Text>
                  <View style={styles.iconButtonPlaceholder} />
                </View>
                <Pressable
                  onPress={() => setMode('year')}
                  accessibilityRole='button'
                  accessibilityLabel={`Choose year, currently ${visibleMonth.getFullYear()}`}
                  style={({ pressed, hovered, focused }) => [
                    styles.yearSelector,
                    hovered && styles.controlHovered,
                    focused && styles.controlFocused,
                    pressed && styles.pressed,
                  ]}
                >
                  <Text style={styles.yearSelectorText}>{visibleMonth.getFullYear()}</Text>
                  <Icon name='chevron-down' size={17} color={COLORS.brand} />
                </Pressable>
                <View style={styles.monthGrid}>
                  {MONTHS.map((month, index) => {
                    const enabled = monthHasSelectableDate(
                      visibleMonth.getFullYear(), index, { minimumDate, maximumDate }
                    );
                    const selected = index === visibleMonth.getMonth();
                    return (
                      <Pressable
                        key={month}
                        onPress={() => chooseMonth(index)}
                        disabled={!enabled}
                        accessibilityRole='button'
                        accessibilityLabel={`Choose ${format(new Date(visibleMonth.getFullYear(), index, 1), 'MMMM yyyy')}`}
                        accessibilityState={{ selected, disabled: !enabled }}
                        style={({ pressed, hovered, focused }) => [
                          styles.monthOption,
                          selected && styles.monthOptionSelected,
                          !enabled && styles.disabledControl,
                          hovered && enabled && !selected && styles.controlHovered,
                          focused && styles.controlFocused,
                          pressed && enabled && styles.pressed,
                        ]}
                      >
                        <Text style={[styles.monthOptionText, selected && styles.monthOptionTextSelected]}>
                          {month}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            ) : null}

            {mode === 'year' ? (
              <View style={styles.pickerPane}>
                <View style={styles.pickerHeadingRow}>
                  <Pressable
                    onPress={() => setMode('month')}
                    accessibilityRole='button'
                    accessibilityLabel='Back to month selection'
                    style={({ pressed, hovered, focused }) => [
                      styles.iconButton,
                      hovered && styles.controlHovered,
                      focused && styles.controlFocused,
                      pressed && styles.pressed,
                    ]}
                  >
                    <Icon name='chevron-back' size={22} color={COLORS.ink} />
                  </Pressable>
                  <Text style={styles.pickerHeading}>Choose a year</Text>
                  <View style={styles.iconButtonPlaceholder} />
                </View>
                <ScrollView
                  style={styles.yearList}
                  contentContainerStyle={styles.yearListContent}
                  showsVerticalScrollIndicator={Platform.OS === 'web'}
                >
                  {years.map((year) => {
                    const selected = year === visibleMonth.getFullYear();
                    return (
                      <Pressable
                        key={year}
                        onPress={() => chooseYear(year)}
                        accessibilityRole='button'
                        accessibilityLabel={`Choose ${year}`}
                        accessibilityState={{ selected }}
                        style={({ pressed, hovered, focused }) => [
                          styles.yearOption,
                          selected && styles.yearOptionSelected,
                          hovered && !selected && styles.controlHovered,
                          focused && styles.controlFocused,
                          pressed && styles.pressed,
                        ]}
                      >
                        <Text style={[styles.yearOptionText, selected && styles.yearOptionTextSelected]}>
                          {year}
                        </Text>
                        {selected ? <Icon name='checkmark' size={18} color={COLORS.brand} /> : null}
                      </Pressable>
                    );
                  })}
                </ScrollView>
              </View>
            ) : null}
          </View>
        </SafeAreaView>
      </View>
    </Modal>
  );
}

const styles = createThemedStyles({
  modalRoot: { flex: 1, justifyContent: 'center' },
  backdrop: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.56)',
  },
  safeFrame: { flex: 1, justifyContent: 'center', paddingHorizontal: 12, paddingVertical: 16 },
  modalCard: {
    width: '100%',
    maxWidth: 420,
    alignSelf: 'center',
    overflow: 'hidden',
    borderRadius: 16,
    backgroundColor: COLORS.canvas,
    ...Platform.select({
      web: ELEVATION.web,
      ios: ELEVATION.ios,
      android: ELEVATION.android,
      default: {},
    }),
  },
  modalTopBar: {
    minHeight: 72,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.hairline,
  },
  modalTitleCopy: { flex: 1, minWidth: 0 },
  modalTitle: { fontSize: 18, lineHeight: 24, fontWeight: '700', color: COLORS.ink },
  modalSubtitle: { marginTop: 2, fontSize: 13, lineHeight: 18, color: COLORS.body },
  iconButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconButtonPlaceholder: { width: 44, height: 44 },
  monthHeader: {
    minHeight: 64,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingTop: 8,
  },
  calendarScroll: { flexShrink: 1 },
  calendarScrollContent: { paddingBottom: 0 },
  monthTitleButton: {
    minHeight: 44,
    flex: 1,
    maxWidth: 220,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderRadius: LAYOUT.controlRadius,
    paddingHorizontal: 10,
  },
  monthTitle: { fontSize: 17, lineHeight: 22, fontWeight: '700', color: COLORS.ink },
  weekRow: { flexDirection: 'row', paddingHorizontal: 10 },
  weekday: {
    flex: 1,
    minWidth: 0,
    paddingVertical: 7,
    fontSize: 11,
    lineHeight: 16,
    fontWeight: '600',
    color: COLORS.muted,
    textAlign: 'center',
  },
  dayGrid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 10 },
  dayCell: {
    flexBasis: '14.2857%',
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
  },
  dayText: { fontSize: 14, lineHeight: 20, fontWeight: '500', color: COLORS.ink },
  outsideMonth: { opacity: 0.56 },
  outsideMonthText: { color: COLORS.muted },
  selectedDay: { backgroundColor: COLORS.brand },
  selectedDayText: { color: COLORS.onBrand, fontWeight: '700' },
  todayCell: { borderWidth: 1, borderColor: COLORS.sage },
  todayText: { color: COLORS.sage, fontWeight: '700' },
  todayDot: { position: 'absolute', bottom: 5, width: 3, height: 3, borderRadius: 2, backgroundColor: COLORS.sage },
  todayDotSelected: { backgroundColor: COLORS.onBrand },
  disabledDay: { opacity: 0.28 },
  disabledDayText: { color: COLORS.muted },
  dayHovered: { backgroundColor: COLORS.surfaceSoft },
  dayFocused: { borderWidth: 2, borderColor: COLORS.brand },
  calendarFooter: {
    minHeight: 68,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 8,
    paddingHorizontal: 18,
    borderTopWidth: 1,
    borderTopColor: COLORS.hairline,
  },
  selectedSummary: { flex: 1, minWidth: 0, fontSize: 13, lineHeight: 18, color: COLORS.body },
  todayButton: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 12,
    borderRadius: LAYOUT.controlRadius,
    borderWidth: 1,
    borderColor: COLORS.hairline,
  },
  todayButtonText: { fontSize: 14, lineHeight: 20, fontWeight: '700', color: COLORS.brand },
  pickerPane: { height: 400, flexShrink: 1, paddingHorizontal: 18, paddingBottom: 18 },
  pickerHeadingRow: {
    minHeight: 64,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  pickerHeading: { fontSize: 17, lineHeight: 22, fontWeight: '700', color: COLORS.ink },
  yearSelector: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginBottom: 14,
    borderRadius: LAYOUT.controlRadius,
    backgroundColor: COLORS.surfaceSoft,
  },
  yearSelectorText: { fontSize: 16, lineHeight: 22, fontWeight: '700', color: COLORS.ink },
  monthGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  monthOption: {
    minHeight: 52,
    flexBasis: '30%',
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: LAYOUT.controlRadius,
    borderWidth: 1,
    borderColor: COLORS.hairline,
    backgroundColor: COLORS.canvas,
  },
  monthOptionSelected: { borderColor: COLORS.brand, backgroundColor: COLORS.brandSoft },
  monthOptionText: { fontSize: 14, lineHeight: 20, fontWeight: '600', color: COLORS.body },
  monthOptionTextSelected: { color: COLORS.brand, fontWeight: '700' },
  yearList: { flex: 1 },
  yearListContent: { paddingBottom: 8 },
  yearOption: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    borderRadius: LAYOUT.controlRadius,
  },
  yearOptionSelected: { backgroundColor: COLORS.brandSoft },
  yearOptionText: { fontSize: 15, lineHeight: 22, fontWeight: '500', color: COLORS.body },
  yearOptionTextSelected: { color: COLORS.brand, fontWeight: '700' },
  disabledControl: { opacity: 0.34 },
  controlHovered: { backgroundColor: COLORS.surfaceSoft },
  controlFocused: { borderWidth: 2, borderColor: COLORS.brand },
  pressed: { opacity: 0.68, transform: [{ scale: 0.98 }] },
});
