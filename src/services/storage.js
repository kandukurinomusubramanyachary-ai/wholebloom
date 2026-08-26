import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

export const STORAGE_KEY_VERSION = 1;

const KEYS = {
  SCHEMA_VERSION: '@bloom_schema_version',
  USER_PROFILE: '@bloom_user_profile',
  CHECKINS: '@bloom_checkins',
  PERIODS: '@bloom_periods',
  MEALS: '@bloom_meals',
  MOVEMENTS: '@bloom_movements',
  MEDICATIONS: '@bloom_medications',
  DAILY_PLANS: '@bloom_daily_plans',
  MEG_CONVERSATIONS: '@bloom_meg_conversations',
  STRENGTH_OUTBOX: '@bloom_strength_outbox_v1',
  DOCTOR_REPORT_SETTINGS: '@bloom_doctor_report_settings',
  SETTINGS: '@bloom_settings',
  AFFIRMATIONS: '@bloom_affirmations',
  BOOKMARKS: '@bloom_bookmarks',
  APP_LOCK_ENABLED: '@bloom_app_lock_enabled',
  APP_LOCK_TYPE: '@bloom_app_lock_type',
  APP_LOCK_PIN: '@bloom_app_lock_pin',
  APP_LOCK_TIMEOUT: '@bloom_app_lock_timeout',
  HIDE_PREVIEW: '@bloom_hide_preview',
  LAST_ACTIVE: '@bloom_last_active',
  NOTIFICATIONS: '@bloom_notifications',
  STATS: '@bloom_stats',
};

const EXPORTABLE_KEYS = [
  'USER_PROFILE',
  'CHECKINS',
  'PERIODS',
  'MEALS',
  'MOVEMENTS',
  'MEDICATIONS',
  'DAILY_PLANS',
  'DOCTOR_REPORT_SETTINGS',
  'SETTINGS',
  'AFFIRMATIONS',
  'BOOKMARKS',
  'STATS',
];

const INVALID_JSON = Symbol('invalid-json');

export async function safeGetItem(key, storageBackend = AsyncStorage) {
  try {
    return await storageBackend.getItem(key);
  } catch {
    return null;
  }
}

