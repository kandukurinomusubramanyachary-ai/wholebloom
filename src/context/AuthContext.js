import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  createUserWithEmailAndPassword,
  deleteUser,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
} from 'firebase/auth';
import { doc, serverTimestamp, setDoc } from 'firebase/firestore';
import {
  auth,
  db,
  firebaseConfigurationError,
  firebaseInitializationError,
  initializeFirebaseServices,
} from '../services/firebase';
import { setStartupStage } from '../diagnostics/startupDiagnostics';
import { stripUndefined } from '../services/userData';

export const REQUIRED_DATA_CONSENT =
  'I agree that Bloom may securely store my cycle, symptom, check-in and Meg conversation data to personalise my experience.';

export const OPTIONAL_MODEL_CONSENT =
  'I agree that my anonymised conversations and feedback may be reviewed to improve Meg.';

const AuthContext = createContext(null);

export class BloomAuthError extends Error {
  constructor(message, field = 'form') {
    super(message);
    this.name = 'BloomAuthError';
    this.field = field;
  }
}

export function normalizeAuthEmail(value) {
  return String(value || '').trim().toLowerCase();
}

export function isValidAuthEmail(value) {
  const email = normalizeAuthEmail(value);
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && email.length <= 254;
}

function friendlyAuthError(error) {
  switch (error?.code) {
    case 'auth/invalid-email':
      return new BloomAuthError('Enter a valid email address.', 'email');
    case 'auth/email-already-in-use':
      return new BloomAuthError(
        'An account already exists for this email. Choose Log in instead.',
        'email'
      );
    case 'auth/weak-password':
      return new BloomAuthError('Use a password with at least 8 characters.', 'password');
    case 'auth/invalid-credential':
    case 'auth/user-not-found':
    case 'auth/wrong-password':
      return new BloomAuthError('That email or password is not correct. Please try again.');
    case 'auth/network-request-failed':
      return new BloomAuthError('Bloom could not connect. Check your internet and try again.');
    case 'auth/too-many-requests':
      return new BloomAuthError('Too many attempts were made. Wait a little, then try again.');
    default:
      return new BloomAuthError('Bloom could not complete sign-in. Please try again.');
  }
}

async function createProfileWithRetry(user, profile) {
  let latestError;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      await setDoc(doc(db, 'users', user.uid), stripUndefined(profile));
      return;
    } catch (error) {
      latestError = error;
    }
  }
  throw latestError;
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [initializing, setInitializing] = useState(true);
  const [startupFailure, setStartupFailure] = useState(null);
  const [retryToken, setRetryToken] = useState(0);
  const provisioningRef = useRef(false);

  useEffect(() => {
    setInitializing(true);
    setStartupFailure(null);

    const services = initializeFirebaseServices();
    if (services.failure || !services.auth) {
      setUser(null);
      setStartupFailure(services.failure);
      setInitializing(false);
      return undefined;
    }

    setStartupStage('auth-resolving');
    return onAuthStateChanged(
      services.auth,
      (nextUser) => {
        if (!provisioningRef.current) setUser(nextUser);
        setInitializing(false);
      },
      () => {
        setUser(null);
        setInitializing(false);
      }
    );
  }, [retryToken]);

  const retryStartup = useCallback(() => {
    setRetryToken((value) => value + 1);
  }, []);

  const signUp = useCallback(async ({
    firstName,
    email,
    password,
    consent,
    modelImprovementConsent = false,
  }) => {
    if (firebaseConfigurationError || firebaseInitializationError || !auth || !db) {
      throw new BloomAuthError(
        firebaseConfigurationError
        || firebaseInitializationError
        || 'Bloom sign-in is unavailable on this build.'
      );
    }

    const cleanFirstName = String(firstName || '').trim();
    const normalizedEmail = normalizeAuthEmail(email);
    if (!cleanFirstName) throw new BloomAuthError('Enter your first name.', 'firstName');
    if (!isValidAuthEmail(normalizedEmail)) {
      throw new BloomAuthError('Enter a valid email address.', 'email');
    }
    if (String(password || '').length < 8) {
      throw new BloomAuthError('Use a password with at least 8 characters.', 'password');
    }
    if (consent !== true) {
      throw new BloomAuthError('You need to agree before creating your Bloom account.', 'consent');
    }

    provisioningRef.current = true;
    let credential;
    try {
      credential = await createUserWithEmailAndPassword(auth, normalizedEmail, password);
      const timestamp = serverTimestamp();
      const profile = {
        firstName: cleanFirstName,
        email: normalizedEmail,
        consent: true,
        modelImprovementConsent: Boolean(modelImprovementConsent),
        onboardingCompleted: false,
        createdAt: timestamp,
        updatedAt: timestamp,
        lastActiveAt: timestamp,
      };

      try {
        await createProfileWithRetry(credential.user, profile);
      } catch (profileError) {
        try {
          await deleteUser(credential.user);
          setUser(null);
          throw new BloomAuthError(
            'Bloom could not finish creating your account. Nothing was saved, so please try again.'
          );
        } catch (cleanupError) {
          if (cleanupError instanceof BloomAuthError) throw cleanupError;
          await signOut(auth).catch(() => {});
          setUser(null);
          throw new BloomAuthError(
            'Bloom could not finish setting up this account. Try logging in with the same email, or contact Bloom support if that does not work.'
          );
        }
      }

      setUser(credential.user);
      return credential.user;
    } catch (error) {
      if (error instanceof BloomAuthError) throw error;
      throw friendlyAuthError(error);
    } finally {
      provisioningRef.current = false;
    }
  }, []);

  const logIn = useCallback(async ({ email, password }) => {
    if (firebaseConfigurationError || firebaseInitializationError || !auth || !db) {
      throw new BloomAuthError(
        firebaseConfigurationError
        || firebaseInitializationError
        || 'Bloom sign-in is unavailable on this build.'
      );
    }

    const normalizedEmail = normalizeAuthEmail(email);
    if (!isValidAuthEmail(normalizedEmail)) {
      throw new BloomAuthError('Enter a valid email address.', 'email');
    }
    if (!password) throw new BloomAuthError('Enter your password.', 'password');

    try {
      const credential = await signInWithEmailAndPassword(auth, normalizedEmail, password);
      setUser(credential.user);
      setDoc(
        doc(db, 'users', credential.user.uid),
        {
          lastActiveAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      ).catch(() => {});
      return credential.user;
    } catch (error) {
      throw friendlyAuthError(error);
    }
  }, []);

  const logOut = useCallback(async () => {
    if (!auth) {
      setUser(null);
      return;
    }
    try {
      await signOut(auth);
      setUser(null);
    } catch (error) {
      throw friendlyAuthError(error);
    }
  }, []);

  const value = useMemo(() => ({
    user,
    initializing,
    configurationError: firebaseConfigurationError || firebaseInitializationError,
    startupFailure,
    retryStartup,
    signUp,
    logIn,
    logOut,
  }), [
    initializing,
    logIn,
    logOut,
    retryStartup,
    signUp,
    startupFailure,
    user,
  ]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
}
