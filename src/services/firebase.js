import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getApp, getApps, initializeApp } from 'firebase/app';
import * as FirebaseAuth from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import {
  getStartupStage,
  recordStartupFailure,
  setStartupStage,
} from '../diagnostics/startupDiagnostics';

const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
};

const requiredConfigKeys = [
  'apiKey',
  'authDomain',
  'projectId',
  'storageBucket',
  'messagingSenderId',
  'appId',
];

const missingConfigKeys = requiredConfigKeys.filter((key) => !firebaseConfig[key]);

export const firebaseConfigurationError = missingConfigKeys.length
  ? 'Firebase configuration is missing from this build.'
  : null;

export let firebaseApp = null;
export let auth = null;
export let db = null;
export let firebaseInitializationError = null;

let initializationAttempted = false;

function initialiseAuth(app) {
  setStartupStage('firebase-auth');
  const persistence = Platform.OS === 'web'
    ? FirebaseAuth.browserLocalPersistence
    : (() => {
      if (typeof FirebaseAuth.getReactNativePersistence !== 'function') {
        throw new Error('Firebase Auth persistence is unavailable in this Android build.');
      }
      return FirebaseAuth.getReactNativePersistence(AsyncStorage);
    })();

  try {
    return FirebaseAuth.initializeAuth(app, { persistence });
  } catch (error) {
    if (error?.code === 'auth/already-initialized') return FirebaseAuth.getAuth(app);
    throw error;
  }
}

export function initializeFirebaseServices() {
  if (initializationAttempted && !firebaseInitializationError && auth && db) {
    return {
      app: firebaseApp,
      auth,
      db,
      failure: null,
    };
  }

  initializationAttempted = true;
  firebaseInitializationError = null;
  setStartupStage('configuration-check');

  if (firebaseConfigurationError) {
    const failure = recordStartupFailure(
      firebaseConfigurationError,
      'configuration-check',
      firebaseConfigurationError
    );
    return {
      app: null,
      auth: null,
      db: null,
      failure,
    };
  }

  setStartupStage('firebase-app');

  try {
    firebaseApp = getApps().length ? getApp() : initializeApp(firebaseConfig);
    auth = initialiseAuth(firebaseApp);
    setStartupStage('firestore');
    db = getFirestore(firebaseApp);
    return {
      app: firebaseApp,
      auth,
      db,
      failure: null,
    };
  } catch (error) {
    auth = null;
    db = null;
    firebaseInitializationError = 'Firebase could not initialise on this build.';
    const failure = recordStartupFailure(
      error,
      getStartupStage(),
      firebaseInitializationError
    );
    return {
      app: firebaseApp,
      auth: null,
      db: null,
      failure,
    };
  }
}