export async function safeSetItem(key, value, storageBackend = AsyncStorage) {
  try {
    await storageBackend.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}

export async function safeRemoveItem(key, storageBackend = AsyncStorage) {
  try {
    await storageBackend.removeItem(key);
    return true;
  } catch {
    return false;
  }
}

export function safeParseJson(value, fallback = null) {
  if (typeof value !== 'string') return fallback;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

export function safeStringifyJson(value, fallback = null) {
  try {
    const serialized = JSON.stringify(value);
    return typeof serialized === 'string' ? serialized : fallback;
  } catch {
    return fallback;
  }
}

class StorageService {
  constructor() {
    this.userScope = null;
  }

  setUserScope(uid) {
    const normalizedUid = String(uid || '').trim();
    if (!normalizedUid) {
      throw new Error('Bloom device storage requires a signed-in account.');
    }
    this.userScope = encodeURIComponent(normalizedUid);
  }

  clearUserScope(uid) {
    const normalizedUid = encodeURIComponent(String(uid || '').trim());
    if (!normalizedUid || this.userScope === normalizedUid) this.userScope = null;
  }

  scopedKey(key, userScope = this.userScope) {
    if (!userScope) {
      throw new Error('Bloom device storage requires a signed-in account.');
    }
    return `@bloom_user:v${STORAGE_KEY_VERSION}:${userScope}:${String(key).replace(/^@/, '')}`;
  }

  legacyScopedKey(key, userScope = this.userScope) {
    if (!userScope) {
      throw new Error('Bloom device storage requires a signed-in account.');
    }
    return `@bloom_user:${userScope}:${String(key).replace(/^@/, '')}`;
  }

  secureScopedKey(key, userScope = this.userScope) {
    if (!userScope) {
      throw new Error('Bloom device storage requires a signed-in account.');
    }
    const safeScope = String(userScope).replace(/[^A-Za-z0-9._-]/g, '_');
    const safeKey = String(key).replace(/[^A-Za-z0-9._-]/g, '_');
    return `bloom.v${STORAGE_KEY_VERSION}.${safeScope}.${safeKey}`;
  }

  async readParsedItem(storageKey) {
    const serialized = await safeGetItem(storageKey);
    if (serialized === null) return { found: false, value: null };

    const value = safeParseJson(serialized, INVALID_JSON);
    if (value !== INVALID_JSON) return { found: true, value };

    await safeRemoveItem(storageKey);
    return { found: false, value: null };
  }

  async getItem(key, userScope = this.userScope) {
    try {
      const storageKey = this.scopedKey(key, userScope);
      const current = await this.readParsedItem(storageKey);
      if (current.found) return current.value;

      const legacyKey = this.legacyScopedKey(key, userScope);
      const legacy = await this.readParsedItem(legacyKey);
      if (!legacy.found) return null;

      const serialized = safeStringifyJson(legacy.value);
      if (serialized !== null && await safeSetItem(storageKey, serialized)) {
        await safeRemoveItem(legacyKey);
      }
      return legacy.value;
    } catch (error) {
      console.error(`Error reading ${key}:`, error);
      return null;
    }
  }

  async setItem(key, value, userScope = this.userScope) {
    try {
      const serialized = safeStringifyJson(value);
      if (serialized === null) throw new Error('Value could not be serialized.');
      const saved = await safeSetItem(this.scopedKey(key, userScope), serialized);
      if (!saved) throw new Error('AsyncStorage write failed.');
      return true;
    } catch (error) {
      console.error(`Error writing ${key}:`, error);
      throw new Error('Bloom could not save on this device. Please try again.');
    }
  }

  async removeItem(key, userScope = this.userScope) {
    try {
      const removed = await safeRemoveItem(this.scopedKey(key, userScope));
      const removedLegacy = await safeRemoveItem(this.legacyScopedKey(key, userScope));
      if (!removed || !removedLegacy) throw new Error('AsyncStorage remove failed.');
      return true;
    } catch (error) {
      console.error(`Error removing ${key}:`, error);
      throw new Error('Bloom could not remove this item. Please try again.');
    }
  }

  async upsertCollection(key, item, matcher) {
    const userScope = this.userScope;
    const storedItems = await this.getItem(key, userScope);
    const items = Array.isArray(storedItems) ? storedItems : [];
    const existingIndex = items.findIndex(matcher);
    const nextItems = [...items];
    if (existingIndex >= 0) nextItems[existingIndex] = { ...items[existingIndex], ...item };
    else nextItems.push(item);
    await this.setItem(key, nextItems, userScope);
    return nextItems;
  }

  async removeFromCollection(key, matcher) {
    const userScope = this.userScope;
    const storedItems = await this.getItem(key, userScope);
    const items = Array.isArray(storedItems) ? storedItems : [];
    const nextItems = items.filter((item) => !matcher(item));
    await this.setItem(key, nextItems, userScope);
    return nextItems;
  }

  // Schema
  getSchemaVersion() { return this.getItem(KEYS.SCHEMA_VERSION); }
  setSchemaVersion(version) { return this.setItem(KEYS.SCHEMA_VERSION, version); }

  // Profile
  getProfile() { return this.getItem(KEYS.USER_PROFILE); }
  setProfile(profile) { return this.setItem(KEYS.USER_PROFILE, profile); }

  // Check-ins
  getCheckins() { return this.getItem(KEYS.CHECKINS); }
  async addCheckin(checkin) {
    return this.upsertCollection(KEYS.CHECKINS, checkin, (item) => item.date === checkin.date);
  }
  deleteCheckin(date) {
    return this.removeFromCollection(KEYS.CHECKINS, (item) => item.date === date);
  }

  // Periods
  getPeriods() { return this.getItem(KEYS.PERIODS); }
  async addPeriod(period) {
    return this.upsertCollection(
      KEYS.PERIODS,
      period,
      (item) => (period.id && item.id === period.id) || item.startDate === period.startDate
    );
  }
  deletePeriod(idOrStartDate) {
    return this.removeFromCollection(
      KEYS.PERIODS,
      (item) => item.id === idOrStartDate || item.startDate === idOrStartDate
    );
  }

  // Meals
  getMeals() { return this.getItem(KEYS.MEALS); }
  saveMeal(meal) {
    return this.upsertCollection(KEYS.MEALS, meal, (item) => item.id === meal.id);
  }
  deleteMeal(id) { return this.removeFromCollection(KEYS.MEALS, (item) => item.id === id); }

  // Meg local queue (the backend remains the account source of truth)
  getMegConversations() { return this.getItem(KEYS.MEG_CONVERSATIONS); }
  setMegConversations(conversations) {
    return this.setItem(KEYS.MEG_CONVERSATIONS, conversations);
  }

  getStrengthOutbox() { return this.getItem(KEYS.STRENGTH_OUTBOX); }
  setStrengthOutbox(items) { return this.setItem(KEYS.STRENGTH_OUTBOX, items); }

  // Movement
  getMovements() { return this.getItem(KEYS.MOVEMENTS); }
  saveMovement(movement) {
    return this.upsertCollection(KEYS.MOVEMENTS, movement, (item) => item.id === movement.id);
  }
  deleteMovement(id) {
    return this.removeFromCollection(KEYS.MOVEMENTS, (item) => item.id === id);
  }

  // Medication and supplements
  getMedications() { return this.getItem(KEYS.MEDICATIONS); }
  saveMedication(entry) {
    return this.upsertCollection(KEYS.MEDICATIONS, entry, (item) => item.id === entry.id);
  }
  deleteMedication(id) {
    return this.removeFromCollection(KEYS.MEDICATIONS, (item) => item.id === id);
  }

  // Daily plans
  getDailyPlans() { return this.getItem(KEYS.DAILY_PLANS); }
  saveDailyPlan(plan) {
    return this.upsertCollection(KEYS.DAILY_PLANS, plan, (item) => item.date === plan.date);
  }

  // Doctor report preferences
  getDoctorReportSettings() { return this.getItem(KEYS.DOCTOR_REPORT_SETTINGS); }
  setDoctorReportSettings(settings) {
    return this.setItem(KEYS.DOCTOR_REPORT_SETTINGS, settings);
  }

  // Settings
  getSettings() { return this.getItem(KEYS.SETTINGS); }
  setSettings(settings) { return this.setItem(KEYS.SETTINGS, settings); }

  // Bookmarks
  getBookmarks() { return this.getItem(KEYS.BOOKMARKS); }
  async toggleBookmark(articleId) {
    const userScope = this.userScope;
    const storedBookmarks = await this.getItem(KEYS.BOOKMARKS, userScope);
    const bookmarks = Array.isArray(storedBookmarks) ? [...storedBookmarks] : [];
    const index = bookmarks.indexOf(articleId);
    if (index >= 0) {
      bookmarks.splice(index, 1);
    } else {
      bookmarks.push(articleId);
    }
    await this.setItem(KEYS.BOOKMARKS, bookmarks, userScope);
    return bookmarks;
  }

  // App Lock
  getAppLockEnabled() { return this.getItem(KEYS.APP_LOCK_ENABLED); }
  setAppLockEnabled(value) { return this.setItem(KEYS.APP_LOCK_ENABLED, value); }
  getAppLockType() { return this.getItem(KEYS.APP_LOCK_TYPE); }
  setAppLockType(type) { return this.setItem(KEYS.APP_LOCK_TYPE, type); }
  async getAppLockPin() {
    if (Platform.OS === 'web') return this.getItem(KEYS.APP_LOCK_PIN);

    try {
      if (!await SecureStore.isAvailableAsync()) return null;
      const userScope = this.userScope;
      const secureKey = this.secureScopedKey(KEYS.APP_LOCK_PIN, userScope);
      const storedPin = await SecureStore.getItemAsync(secureKey);
      if (storedPin !== null) return storedPin;

      // Migrate an existing PIN out of AsyncStorage after the first secure read.
      const legacyPin = await this.getItem(KEYS.APP_LOCK_PIN, userScope);
      if (typeof legacyPin !== 'string' || !legacyPin) return null;
      await SecureStore.setItemAsync(secureKey, legacyPin);
      await this.removeItem(KEYS.APP_LOCK_PIN, userScope);
      return legacyPin;
    } catch (error) {
      console.error('Error reading the protected app-lock PIN:', error);
      return null;
    }
  }

  async setAppLockPin(pin) {
    if (Platform.OS === 'web') {
      return pin ? this.setItem(KEYS.APP_LOCK_PIN, pin) : this.removeItem(KEYS.APP_LOCK_PIN);
    }

    try {
      if (!await SecureStore.isAvailableAsync()) {
        throw new Error('Protected storage is unavailable.');
      }
      const userScope = this.userScope;
      const secureKey = this.secureScopedKey(KEYS.APP_LOCK_PIN, userScope);
      if (pin) await SecureStore.setItemAsync(secureKey, String(pin));
      else await SecureStore.deleteItemAsync(secureKey);

      // Never leave a migrated or previous copy of the PIN in AsyncStorage.
      await this.removeItem(KEYS.APP_LOCK_PIN, userScope);
      return true;
    } catch (error) {
      console.error('Error writing the protected app-lock PIN:', error);
      throw new Error('Bloom could not protect your app-lock PIN on this device. Please try again.');
    }
  }
  getAppLockTimeout() { return this.getItem(KEYS.APP_LOCK_TIMEOUT); }
  setAppLockTimeout(timeout) { return this.setItem(KEYS.APP_LOCK_TIMEOUT, timeout); }

  // Privacy
  getHidePreview() { return this.getItem(KEYS.HIDE_PREVIEW); }
  setHidePreview(value) { return this.setItem(KEYS.HIDE_PREVIEW, value); }

  // Stats
  getStats() { return this.getItem(KEYS.STATS); }
  async updateStats(updates) {
    const userScope = this.userScope;
    const storedStats = await this.getItem(KEYS.STATS, userScope);
    const stats = storedStats && typeof storedStats === 'object' && !Array.isArray(storedStats)
      ? storedStats
      : {};
    const newStats = { ...stats, ...updates };
    await this.setItem(KEYS.STATS, newStats, userScope);
    return newStats;
  }

  // Export all data
  async exportAllData() {
    const userScope = this.userScope;
    const data = {};
    for (const name of EXPORTABLE_KEYS) {
      data[name] = await this.getItem(KEYS[name], userScope);
    }
    return data;
  }

  // Delete all data
  async deleteAllData() {
    const userScope = this.userScope;
    const keys = Object.values(KEYS).flatMap((key) => [
      this.scopedKey(key, userScope),
      this.legacyScopedKey(key, userScope),
    ]);
    try {
      if (Platform.OS !== 'web' && await SecureStore.isAvailableAsync()) {
        await SecureStore.deleteItemAsync(this.secureScopedKey(KEYS.APP_LOCK_PIN, userScope));
      }
      const results = await Promise.all(keys.map((key) => safeRemoveItem(key)));
      if (results.some((removed) => !removed)) throw new Error('AsyncStorage remove failed.');
      return true;
    } catch (error) {
      console.error('Error deleting all data:', error);
      throw new Error('Bloom could not remove this account\'s device data. Please try again.');
    }
  }
}

export const storage = new StorageService();
export { KEYS };
