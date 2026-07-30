import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
} from 'react';
import { differenceInCalendarDays, isValid, parseISO } from 'date-fns';
import { KEYS, storage } from '../services/storage';
import { useAuth } from './AuthContext';
import {
  deleteAllCurrentUserTrackingData,
  deleteCurrentUserCheckin,
  deleteCurrentUserPeriod,
  loadCurrentUserData,
  saveCurrentUserCheckin,
  saveCurrentUserPeriod,
  saveCurrentUserProfile,
} from '../services/userData';
import {
  deleteAllCurrentUserMegData,
  deleteCurrentUserMegConversation,
  loadCurrentUserMegConversations,
  updateCurrentUserMegFeedback,
} from '../services/megData';
import {
  applyDietReflections,
  deleteAllCurrentUserDietData,
  deleteCurrentUserMeal as deleteCurrentUserDietMeal,
  loadCurrentUserDietData,
  mergeDietProfile,
  mergeDietRecords,
  saveCurrentUserDietObservation,
  saveCurrentUserDietProfile,
  saveCurrentUserMeal,
  syncCurrentUserDietSnapshot,
} from '../services/dietData';
import { mergeMegConversations } from '../services/megLocalQueue';
import { buildDailyPlan, updatePlanAction as updatePlanActionValue } from '../services/dailyPlan';
import { predictCycle } from '../services/cyclePrediction';
import {
  assertValidPeriodChange,
  mergePeriodChange,
  removePeriodEntry,
} from '../services/periodValidation';
import {
  DATA_SCHEMA_VERSION,
  DEFAULT_TRACKING_PREFERENCES,
  normalizeCheckin,
  normalizeCollection,
  normalizePeriod,
  stableId,
} from '../models';
import {
  calculateAverageCycleLength,
  getCycleDay,
  getPhaseInfo,
  predictNextPeriod,
} from '../utils/helpers';
import { localDateKey } from '../utils/dateKey';
import { setStartupStage } from '../diagnostics/startupDiagnostics';

const AppContext = createContext();

const defaultReminders = {
  checkin: { enabled: true, time: '20:00' },
  period: { enabled: false, time: '20:00' },
  medication: { enabled: false, time: '09:00' },
  meals: { enabled: false, time: '13:00' },
  movement: { enabled: false, time: '18:00' },
  sleep: { enabled: false, time: '22:00' },
  weekly: { enabled: true, time: '09:00', day: 0 },
};

function upsertValue(items, value, matcher) {
  const index = items.findIndex(matcher);
  if (index < 0) return [...items, value];
  return items.map((item, itemIndex) => (
    itemIndex === index ? { ...item, ...value } : item
  ));
}

function reflectionFromMeal(meal) {
  const outcome = meal?.reflection?.outcome
    || meal?.afterMealReflection
    || meal?.reflectionOutcome
    || null;
  if (!meal?.id || !outcome) return null;
  return {
    id: `reflection-${meal.id}`,
    mealId: meal.id,
    mealLogId: meal.id,
    outcome,
    outcomes: [outcome],
    recordedAt: meal?.reflection?.recordedAt || meal?.reflectionUpdatedAt || meal?.updatedAt || null,
    updatedAt: meal?.updatedAt || null,
  };
}

function mealReflections(meals) {
  return (Array.isArray(meals) ? meals : []).map(reflectionFromMeal).filter(Boolean);
}

const initialState = {
  isLoading: true,
  saveStatus: 'idle',
  lastError: null,
  profile: null,
  checkins: [],
  periods: [],
  meals: [],
  dietReflections: [],
  dietObservations: [],
  movements: [],
  medications: [],
  dailyPlans: [],
  megConversations: [],
  doctorReportSettings: null,
  settings: {
    ...DEFAULT_TRACKING_PREFERENCES,
    reminders: defaultReminders,
  },
  bookmarks: [],
  privacy: {
    appLockEnabled: false,
    appLockType: null,
    appLockPin: null,
    appLockTimeout: 5,
    hidePreview: false,
  },
};

