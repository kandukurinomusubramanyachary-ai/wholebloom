import React, { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import BrandMark from '../components/BrandMark';
import Button from '../components/Button';
import { Entrance } from '../components/Motion';
import {
  OPTIONAL_MODEL_CONSENT,
  REQUIRED_DATA_CONSENT,
  isValidAuthEmail,
  normalizeAuthEmail,
  useAuth,
} from '../context/AuthContext';
import { COLORS, createThemedStyles, LAYOUT, WEB_FOCUS } from '../utils/constants';

function AuthField({
  label,
  value,
  onChangeText,
  error,
  focused,
  onFocus,
  onBlur,
  ...inputProps
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        {...inputProps}
        value={value}
        onChangeText={onChangeText}
        onFocus={onFocus}
        onBlur={onBlur}
        accessibilityLabel={label}
        accessibilityState={{ invalid: Boolean(error) }}
        style={[
          styles.input,
          focused && styles.inputFocused,
          error && styles.inputError,
        ]}
      />
      {error ? (
        <Text style={styles.fieldError} accessibilityRole='alert'>
          {error}
        </Text>
      ) : null}
    </View>
  );
}

function ConsentCheckbox({ checked, onPress, label, error, optional = false, disabled = false }) {
  return (
    <View>
      <Pressable
        onPress={onPress}
        disabled={disabled}
        accessibilityRole='checkbox'
        accessibilityState={{ checked, disabled }}
        accessibilityLabel={label}
        style={({ pressed, hovered, focused }) => [
          styles.consentRow,
          hovered && !disabled && styles.consentHovered,
          focused && styles.controlFocused,
          pressed && !disabled && styles.pressed,
          disabled && styles.disabled,
          error && styles.consentError,
        ]}
      >
        <View style={[styles.checkbox, checked && styles.checkboxChecked]}>
          {checked ? <Ionicons name='checkmark' size={15} color={COLORS.onBrand} /> : null}
        </View>
        <View style={styles.consentCopy}>
          {optional ? <Text style={styles.optionalLabel}>Optional</Text> : null}
          <Text style={styles.consentText}>{label}</Text>
        </View>
      </Pressable>
      {error ? (
        <Text style={styles.fieldError} accessibilityRole='alert'>
          {error}
        </Text>
      ) : null}
    </View>
  );
}

export default function AuthScreen() {
  const { configurationError, logIn, signUp } = useAuth();
  const [mode, setMode] = useState('signup');
  const [firstName, setFirstName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [consent, setConsent] = useState(false);
  const [modelImprovementConsent, setModelImprovementConsent] = useState(false);
  const [focusedField, setFocusedField] = useState(null);
  const [errors, setErrors] = useState({});
  const [pending, setPending] = useState(false);

  function changeMode(nextMode) {
    if (pending || nextMode === mode) return;
    setMode(nextMode);
    setPassword('');
    setErrors({});
  }

  function updateField(setter, field) {
    return (value) => {
      setter(value);
      setErrors((current) => ({ ...current, [field]: '', form: '' }));
    };
  }

  function validate() {
    const nextErrors = {};
    if (mode === 'signup' && !firstName.trim()) {
      nextErrors.firstName = 'Enter your first name.';
    }
    if (!isValidAuthEmail(email)) nextErrors.email = 'Enter a valid email address.';
    if (!password) {
      nextErrors.password = 'Enter your password.';
    } else if (mode === 'signup' && password.length < 8) {
      nextErrors.password = 'Use a password with at least 8 characters.';
    }
    if (mode === 'signup' && !consent) {
      nextErrors.consent = 'You need to agree before creating your Bloom account.';
    }
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  }

  async function handleSubmit() {
    if (pending || configurationError || !validate()) return;
    setPending(true);
    setErrors({});

    try {
      if (mode === 'signup') {
        await signUp({
          firstName,
          email,
          password,
          consent,
          modelImprovementConsent,
        });
      } else {
        await logIn({ email, password });
      }
    } catch (error) {
      const field = error?.field || 'form';
      setErrors({ [field]: error?.message || 'Bloom could not continue. Please try again.' });
    } finally {
      setPending(false);
    }
  }

  const isSignup = mode === 'signup';

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps='handled'
          keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
          automaticallyAdjustKeyboardInsets
          showsVerticalScrollIndicator={Platform.OS === 'web'}
        >
          <Entrance style={styles.shell} distance={8} duration={230}>
            <BrandMark size='large' layout='stacked' style={styles.brand} />

            <View style={styles.heading}>
              <Text style={styles.title}>{isSignup ? 'Create your Bloom account' : 'Welcome back'}</Text>
              <Text style={styles.subtitle}>
                {isSignup
                  ? 'Keep your cycle and check-in records available when you sign in.'
                  : 'Log in to return to your private Bloom space.'}
              </Text>
            </View>

            <View style={styles.modeSwitch} accessibilityRole='tablist'>
              {[
                { id: 'signup', label: 'Sign up' },
                { id: 'login', label: 'Log in' },
              ].map((item) => {
                const selected = mode === item.id;
                return (
                  <Pressable
                    key={item.id}
                    onPress={() => changeMode(item.id)}
                    disabled={pending}
                    accessibilityRole='tab'
                    accessibilityState={{ selected, disabled: pending }}
                    style={({ pressed, focused }) => [
                      styles.modeButton,
                      selected && styles.modeButtonSelected,
                      focused && styles.controlFocused,
                      pressed && !pending && styles.pressed,
                    ]}
                  >
                    <Text style={[styles.modeLabel, selected && styles.modeLabelSelected]}>
                      {item.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <View style={styles.form}>
              {isSignup ? (
                <AuthField
                  label='First name'
                  value={firstName}
                  onChangeText={updateField(setFirstName, 'firstName')}
                  error={errors.firstName}
                  focused={focusedField === 'firstName'}
                  onFocus={() => setFocusedField('firstName')}
                  onBlur={() => setFocusedField(null)}
                  autoCapitalize='words'
                  autoCorrect={false}
                  autoComplete='name-given'
                  textContentType='givenName'
                  returnKeyType='next'
                  maxLength={80}
                  editable={!pending}
                />
              ) : null}

              <AuthField
                label='Email address'
                value={email}
                onChangeText={updateField(setEmail, 'email')}
                error={errors.email}
                focused={focusedField === 'email'}
                onFocus={() => setFocusedField('email')}
                onBlur={() => {
                  setFocusedField(null);
                  setEmail((value) => normalizeAuthEmail(value));
                }}
                autoCapitalize='none'
                autoCorrect={false}
                spellCheck={false}
                autoComplete='email'
                textContentType='emailAddress'
                keyboardType='email-address'
                inputMode='email'
                returnKeyType='next'
                editable={!pending}
              />

              <AuthField
                label='Password'
                value={password}
                onChangeText={updateField(setPassword, 'password')}
                error={errors.password}
                focused={focusedField === 'password'}
                onFocus={() => setFocusedField('password')}
                onBlur={() => setFocusedField(null)}
                secureTextEntry
                autoCapitalize='none'
                autoCorrect={false}
                autoComplete={isSignup ? 'new-password' : 'current-password'}
                textContentType={isSignup ? 'newPassword' : 'password'}
                returnKeyType='done'
                onSubmitEditing={handleSubmit}
                editable={!pending}
              />
              {isSignup ? (
                <Text style={styles.passwordHint}>Use at least 8 characters.</Text>
              ) : null}

              {isSignup ? (
                <View style={styles.consents}>
                  <ConsentCheckbox
                    checked={consent}
                    onPress={() => {
                      setConsent((value) => !value);
                      setErrors((current) => ({ ...current, consent: '', form: '' }));
                    }}
                    label={REQUIRED_DATA_CONSENT}
                    error={errors.consent}
                    disabled={pending}
                  />
                  <ConsentCheckbox
                    checked={modelImprovementConsent}
                    onPress={() => setModelImprovementConsent((value) => !value)}
                    label={OPTIONAL_MODEL_CONSENT}
                    optional
                    disabled={pending}
                  />
                </View>
              ) : null}

              {configurationError || errors.form ? (
                <View
                  style={styles.formError}
                  accessibilityRole='alert'
                  accessibilityLiveRegion='assertive'
                >
                  <Ionicons name='alert-circle-outline' size={19} color={COLORS.error} />
                  <Text style={styles.formErrorText}>{configurationError || errors.form}</Text>
                </View>
              ) : null}

              <Button
                title={isSignup ? 'Create account' : 'Log in'}
                onPress={handleSubmit}
                loading={pending}
                loadingLabel={isSignup ? 'Creating account…' : 'Logging in…'}
                disabled={Boolean(configurationError)}
              />
            </View>

            <View style={styles.privacyNote}>
              <Ionicons name='lock-closed-outline' size={16} color={COLORS.sage} />
              <Text style={styles.privacyText}>
                Your password is handled by secure sign-in and is never stored in your Bloom records.
              </Text>
            </View>
          </Entrance>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = createThemedStyles({
  safeArea: {
    flex: 1,
    minHeight: 0,
    backgroundColor: COLORS.splash,
    ...Platform.select({
      web: {
        height: '100vh',
        maxHeight: '100vh',
        overflow: 'hidden',
      },
      default: {},
    }),
  },
  keyboardView: { flex: 1 },
  scroll: {
    flex: 1,
    minHeight: 0,
    ...Platform.select({
      web: {
        height: '100%',
        overflowY: 'auto',
        overscrollBehavior: 'contain',
      },
      default: {},
    }),
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: LAYOUT.screenPadding,
    paddingVertical: 32,
  },
  shell: {
    width: '100%',
    maxWidth: LAYOUT.phoneMaxWidth,
    alignSelf: 'center',
  },
  brand: { alignSelf: 'center', marginBottom: 30 },
  heading: { alignItems: 'center', marginBottom: 22 },
  title: {
    fontSize: 28,
    lineHeight: 34,
    fontWeight: '700',
    letterSpacing: -0.4,
    textAlign: 'center',
    color: COLORS.ink,
  },
  subtitle: {
    maxWidth: 390,
    marginTop: 7,
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
    color: COLORS.body,
  },
  modeSwitch: {
    flexDirection: 'row',
    padding: 4,
    marginBottom: 14,
    borderRadius: LAYOUT.controlRadius,
    backgroundColor: COLORS.surfaceSoft,
  },
  modeButton: {
    flex: 1,
    minHeight: LAYOUT.touchTarget,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 9,
  },
  modeButtonSelected: {
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.hairline,
  },
  modeLabel: { fontSize: 15, lineHeight: 20, fontWeight: '600', color: COLORS.muted },
  modeLabelSelected: { color: COLORS.ink },
  form: {
    gap: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: COLORS.hairline,
    borderRadius: LAYOUT.cardRadius,
    backgroundColor: COLORS.white,
  },
  field: { gap: 7 },
  label: { fontSize: 14, lineHeight: 20, fontWeight: '600', color: COLORS.ink },
  input: {
    minHeight: 56,
    paddingHorizontal: 15,
    borderWidth: 1,
    borderColor: COLORS.hairline,
    borderRadius: LAYOUT.controlRadius,
    backgroundColor: COLORS.white,
    fontSize: 16,
    lineHeight: 21,
    color: COLORS.ink,
    ...Platform.select({
      web: { outlineStyle: 'none' },
      default: {},
    }),
  },
  inputFocused: {
    borderColor: COLORS.brand,
    ...Platform.select({
      web: WEB_FOCUS,
      default: {},
    }),
  },
  inputError: { borderColor: COLORS.error },
  fieldError: { fontSize: 13, lineHeight: 18, color: COLORS.error },
  passwordHint: { marginTop: -10, fontSize: 13, lineHeight: 18, color: COLORS.muted },
  consents: { gap: 10 },
  consentRow: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    padding: 12,
    borderRadius: LAYOUT.controlRadius,
    borderWidth: 1,
    borderColor: COLORS.hairline,
    backgroundColor: COLORS.white,
  },
  consentHovered: { backgroundColor: COLORS.surfaceSoft },
  consentError: { borderColor: COLORS.error },
  checkbox: {
    width: 22,
    height: 22,
    flexShrink: 0,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: COLORS.borderStrong,
    backgroundColor: COLORS.white,
  },
  checkboxChecked: { borderColor: COLORS.brand, backgroundColor: COLORS.brand },
  consentCopy: { flex: 1 },
  optionalLabel: {
    marginBottom: 2,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '600',
    color: COLORS.sage,
  },
  consentText: { fontSize: 13, lineHeight: 19, color: COLORS.body },
  formError: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 9,
    padding: 12,
    borderRadius: LAYOUT.controlRadius,
    backgroundColor: '#FFF7F6',
  },
  formErrorText: { flex: 1, fontSize: 13, lineHeight: 19, color: COLORS.error },
  privacyNote: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginTop: 16,
    paddingHorizontal: 8,
  },
  privacyText: { flex: 1, fontSize: 12, lineHeight: 18, color: COLORS.muted },
  controlFocused: Platform.select({
    web: WEB_FOCUS,
    default: {},
  }),
  pressed: { opacity: 0.72 },
  disabled: { opacity: 0.6 },
});
