/**
 * Bloom's persisted domain shapes.
 *
 * The app is currently JavaScript-first, so these JSDoc models provide editor
 * type information without introducing a parallel TypeScript build.
 *
 * @typedef {'cycle' | 'pcos'} TrackingMode
 * @typedef {'light' | 'dark'} ThemePreference
 * @typedef {'none' | 'spotting' | 'light' | 'medium' | 'heavy'} FlowLevel
 *
 * @typedef {Object} UserProfile
 * @property {string=} name
 * @property {number|null=} age
 * @property {string=} language
 * @property {string=} pcosStatus
 * @property {TrackingMode=} trackingMode
 * @property {string[]=} goals
 * @property {string[]=} trackedSymptoms
 * @property {Object|null=} cycleInfo
 *
 * @typedef {Object} DailyCheckIn
 * @property {string} date ISO yyyy-MM-dd date
 * @property {string|null=} mood
 * @property {number|null=} energy
 * @property {number|null=} sleep
 * @property {string|null=} sleepQuality
 * @property {number|null=} pain
 * @property {FlowLevel=} flow
 * @property {string[]=} symptoms
 * @property {Object.<string, 'mild'|'moderate'|'severe'>=} symptomSeverity
 * @property {string|null=} cravings
 * @property {number|null=} water
 * @property {number|null=} stress
 * @property {string|null=} movement
 * @property {boolean=} medicationTaken
 * @property {string|null=} medicationName
 * @property {string=} notes
 *
 * @typedef {Object} PeriodEntry
 * @property {string} id
 * @property {string} startDate
 * @property {string|null} endDate
 * @property {FlowLevel=} flow
 * @property {'manual'|'checkin'=} source
 *
 * @typedef {Object} MealEntry
 * @property {string} id
 * @property {string} date
 * @property {string} name
 * @property {string=} mealType
 * @property {boolean=} protein
 * @property {boolean=} fibre
 * @property {boolean=} produce
 * @property {boolean=} skipped
 * @property {string|null=} fullness
 * @property {string|null=} energyAfter
 * @property {boolean=} favourite
 * @property {string|null=} photoUri
 *
 * @typedef {Object} MovementEntry
 * @property {string} id
 * @property {string} date
 * @property {string} activity
 * @property {'completed'|'partial'|'not_today'} status
 * @property {number|null=} minutes
 *
 * @typedef {Object} DailyPlan
 * @property {string} id
 * @property {string} date
 * @property {{id:string,type:string,title:string,status:string}[]} actions
 * @property {string|null=} careNotice
 * @property {string} updatedAt
 *
 * @typedef {Object} MegConversation
 * @property {string} id
 * @property {string} createdAt
 * @property {string} updatedAt
 * @property {{id:string,role:'user'|'assistant',text:string,createdAt:string,feedback?:string}[]} messages
 */

export const DATA_SCHEMA_VERSION = 2;

export const DEFAULT_TRACKING_PREFERENCES = {
  theme: 'light',
  trackingMode: 'cycle',
  goals: ['track_cycle'],
  symptomsToTrack: [],
  dietaryPreference: 'no_preference',
  movementPreferences: ['walking'],
  language: 'en',
  tone: 'gentle',
  megMemory: false,
  cyclePredictions: true,
};

export function stableId(prefix, value) {
  if (value) return `${prefix}-${String(value).replace(/[^a-zA-Z0-9_-]/g, '-')}`;
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function normalizePeriod(period) {
  if (!period?.startDate) return null;
  return {
    ...period,
    id: period.id || stableId('period', period.startDate),
    endDate: period.endDate || null,
    source: period.source || 'manual',
  };
}

export function normalizeCheckin(checkin) {
  if (!checkin?.date) return null;
  const moodAliases = {
    joyful: 'happy',
    irritable: 'irritated',
    tender: 'emotionally_sensitive',
  };
  return {
    ...checkin,
    id: checkin.id || checkin.date,
    mood: moodAliases[checkin.mood] || checkin.mood || null,
    flow: checkin.flow || 'none',
    symptoms: Array.isArray(checkin.symptoms) ? checkin.symptoms : [],
    notes: checkin.notes || '',
  };
}

export function normalizeCollection(items, normalizer = (item) => item) {
  return (Array.isArray(items) ? items : []).map(normalizer).filter(Boolean);
}