function appReducer(state, action) {
  switch (action.type) {
    case 'SET_LOADING': return { ...state, isLoading: action.payload };
    case 'SET_PROFILE': return { ...state, profile: action.payload };
    case 'SET_CHECKINS': return { ...state, checkins: action.payload };
    case 'SET_PERIODS': return { ...state, periods: action.payload };
    case 'SET_MEALS': return { ...state, meals: action.payload };
    case 'SET_DIET_REFLECTIONS': return { ...state, dietReflections: action.payload };
    case 'SET_DIET_OBSERVATIONS': return { ...state, dietObservations: action.payload };
    case 'SET_MOVEMENTS': return { ...state, movements: action.payload };
    case 'SET_MEDICATIONS': return { ...state, medications: action.payload };
    case 'SET_DAILY_PLANS': return { ...state, dailyPlans: action.payload };
    case 'SET_MEG_CONVERSATIONS': return { ...state, megConversations: action.payload };
    case 'SET_DOCTOR_REPORT_SETTINGS': return { ...state, doctorReportSettings: action.payload };
    case 'SET_SETTINGS': return { ...state, settings: action.payload };
    case 'SET_BOOKMARKS': return { ...state, bookmarks: action.payload };
    case 'SET_PRIVACY': return { ...state, privacy: { ...state.privacy, ...action.payload } };
    case 'SET_SAVE_STATE': return { ...state, saveStatus: action.payload.status, lastError: action.payload.error || null };
    case 'RESET_FOR_USER': return { ...initialState, isLoading: true };
    case 'RESET': return { ...initialState, isLoading: false };
    default: return state;
  }
}

function derivedValues(state) {
  const today = localDateKey();
  const todayCheckin = state.checkins.find((item) => item.date === today) || null;
  const cyclePrediction = state.settings.cyclePredictions === false
    ? null
    : predictCycle(state.periods, state.checkins, new Date());
  const averageCycleLength = cyclePrediction?.cycleLength || calculateAverageCycleLength(state.periods);
  const nextPeriodPrediction = cyclePrediction?.nextPeriodStart
    ? parseISO(cyclePrediction.nextPeriodStart)
    : state.settings.cyclePredictions === false
      ? null
      : predictNextPeriod(state.periods);
  const latestPeriod = [...state.periods]
    .filter((item) => item.startDate && isValid(parseISO(item.startDate)))
    .sort((a, b) => b.startDate.localeCompare(a.startDate))[0] || null;
  const currentCycleDay = latestPeriod ? getCycleDay(latestPeriod.startDate) : null;
  const currentPhase = state.periods.length >= 2 && averageCycleLength
    ? getPhaseInfo(currentCycleDay, averageCycleLength)
    : null;
  const movementDays = new Set(
    state.movements.filter((item) => item.status !== 'not_today').map((item) => item.date)
  ).size;

  return {
    todayCheckin,
    averageCycleLength,
    nextPeriodPrediction,
    cyclePrediction,
    currentCycleDay,
    currentPhase,
    stats: {
      totalCheckins: state.checkins.length,
      totalCycles: state.periods.length,
      savedArticles: state.bookmarks.length,
      mealsLogged: state.meals.length,
      movementDays,
      articlesRead: 0,
      currentStreak: 0,
    },
  };
}

