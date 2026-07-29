import React, { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import BrandMark from '../components/BrandMark';
import Button from '../components/Button';
import { Entrance } from '../components/Motion';
import { checkBetaEmail, isValidBetaEmail, normalizeBetaEmail } from '../services/betaAccess';
import { COLORS, LAYOUT, WEB_FOCUS } from '../utils/constants';

const INVALID_EMAIL_MESSAGE = 'Enter a valid email address.';
const SERVER_ERROR_MESSAGE = 'We could not check Beta access right now. Please try again.';
const NOT_ELIGIBLE_MESSAGE =
  'This email currently doesn’t have Beta access. Please use the email you joined the waitlist with.';

export default function BetaAccessScreen() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [focused, setFocused] = useState(false);
  const [status, setStatus] = useState('idle');
  const [error, setError] = useState('');

  function handleEmailChange(value) {
    setEmail(value);
    setError('');
    setStatus('idle');
  }

  function handleEmailBlur() {
    setFocused(false);
    setEmail((value) => normalizeBetaEmail(value));
  }

  async function handleSubmit() {
    if (loading) return;

    const normalizedEmail = normalizeBetaEmail(email);
    setEmail(normalizedEmail);
    setError('');
    setStatus('idle');

    if (!isValidBetaEmail(normalizedEmail)) {
      setError(INVALID_EMAIL_MESSAGE);
      return;
    }

    setLoading(true);
    try {
      const eligible = await checkBetaEmail(normalizedEmail);
      setStatus(eligible ? 'eligible' : 'ineligible');
    } catch (requestError) {
      setError(
        requestError?.code === 'invalid-email'
          ? INVALID_EMAIL_MESSAGE
          : SERVER_ERROR_MESSAGE
      );
    } finally {
      setLoading(false);
    }
  }

  const invalid = Boolean(error);

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        style={styles.keyboard}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps='handled'
          keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
          automaticallyAdjustKeyboardInsets={Platform.OS === 'ios'}
          showsVerticalScrollIndicator={false}
        >
          <Entrance style={styles.shell} distance={8} duration={230}>
            <BrandMark size='large' layout='stacked' style={styles.brand} />

            <View style={styles.heading}>
              <Text style={styles.eyebrow}>BLOOM BETA</Text>
              <Text style={styles.title}>Check your Beta access</Text>
              <Text style={styles.subtitle}>
                Use the email address you joined the Bloom waitlist with.
              </Text>
            </View>

            <View style={styles.card}>
              <Text style={styles.label}>Email address</Text>
              <TextInput
                value={email}
                onChangeText={handleEmailChange}
                onFocus={() => setFocused(true)}
                onBlur={handleEmailBlur}
                onSubmitEditing={handleSubmit}
                editable={!loading}
                keyboardType='email-address'
                inputMode='email'
                autoCapitalize='none'
                autoCorrect={false}
                spellCheck={false}
                autoComplete='email'
                textContentType='emailAddress'
                returnKeyType='done'
                placeholder='you@example.com'
                placeholderTextColor={COLORS.muted}
                accessibilityLabel='Bloom Beta email address'
                accessibilityHint='Enter the email address used to join the Bloom waitlist'
                accessibilityState={{ disabled: loading }}
                style={[
                  styles.input,
                  focused && styles.inputFocused,
                  invalid && styles.inputInvalid,
                  loading && styles.inputDisabled,
                ]}
              />

              {error ? (
                <View
                  style={styles.errorRow}
                  accessibilityRole='alert'
                  accessibilityLiveRegion='assertive'
                >
                  <Ionicons name='alert-circle-outline' size={18} color={COLORS.error} />
                  <Text style={styles.errorText}>{error}</Text>
                </View>
              ) : null}

              <Button
                title='Check Beta access'
                onPress={handleSubmit}
                loading={loading}
                loadingLabel='Checking…'
                accessibilityHint='Checks this email against the Bloom Beta waitlist'
                style={styles.submitButton}
              />

              {loading ? (
                <Text style={styles.checking} accessibilityLiveRegion='polite'>
                  Checking your Bloom Beta access…
                </Text>
              ) : null}

              {status === 'eligible' ? (
                <View
                  style={[styles.result, styles.eligibleResult]}
                  accessibilityLiveRegion='polite'
                >
                  <View style={[styles.resultIcon, styles.eligibleIcon]}>
                    <Ionicons name='flower-outline' size={22} color={COLORS.sage} />
                  </View>
                  <View style={styles.resultCopy}>
                    <Text style={styles.eligibleTitle}>
                      You’re on the Bloom Beta list 🌷
                    </Text>
                    <Text style={styles.nextStep}>
                      Continue with secure email sign-in
                    </Text>
                    <Text style={styles.resultNote}>
                      No sign-in email has been sent yet.
                    </Text>
                  </View>
                </View>
              ) : null}

              {status === 'ineligible' ? (
                <View
                  style={[styles.result, styles.ineligibleResult]}
                  accessibilityLiveRegion='polite'
                >
                  <View style={[styles.resultIcon, styles.ineligibleIcon]}>
                    <Ionicons name='mail-outline' size={21} color={COLORS.warning} />
                  </View>
                  <Text style={styles.ineligibleText}>{NOT_ELIGIBLE_MESSAGE}</Text>
                </View>
              ) : null}
            </View>

            <View style={styles.privacyNote}>
              <Ionicons name='lock-closed-outline' size={15} color={COLORS.sage} />
              <Text style={styles.privacyText}>
                This only checks Beta eligibility. Your health data is not included.
              </Text>
            </View>
          </Entrance>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.splash,
  },
  keyboard: {
    flex: 1,
  },
  scroll: {
    flex: 1,
  },
  content: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 20,
    paddingVertical: 28,
  },
  shell: {
    width: '100%',
    maxWidth: 420,
    alignSelf: 'center',
  },
  brand: {
    alignSelf: 'center',
    marginBottom: 28,
  },
  heading: {
    alignItems: 'center',
    marginBottom: 22,
  },
  eyebrow: {
    marginBottom: 8,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '700',
    letterSpacing: 1.2,
    color: COLORS.brand,
  },
  title: {
    fontSize: 28,
    lineHeight: 34,
    fontWeight: '700',
    letterSpacing: -0.4,
    color: COLORS.ink,
    textAlign: 'center',
  },
  subtitle: {
    maxWidth: 350,
    marginTop: 10,
    fontSize: 15,
    lineHeight: 22,
    color: COLORS.body,
    textAlign: 'center',
  },
  card: {
    width: '100%',
    padding: 20,
    borderWidth: 1,
    borderColor: COLORS.hairline,
    borderRadius: 20,
    backgroundColor: COLORS.white,
  },
  label: {
    marginBottom: 8,
    fontSize: 14,
    lineHeight: 19,
    fontWeight: '600',
    color: COLORS.ink,
  },
  input: {
    minHeight: 52,
    paddingHorizontal: 15,
    borderWidth: 1,
    borderColor: COLORS.borderStrong,
    borderRadius: LAYOUT.controlRadius,
    backgroundColor: COLORS.white,
    fontSize: 16,
    lineHeight: 21,
    color: COLORS.ink,
  },
  inputFocused: {
    borderColor: COLORS.brand,
    ...Platform.select({
      web: WEB_FOCUS,
      default: {},
    }),
  },
  inputInvalid: {
    borderColor: COLORS.error,
  },
  inputDisabled: {
    backgroundColor: COLORS.surfaceSoft,
    color: COLORS.muted,
  },
  errorRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginTop: 10,
  },
  errorText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 19,
    color: COLORS.error,
  },
  submitButton: {
    marginTop: 16,
  },
  checking: {
    marginTop: 10,
    fontSize: 13,
    lineHeight: 18,
    color: COLORS.muted,
    textAlign: 'center',
  },
  result: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginTop: 16,
    padding: 14,
    borderRadius: LAYOUT.controlRadius,
  },
  eligibleResult: {
    backgroundColor: COLORS.sageLight,
  },
  ineligibleResult: {
    backgroundColor: COLORS.surfaceWarm,
  },
  resultIcon: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 18,
  },
  eligibleIcon: {
    backgroundColor: COLORS.white,
  },
  ineligibleIcon: {
    backgroundColor: COLORS.white,
  },
  resultCopy: {
    flex: 1,
  },
  eligibleTitle: {
    fontSize: 15,
    lineHeight: 21,
    fontWeight: '700',
    color: COLORS.ink,
  },
  nextStep: {
    marginTop: 5,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '600',
    color: COLORS.sage,
  },
  resultNote: {
    marginTop: 4,
    fontSize: 12,
    lineHeight: 17,
    color: COLORS.body,
  },
  ineligibleText: {
    flex: 1,
    paddingTop: 1,
    fontSize: 14,
    lineHeight: 21,
    color: COLORS.body,
  },
  privacyNote: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    marginTop: 16,
    paddingHorizontal: 12,
  },
  privacyText: {
    flexShrink: 1,
    fontSize: 12,
    lineHeight: 17,
    color: COLORS.muted,
    textAlign: 'center',
  },
});
