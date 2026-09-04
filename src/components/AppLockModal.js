import React, { useEffect, useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from './Icon';
import * as LocalAuthentication from 'expo-local-authentication';
import { COLORS, createThemedStyles, LAYOUT } from '../utils/constants';
import { useApp } from '../context/AppContext';
import BrandMark from './BrandMark';
import Button from './Button';
import { Entrance } from './Motion';

export default function AppLockModal({ visible, onUnlock }) {
  const { state } = useApp();
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [inputFocused, setInputFocused] = useState(false);
  const lockType = state.privacy?.appLockType;

  useEffect(() => {
    if (!visible) return;
    setPin('');
    setError('');
    setInputFocused(false);
    if (lockType === 'biometric') attemptBiometric();
  }, [visible, lockType]);

  async function attemptBiometric() {
    setError('');
    try {
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Unlock Bloom',
        fallbackLabel: 'Use device passcode',
      });
      if (result.success) {
        onUnlock();
      } else {
        setError(
          result.error === 'user_cancel' || result.error === 'system_cancel'
            ? 'Bloom is still locked. Try again when you are ready.'
            : 'Device security could not verify you. Try again or use your device passcode.'
        );
      }
    } catch (authError) {
      setError('Device security is unavailable right now. Please try again.');
    }
  }

  function checkPin() {
    if (pin === state.privacy?.appLockPin) {
      setPin('');
      setError('');
      onUnlock();
    } else {
      setError('That PIN does not match. Try again.');
      setPin('');
    }
  }

  if (!visible) return null;

  return (
    <Modal visible={visible} animationType='fade' transparent={false} statusBarTranslucent={false} onRequestClose={() => {}}>
      <SafeAreaView style={styles.safeArea} accessibilityViewIsModal>
        <KeyboardAvoidingView
          style={styles.keyboardView}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps='handled'
            keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
            automaticallyAdjustKeyboardInsets={Platform.OS === 'ios'}
            showsVerticalScrollIndicator={false}
          >
            <Entrance style={styles.content} duration={240} distance={8}>
          <BrandMark size='large' />
          <View style={styles.lockIcon}><Icon name='lock-closed-outline' size={22} color={COLORS.brand} /></View>
          <Text style={styles.title}>Bloom is locked</Text>
          <Text style={styles.subtitle}>{lockType === 'biometric' ? 'Use your device security to continue.' : 'Enter your Bloom PIN to continue.'}</Text>

          {lockType === 'pin' ? (
            <View style={styles.form}>
              <TextInput
                style={[
                  styles.input,
                  inputFocused && styles.inputFocused,
                  error && styles.inputError,
                ]}
                value={pin}
                onChangeText={(value) => { setPin(value.replace(/\D/g, '')); setError(''); }}
                onFocus={() => setInputFocused(true)}
                onBlur={() => setInputFocused(false)}
                keyboardType='number-pad'
                secureTextEntry
                maxLength={6}
                placeholder='••••••'
                placeholderTextColor={COLORS.muted}
                onSubmitEditing={checkPin}
                autoFocus
                accessibilityLabel='Bloom PIN'
              />
              {error ? (
                <Entrance duration={180} distance={4}>
                  <Text style={styles.error} accessibilityRole='alert'>{error}</Text>
                </Entrance>
              ) : null}
              <Button title='Unlock Bloom' icon='lock-open-outline' onPress={checkPin} disabled={pin.length < 4} />
            </View>
          ) : (
            <View style={styles.form}>
              {error ? (
                <Entrance duration={180} distance={4}>
                  <Text style={styles.error} accessibilityRole='alert'>{error}</Text>
                </Entrance>
              ) : null}
              <Button title='Try device security again' icon='finger-print-outline' onPress={attemptBiometric} />
              <Text style={styles.deviceNote}>Your device may offer its passcode as a fallback.</Text>
            </View>
          )}
            </Entrance>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}

const styles = createThemedStyles({
  safeArea: { flex: 1, backgroundColor: COLORS.canvas },
  keyboardView: { flex: 1 },
  scroll: { flex: 1 },
  scrollContent: { flexGrow: 1 },
  content: { flexGrow: 1, width: '100%', maxWidth: 460, alignSelf: 'center', alignItems: 'center', justifyContent: 'center', paddingHorizontal: LAYOUT.screenPadding, paddingVertical: 40 },
  lockIcon: { width: 52, height: 52, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.brandSoft, marginTop: 32, marginBottom: 18 },
  title: { fontSize: 28, lineHeight: 34, fontWeight: '700', letterSpacing: -0.5, color: COLORS.ink, textAlign: 'center' },
  subtitle: { marginTop: 7, fontSize: 15, lineHeight: 22, color: COLORS.muted, textAlign: 'center' },
  form: { width: '100%', marginTop: 28, gap: 12 },
  input: { minHeight: 56, borderWidth: 1, borderColor: COLORS.hairline, borderRadius: LAYOUT.controlRadius, backgroundColor: COLORS.canvas, paddingHorizontal: 18, color: COLORS.ink, fontSize: 20, letterSpacing: 8, textAlign: 'center' },
  inputFocused: { borderColor: COLORS.brand },
  inputError: { borderColor: COLORS.error },
  error: { fontSize: 13, lineHeight: 19, color: COLORS.error, textAlign: 'center' },
  deviceNote: { fontSize: 12, lineHeight: 18, color: COLORS.muted, textAlign: 'center' },
});