export function AppProvider({ children }) {
  const { user } = useAuth();
  if (!user?.uid) throw new Error('AppProvider requires a signed-in Bloom account.');
  storage.setUserScope(user.uid);
  const [state, dispatch] = useReducer(appReducer, initialState);
  const activeUidRef = useRef(user.uid);
  const dietMutationRevisionRef = useRef(0);
  activeUidRef.current = user.uid;
  const publicState = useMemo(() => ({ ...state, ...derivedValues(state) }), [state]);

  useEffect(() => {
    setStartupStage('profile-load');
    dispatch({ type: 'RESET_FOR_USER' });
    loadInitialData();
  }, [user?.uid]);

  useEffect(() => {
    storage.setUserScope(user.uid);
    return () => storage.clearUserScope(user.uid);
  }, [user.uid]);

  async function hydrateDietData(expectedUid, localMeals, localSettings, expectedRevision) {
    try {
      if (dietMutationRevisionRef.current !== expectedRevision) return;
      const remote = await loadCurrentUserDietData(expectedUid);
      if (
        activeUidRef.current !== expectedUid
        || dietMutationRevisionRef.current !== expectedRevision
      ) return;

      const localDeletedMealIds = Array.isArray(localSettings?.dietProfile?.deletedMealIds)
        ? localSettings.dietProfile.deletedMealIds
        : [];
      const remoteDeletedMealIds = Array.isArray(remote.profile?.deletedMealIds)
        ? remote.profile.deletedMealIds
        : [];
      const deletedMealIds = [...new Set([
        ...localDeletedMealIds,
        ...remoteDeletedMealIds,
      ].filter(Boolean))].slice(-100);
      const deletedMealIdSet = new Set(deletedMealIds);

      const mergedMeals = applyDietReflections(
        mergeDietRecords(
          localMeals.filter((meal) => !deletedMealIdSet.has(meal?.id)),
          remote.meals.filter((meal) => !deletedMealIdSet.has(meal?.id))
        ),
        remote.reflections
      );
      const baseProfile = mergeDietProfile(localSettings?.dietProfile, remote.profile);
      const dismissedObservationIds = [
        ...(Array.isArray(baseProfile?.dismissedObservationIds)
          ? baseProfile.dismissedObservationIds
          : []),
        ...remote.observations
          .filter((observation) => observation?.dismissed === true)
          .map((observation) => observation.id),
      ].filter((id, index, values) => id && values.indexOf(id) === index);
      const mergedProfile = baseProfile
        ? { ...baseProfile, dismissedObservationIds, deletedMealIds }
        : deletedMealIds.length ? { deletedMealIds } : null;
      const mergedSettings = mergedProfile
        ? { ...localSettings, dietProfile: mergedProfile }
        : localSettings;
      const userScope = encodeURIComponent(expectedUid);

      if (dietMutationRevisionRef.current !== expectedRevision) return;
      await Promise.all([
        storage.setItem(KEYS.MEALS, mergedMeals, userScope),
        storage.setItem(KEYS.SETTINGS, mergedSettings, userScope),
      ]);
      if (
        activeUidRef.current !== expectedUid
        || dietMutationRevisionRef.current !== expectedRevision
      ) return;

      dispatch({ type: 'SET_MEALS', payload: normalizeCollection(mergedMeals) });
      dispatch({ type: 'SET_DIET_REFLECTIONS', payload: mealReflections(mergedMeals) });
      dispatch({ type: 'SET_DIET_OBSERVATIONS', payload: remote.observations });
      if (mergedProfile) {
        dispatch({
          type: 'SET_SETTINGS',
          payload: {
            ...initialState.settings,
            ...mergedSettings,
            reminders: { ...defaultReminders, ...(mergedSettings.reminders || {}) },
          },
        });
      }

      void syncCurrentUserDietSnapshot({
        profile: mergedProfile,
        meals: mergedMeals,
        observations: remote.observations,
      }, expectedUid);
      deletedMealIds.forEach((id) => {
        void deleteCurrentUserDietMeal(id, expectedUid).catch(() => undefined);
      });
    } catch {
      // Diet remains fully available from UID-scoped device storage.
    }
  }

  async function loadInitialData() {
    const expectedUid = user.uid;
    let dietBootstrap = null;
    let remoteAccountUnavailable = false;
    try {
      setStartupStage('app-state-load');
      const [
        accountData, megConversations, localMegConversations, meals, movements, medications,
        dailyPlans, doctorReportSettings, settings, bookmarks, privacySettings,
      ] = await Promise.all([
        loadCurrentUserData().catch(() => {
          remoteAccountUnavailable = true;
          return { profile: null, checkins: [], periods: [] };
        }),
        loadCurrentUserMegConversations().catch(() => {
          remoteAccountUnavailable = true;
          return [];
        }),
        storage.getMegConversations(),
        storage.getMeals(),
        storage.getMovements(),
        storage.getMedications(),
        storage.getDailyPlans(),
        storage.getDoctorReportSettings(),
        storage.getSettings(),
        storage.getBookmarks(),
        Promise.all([
          storage.getAppLockEnabled(), storage.getAppLockType(), storage.getAppLockPin(),
          storage.getAppLockTimeout(), storage.getHidePreview(),
        ]),
      ]);

      const { profile, checkins, periods } = accountData;
      const [appLockEnabled, appLockType, appLockPin, appLockTimeout, hidePreview] = privacySettings;
      const loadedSettings = settings && typeof settings === 'object' && !Array.isArray(settings)
        ? settings
        : {};
      const loadedDoctorReportSettings = doctorReportSettings
        && typeof doctorReportSettings === 'object'
        && !Array.isArray(doctorReportSettings)
        ? doctorReportSettings
        : null;
      dispatch({ type: 'SET_PROFILE', payload: profile });
      dispatch({ type: 'SET_CHECKINS', payload: normalizeCollection(checkins, normalizeCheckin) });
      dispatch({ type: 'SET_PERIODS', payload: normalizeCollection(periods, normalizePeriod) });
      dispatch({ type: 'SET_MEALS', payload: normalizeCollection(meals) });
      dispatch({ type: 'SET_DIET_REFLECTIONS', payload: mealReflections(meals) });
      dispatch({ type: 'SET_MOVEMENTS', payload: normalizeCollection(movements) });
      dispatch({ type: 'SET_MEDICATIONS', payload: normalizeCollection(medications) });
      dispatch({ type: 'SET_DAILY_PLANS', payload: normalizeCollection(dailyPlans) });
      const mergedMegConversations = mergeMegConversations(
        localMegConversations,
        megConversations
      );
      dispatch({ type: 'SET_MEG_CONVERSATIONS', payload: mergedMegConversations });
      void storage.setMegConversations(mergedMegConversations).catch(() => undefined);
      dispatch({ type: 'SET_DOCTOR_REPORT_SETTINGS', payload: loadedDoctorReportSettings });
      dispatch({
        type: 'SET_SETTINGS',
        payload: {
          ...initialState.settings,
          ...loadedSettings,
          reminders: { ...defaultReminders, ...(loadedSettings.reminders || {}) },
        },
      });
      dispatch({ type: 'SET_BOOKMARKS', payload: Array.isArray(bookmarks) ? bookmarks : [] });
      dispatch({
        type: 'SET_PRIVACY',
        payload: {
          appLockEnabled: Boolean(appLockEnabled),
          appLockType: appLockType || null,
          appLockPin: appLockPin || null,
          appLockTimeout: appLockTimeout || 5,
          hidePreview: Boolean(hidePreview),
        },
      });
      await storage.setSchemaVersion(DATA_SCHEMA_VERSION);
      if (remoteAccountUnavailable) {
        dispatch({
          type: 'SET_SAVE_STATE',
          payload: {
            status: 'idle',
            error: 'Some cloud records are unavailable offline. Device-saved features remain ready.',
          },
        });
      }
      dietBootstrap = {
        meals: normalizeCollection(meals),
        settings: loadedSettings,
        revision: dietMutationRevisionRef.current,
      };
    } catch (error) {
      dispatch({
        type: 'SET_SAVE_STATE',
        payload: {
          status: 'error',
          error: 'Bloom could not load your account records. Check your connection and try again.',
        },
      });
    } finally {
      dispatch({ type: 'SET_LOADING', payload: false });
      if (dietBootstrap && activeUidRef.current === expectedUid) {
        Promise.resolve().then(() => hydrateDietData(
          expectedUid,
          dietBootstrap.meals,
          dietBootstrap.settings,
          dietBootstrap.revision
        ));
      }
    }
  }

  async function persist(operation) {
    dispatch({ type: 'SET_SAVE_STATE', payload: { status: 'saving' } });
    try {
      const result = await operation();
      dispatch({ type: 'SET_SAVE_STATE', payload: { status: 'saved' } });
      return result;
    } catch (error) {
      dispatch({
        type: 'SET_SAVE_STATE',
        payload: {
          status: 'error',
          error: 'Bloom could not save this change. Check your connection and try again.',
        },
      });
      throw error;
    }
  }

  async function saveProfile(profile) {
    const updated = { ...(state.profile || {}), ...profile };
    const saved = await persist(() => saveCurrentUserProfile(updated));
    dispatch({ type: 'SET_PROFILE', payload: saved });
    return saved;
  }

  async function saveSettings(newSettings) {
    if (newSettings.dietProfile) dietMutationRevisionRef.current += 1;
    const dietProfile = newSettings.dietProfile
      ? { ...newSettings.dietProfile, updatedAt: new Date().toISOString() }
      : null;
    const updated = {
      ...state.settings,
      ...newSettings,
      ...(dietProfile ? { dietProfile } : {}),
      reminders: newSettings.reminders
        ? { ...state.settings.reminders, ...newSettings.reminders }
        : state.settings.reminders,
    };
    await persist(() => storage.setSettings(updated));
    dispatch({ type: 'SET_SETTINGS', payload: updated });
    if (dietProfile) {
      const expectedUid = user.uid;
      void saveCurrentUserDietProfile(dietProfile, expectedUid).catch(() => undefined);
      (Array.isArray(dietProfile.dismissedObservationIds)
        ? dietProfile.dismissedObservationIds
        : []).forEach((id) => {
        void saveCurrentUserDietObservation({
          id,
          dismissed: true,
          isCausal: false,
        }, expectedUid).catch(() => undefined);
      });
    }
    return updated;
  }

  async function refreshPlan(date, overrides = {}) {
    const checkin = overrides.checkin !== undefined
      ? overrides.checkin
      : state.checkins.find((item) => item.date === date) || null;
    const meals = overrides.meals || state.meals;
    const movements = overrides.movements || state.movements;
    const previousPlan = state.dailyPlans.find((item) => item.date === date) || null;
    const plan = buildDailyPlan({ date, checkin, meals, movements, previousPlan });
    const plans = await storage.saveDailyPlan(plan);
    dispatch({ type: 'SET_DAILY_PLANS', payload: plans });
    return plan;
  }

  async function syncBleedingToPeriod(checkin) {
    if (!['light', 'medium', 'heavy'].includes(checkin.flow)) return state.periods;
    const target = parseISO(checkin.date);
    if (!isValid(target) || target > new Date()) return state.periods;
    const nearby = [...state.periods]
      .filter((item) => item.startDate && isValid(parseISO(item.startDate)))
      .sort((a, b) => b.startDate.localeCompare(a.startDate))
      .find((item) => {
        const distance = differenceInCalendarDays(target, parseISO(item.startDate));
        return distance >= 0 && distance <= 10;
      });
    if (nearby) {
      if (nearby.source !== 'checkin' || nearby.endDate === checkin.date) return state.periods;
      const endDate = nearby.endDate && nearby.endDate > checkin.date
        ? nearby.endDate
        : checkin.date;
      const candidate = {
        ...nearby,
        endDate,
        flow: checkin.flow,
      };
      try {
        assertValidPeriodChange(candidate, state.periods, {
          previousId: nearby.id,
          previousStartDate: nearby.startDate,
        });
      } catch (error) {
        return state.periods;
      }
      const saved = normalizePeriod(await saveCurrentUserPeriod({
        ...candidate,
      }, nearby.startDate));
      const periods = mergePeriodChange(state.periods, saved, {
        previousId: nearby.id,
        previousStartDate: nearby.startDate,
      });
      dispatch({ type: 'SET_PERIODS', payload: normalizeCollection(periods, normalizePeriod) });
      return periods;
    }
    const period = normalizePeriod({
      id: stableId('period', checkin.date),
      startDate: checkin.date,
      endDate: checkin.date === localDateKey() ? null : checkin.date,
      flow: checkin.flow,
      source: 'checkin',
    });
    try {
      assertValidPeriodChange(period, state.periods);
    } catch (error) {
      return state.periods;
    }
    const saved = normalizePeriod(await saveCurrentUserPeriod(period));
    const periods = mergePeriodChange(state.periods, saved);
    dispatch({ type: 'SET_PERIODS', payload: normalizeCollection(periods, normalizePeriod) });
    return periods;
  }

  async function saveCheckin(checkin) {
    const normalized = normalizeCheckin({ ...checkin, updatedAt: new Date().toISOString() });
    const saved = normalizeCheckin(await persist(() => saveCurrentUserCheckin(normalized)));
    const checkins = upsertValue(
      state.checkins,
      saved,
      (item) => item.date === saved.date
    );
    dispatch({ type: 'SET_CHECKINS', payload: normalizeCollection(checkins, normalizeCheckin) });
    await syncBleedingToPeriod(saved);
    await refreshPlan(saved.date, { checkin: saved });
    return saved;
  }

  async function deleteCheckin(date) {
    await persist(() => deleteCurrentUserCheckin(date));
    const checkins = state.checkins.filter((item) => item.date !== date);
    dispatch({ type: 'SET_CHECKINS', payload: normalizeCollection(checkins, normalizeCheckin) });
    await refreshPlan(date, { checkin: null });
    return checkins;
  }

  async function savePeriod(period) {
    const requestedId = period?.id || null;
    const normalized = normalizePeriod(period);
    const previous = requestedId
      ? state.periods.find((item) => item.id === requestedId)
      : null;
    const previousStartDate = previous?.startDate || null;
    assertValidPeriodChange(normalized, state.periods, {
      previousId: previous?.id || null,
      previousStartDate,
    });
    const saved = normalizePeriod(await persist(
      () => saveCurrentUserPeriod(normalized, previousStartDate)
    ));
    const periods = mergePeriodChange(state.periods, saved, {
      previousId: previous?.id || null,
      previousStartDate,
    });
    dispatch({ type: 'SET_PERIODS', payload: normalizeCollection(periods, normalizePeriod) });
    return saved;
  }

  async function deletePeriod(idOrStartDate) {
    const existing = state.periods.find(
      (item) => item.id === idOrStartDate || item.startDate === idOrStartDate
    );
    const startDate = existing?.startDate || idOrStartDate;
    await persist(() => deleteCurrentUserPeriod(startDate));
    const periods = removePeriodEntry(state.periods, existing?.id || startDate);
    dispatch({ type: 'SET_PERIODS', payload: normalizeCollection(periods, normalizePeriod) });
    return periods;
  }

  async function saveMeal(meal) {
    dietMutationRevisionRef.current += 1;
    const value = {
      ...meal,
      id: meal.id || stableId('meal'),
      date: meal.date || localDateKey(),
      updatedAt: new Date().toISOString(),
    };
    const meals = await persist(() => storage.saveMeal(value));
    dispatch({ type: 'SET_MEALS', payload: meals });
    dispatch({ type: 'SET_DIET_REFLECTIONS', payload: mealReflections(meals) });
    void saveCurrentUserMeal(value, user.uid).catch(() => undefined);
    await refreshPlan(value.date, { meals });
    return value;
  }

  async function deleteMeal(id) {
    dietMutationRevisionRef.current += 1;
    const existing = state.meals.find((item) => item.id === id);
    const previousProfile = state.settings.dietProfile || {};
    const deletedMealIds = [...new Set([
      ...(Array.isArray(previousProfile.deletedMealIds) ? previousProfile.deletedMealIds : []),
      id,
    ].filter(Boolean))].slice(-100);
    const dietProfile = {
      ...previousProfile,
      deletedMealIds,
      updatedAt: new Date().toISOString(),
    };
    const updatedSettings = { ...state.settings, dietProfile };
    const meals = await persist(async () => {
      const nextMeals = await storage.deleteMeal(id);
      await storage.setSettings(updatedSettings);
      return nextMeals;
    });
    dispatch({ type: 'SET_MEALS', payload: meals });
    dispatch({ type: 'SET_DIET_REFLECTIONS', payload: mealReflections(meals) });
    dispatch({ type: 'SET_SETTINGS', payload: updatedSettings });
    void deleteCurrentUserDietMeal(id, user.uid).catch(() => undefined);
    void saveCurrentUserDietProfile(dietProfile, user.uid).catch(() => undefined);
    if (existing) await refreshPlan(existing.date, { meals });
    return meals;
  }

  async function saveMovement(movement) {
    const value = {
      ...movement,
      id: movement.id || stableId('movement'),
      date: movement.date || localDateKey(),
      updatedAt: new Date().toISOString(),
    };
    const movements = await persist(() => storage.saveMovement(value));
    dispatch({ type: 'SET_MOVEMENTS', payload: movements });
    await refreshPlan(value.date, { movements });
    return value;
  }

  async function deleteMovement(id) {
    const existing = state.movements.find((item) => item.id === id);
    const movements = await persist(() => storage.deleteMovement(id));
    dispatch({ type: 'SET_MOVEMENTS', payload: movements });
    if (existing) await refreshPlan(existing.date, { movements });
    return movements;
  }

  async function saveMedication(entry) {
    const value = { ...entry, id: entry.id || stableId('medication') };
    const medications = await persist(() => storage.saveMedication(value));
    dispatch({ type: 'SET_MEDICATIONS', payload: medications });
    return value;
  }

  async function deleteMedication(id) {
    const medications = await persist(() => storage.deleteMedication(id));
    dispatch({ type: 'SET_MEDICATIONS', payload: medications });
    return medications;
  }

  async function saveDailyPlan(plan) {
    const plans = await persist(() => storage.saveDailyPlan(plan));
    dispatch({ type: 'SET_DAILY_PLANS', payload: plans });
    return plan;
  }

  async function updatePlanAction(date, actionId, status) {
    const plan = state.dailyPlans.find((item) => item.date === date);
    if (!plan) return null;
    return saveDailyPlan(updatePlanActionValue(plan, actionId, status));
  }

  async function saveMegConversation(conversation) {
    const current = state.megConversations.filter((item) => item.id !== conversation.id);
    const next = [...current, conversation];
    await storage.setMegConversations(next);
    dispatch({ type: 'SET_MEG_CONVERSATIONS', payload: next });
    return conversation;
  }

  async function deleteMegConversation(id) {
    await persist(() => deleteCurrentUserMegConversation(id));
    const conversations = state.megConversations.filter((item) => item.id !== id);
    await storage.setMegConversations(conversations);
    dispatch({ type: 'SET_MEG_CONVERSATIONS', payload: conversations });
    return conversations;
  }

  async function clearMegHistory() {
    await persist(() => deleteAllCurrentUserMegData());
    await storage.setMegConversations([]);
    dispatch({ type: 'SET_MEG_CONVERSATIONS', payload: [] });
  }

  async function saveMegFeedback(conversationId, messageId, feedback) {
    await persist(() => updateCurrentUserMegFeedback(conversationId, messageId, feedback));
    const conversations = state.megConversations.map((conversation) => (
      conversation.id !== conversationId
        ? conversation
        : {
            ...conversation,
            messages: (conversation.messages || []).map((message) => (
              message.id === messageId ? { ...message, feedback: feedback ?? null } : message
            )),
          }
    ));
    await storage.setMegConversations(conversations);
    dispatch({ type: 'SET_MEG_CONVERSATIONS', payload: conversations });
  }

  async function saveDoctorReportSettings(settings) {
    await persist(() => storage.setDoctorReportSettings(settings));
    dispatch({ type: 'SET_DOCTOR_REPORT_SETTINGS', payload: settings });
    return settings;
  }

  async function toggleBookmark(articleId) {
    const bookmarks = await persist(() => storage.toggleBookmark(articleId));
    dispatch({ type: 'SET_BOOKMARKS', payload: bookmarks });
    return bookmarks;
  }

  async function savePrivacy(privacy) {
    const updated = { ...state.privacy, ...privacy };
    await persist(() => Promise.all([
      storage.setAppLockEnabled(updated.appLockEnabled),
      storage.setAppLockType(updated.appLockType),
      storage.setAppLockPin(updated.appLockPin),
      storage.setAppLockTimeout(updated.appLockTimeout),
      storage.setHidePreview(updated.hidePreview),
    ]));
    dispatch({ type: 'SET_PRIVACY', payload: updated });
  }

  async function resetAllData() {
    await persist(() => Promise.all([
      deleteAllCurrentUserTrackingData(),
      deleteAllCurrentUserMegData(),
      deleteAllCurrentUserDietData(user.uid),
      storage.deleteAllData(),
    ]));
    dispatch({ type: 'RESET_FOR_USER' });
    await loadInitialData();
  }

  const value = {
    state: publicState,
    dispatch,
    saveProfile,
    saveSettings,
    saveCheckin,
    deleteCheckin,
    savePeriod,
    deletePeriod,
    saveMeal,
    deleteMeal,
    saveMovement,
    deleteMovement,
    saveMedication,
    deleteMedication,
    saveDailyPlan,
    updatePlanAction,
    saveMegConversation,
    saveMegFeedback,
    deleteMegConversation,
    clearMegHistory,
    saveDoctorReportSettings,
    toggleBookmark,
    savePrivacy,
    resetAllData,
    loadInitialData,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const context = useContext(AppContext);
  if (!context) throw new Error('useApp must be used within an AppProvider');
  return context;
}
