import AsyncStorage from '@react-native-async-storage/async-storage';

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
    if (!uid || this.userScope === normalizedUid) this.userScope = null;
  }

  scopedKey(key, userScope = this.userScope) {
    if (!userScope) {
      throw new Error('Bloom device storage requires a signed-in account.');
    }
    return `@bloom_user:${userScope}:${String(key).replace(/^@/, '')}`;
  }

  async getItem(key, userScope = this.userScope) {
    try {
      const value = await AsyncStorage.getItem(this.scopedKey(key, userScope));
      return value ? JSON.parse(value) : null;
    } catch (error) {
      console.error(`Error reading ${key}:`, error);
      return null;
    }
  }

  async setItem(key, value, userScope = this.userScope) {
    try {
      await AsyncStorage.setItem(this.scopedKey(key, userScope), JSON.stringify(value));
      return true;
    } catch (error) {
      console.error(`Error writing ${key}:`, error);
      throw new Error('Bloom could not save on this device. Please try again.');
    }
  }

  async removeItem(key, userScope = this.userScope) {
    try {
      await AsyncStorage.removeItem(this.scopedKey(key, userScope));
      return true;
    } catch (error) {
      console.error(`Error removing ${key}:`, error);
      throw new Error('Bloom could not remove this item. Please try again.');
    }
  }

  async upsertCollection(key, item, matcher) {
    const userScope = this.userScope;
    const items = await this.getItem(key, userScope) || [];
    const existingIndex = items.findIndex(matcher);
    const nextItems = [...items];
    if (existingIndex >= 0) nextItems[existingIndex] = { ...items[existingIndex], ...item };
    else nextItems.push(item);
    await this.setItem(key, nextItems, userScope);
    return nextItems;
  }

  async removeFromCollection(key, matcher) {
    const userScope = this.userScope;
    const items = await this.getItem(key, userScope) || [];
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
    const bookmarks = await this.getItem(KEYS.BOOKMARKS, userScope) || [];
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
  getAppLockPin() { return this.getItem(KEYS.APP_LOCK_PIN); }
  setAppLockPin(pin) { return this.setItem(KEYS.APP_LOCK_PIN, pin); }
  getAppLockTimeout() { return this.getItem(KEYS.APP_LOCK_TIMEOUT); }
  setAppLockTimeout(timeout) { return this.setItem(KEYS.APP_LOCK_TIMEOUT, timeout); }

  // Privacy
  getHidePreview() { return this.getItem(KEYS.HIDE_PREVIEW); }
  setHidePreview(value) { return this.setItem(KEYS.HIDE_PREVIEW, value); }

  // Stats
  getStats() { return this.getItem(KEYS.STATS); }
  async updateStats(updates) {
    const userScope = this.userScope;
    const stats = await this.getItem(KEYS.STATS, userScope) || {};
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
    const keys = Object.values(KEYS).map((key) => this.scopedKey(key, userScope));
    try {
      await AsyncStorage.multiRemove(keys);
      return true;
    } catch (error) {
      console.error('Error deleting all data:', error);
      throw new Error('Bloom could not remove this account\'s device data. Please try again.');
    }
  }
}

export const storage = new StorageService();
export { KEYS };
