import React, { useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as LocalAuthentication from 'expo-local-authentication';
import { useApp } from '../context/AppContext';
import { COLORS, createThemedStyles, LAYOUT } from '../utils/constants';
import Button from '../components/Button';
import ScreenHeader from '../components/ScreenHeader';

export default function PrivacySettingsScreen({ navigation }) {
  const { state, savePrivacy, saveSettings, clearMegHistory } = useApp();
  const [pin, setPin] = useState('');
  const [showPinSetup, setShowPinSetup] = useState(false);
  const [clearingMeg, setClearingMeg] = useState(false);
  const [confirmingMegClear, setConfirmingMegClear] = useState(false);
  const [megClearError, setMegClearError] = useState('');
  const [savingMegMemory, setSavingMegMemory] = useState(false);
  const [megMemoryError, setMegMemoryError] = useState('');
  const privacy = state.privacy || {};

  async function enableBiometric() {
    try {
      const hasHardware = await LocalAuthentication.hasHardwareAsync();
      const isEnrolled = await LocalAuthentication.isEnrolledAsync();
      if (!hasHardware) {
        Alert.alert('Not available', 'Biometric authentication is not available on this device.');
        return;
      }
      if (!isEnrolled) {
        Alert.alert('Not set up', 'Set up biometric authentication in your device settings first.');
        return;
      }
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Confirm to enable Bloom app lock',
        fallbackLabel: 'Use device PIN',
      });
      if (result.success) {
        await savePrivacy({ appLockEnabled: true, appLockType: 'biometric' });
        Alert.alert('App lock enabled', 'Bloom will use your device security to unlock.');
      }
    } catch (error) {
      Alert.alert('Could not enable app lock', 'Please try again from this device.');
    }
  }

  async function enablePin() {
    if (pin.length < 4) {
      Alert.alert('Check your PIN', 'Use at least 4 digits.');
      return;
    }
    await savePrivacy({ appLockEnabled: true, appLockType: 'pin', appLockPin: pin });
    setShowPinSetup(false);
    setPin('');
    Alert.alert('App lock enabled', 'Your Bloom PIN is now active.');
  }

  async function disableLock() {
    await savePrivacy({ appLockEnabled: false, appLockType: null, appLockPin: null });
    setShowPinSetup(false);
    setPin('');
  }

  async function handleClearMeg() {
    if (clearingMeg) return;
    if (!confirmingMegClear) {
      setMegClearError('');
      setConfirmingMegClear(true);
      return;
    }
    setClearingMeg(true);
    setMegClearError('');
    try {
      await clearMegHistory();
      setConfirmingMegClear(false);
    } catch (error) {
      setMegClearError('Bloom could not clear Meg history. Please try again.');
    } finally {
      setClearingMeg(false);
    }
  }

  async function handleMegMemoryChange(value) {
    if (savingMegMemory) return;
    setSavingMegMemory(true);
    setMegMemoryError('');
    try {
      await saveSettings({ megMemory: value });
    } catch (error) {
      setMegMemoryError('Bloom could not update Meg memory. Please try again.');
    } finally {
      setSavingMegMemory(false);
    }
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps='handled'>
        <View style={styles.content}>
          <BackButton onPress={() => navigation.goBack()} />
          <ScreenHeader title='Privacy & security' subtitle='Choose how Bloom protects what you record on this device.' />

          <View style={styles.section}>
            <View style={styles.sectionHeading}>
              <View style={styles.iconBox}>
                <Ionicons name='lock-closed-outline' size={20} color={COLORS.brand} />
              </View>
              <View style={styles.headingCopy}>
                <Text style={styles.sectionTitle}>App lock</Text>
                <Text style={styles.sectionDesc}>Require a check before Bloom opens.</Text>
              </View>
            </View>

            {privacy.appLockEnabled ? (
              <View style={styles.activeLock}>
                <View style={styles.activeLockCopy}>
                  <Ionicons name='checkmark-circle' size={20} color={COLORS.sage} />
                  <View style={styles.activeTextWrap}>
                    <Text style={styles.activeTitle}>App lock is on</Text>
                    <Text style={styles.activeDesc}>{privacy.appLockType === 'biometric' ? 'Device security' : 'Bloom PIN'}</Text>
                  </View>
                </View>
                <Pressable onPress={disableLock} accessibilityRole='button' accessibilityLabel='Turn off app lock' style={({ pressed, hovered, focused }) => [styles.textButton, hovered && styles.textButtonHovered, focused && styles.textButtonFocused, pressed && styles.pressed]}>
                  <Text style={styles.textButtonLabel}>Turn off</Text>
                </Pressable>
              </View>
            ) : (
              <View style={styles.lockActions}>
                <Button title='Use device security' icon='finger-print-outline' onPress={enableBiometric} />
                <Button title='Create Bloom PIN' icon='keypad-outline' variant='secondary' onPress={() => setShowPinSetup((current) => !current)} />
              </View>
            )}

            {showPinSetup && !privacy.appLockEnabled ? (
              <View style={styles.pinSetup}>
                <Text style={styles.inputLabel}>Create a 4–6 digit PIN</Text>
                <TextInput
                  style={styles.pinInput}
                  value={pin}
                  onChangeText={(value) => setPin(value.replace(/\D/g, ''))}
                  keyboardType='number-pad'
                  secureTextEntry
                  maxLength={6}
                  placeholder='••••••'
                  placeholderTextColor={COLORS.muted}
                  accessibilityLabel='New Bloom PIN'
                  onSubmitEditing={enablePin}
                />
                <Text style={styles.supportingText}>This PIN is stored locally by Bloom. Do not reuse a banking or device PIN.</Text>
                <Button title='Enable PIN' onPress={enablePin} disabled={pin.length < 4} />
              </View>
            ) : null}
          </View>

          <View style={styles.section}>
            <View style={styles.settingRow}>
              <View style={styles.settingIcon}><Ionicons name='eye-off-outline' size={19} color={COLORS.brand} /></View>
              <View style={styles.settingCopy}>
                <Text style={styles.sectionTitle}>Hide app preview</Text>
                <Text style={styles.sectionDesc}>Prevent screenshots and recent-app previews where your device supports it.</Text>
              </View>
              <Switch
                value={Boolean(privacy.hidePreview)}
                onValueChange={(value) => savePrivacy({ hidePreview: value })}
                accessibilityLabel='Hide app preview'
                trackColor={{ false: COLORS.hairline, true: COLORS.sage }}
                thumbColor={COLORS.white}
                ios_backgroundColor={COLORS.hairline}
              />
            </View>
          </View>

          <View style={styles.section}>
            <View style={styles.settingRow}>
              <View style={styles.settingIcon}><Ionicons name='notifications-off-outline' size={19} color={COLORS.brand} /></View>
              <View style={styles.settingCopy}>
                <Text style={styles.sectionTitle}>Hide sensitive notification content</Text>
                <Text style={styles.sectionDesc}>Use neutral reminder text on the lock screen.</Text>
              </View>
              <Switch
                value={state.settings?.hideNotificationContent !== false}
                onValueChange={(value) => saveSettings({ hideNotificationContent: value })}
                accessibilityLabel='Hide sensitive notification content'
                trackColor={{ false: COLORS.hairline, true: COLORS.sage }}
                thumbColor={COLORS.white}
              />
            </View>
          </View>

          <View style={styles.section}>
            <View style={styles.settingRow}>
              <View style={styles.settingIcon}><Ionicons name='chatbubbles-outline' size={19} color={COLORS.brand} /></View>
              <View style={styles.settingCopy}>
                <Text style={styles.sectionTitle}>Meg memory</Text>
                <Text style={styles.sectionDesc}>When off, chats still save securely but do not inform new replies.</Text>
              </View>
              <Switch
                value={Boolean(state.settings?.megMemory)}
                onValueChange={handleMegMemoryChange}
                disabled={savingMegMemory}
                accessibilityLabel='Allow Meg to remember conversations'
                accessibilityState={{ disabled: savingMegMemory, busy: savingMegMemory }}
                trackColor={{ false: COLORS.hairline, true: COLORS.sage }}
                thumbColor={COLORS.white}
              />
            </View>
            {megMemoryError ? <Text style={styles.clearChatError} accessibilityRole='alert'>{megMemoryError}</Text> : null}
            <View style={styles.memoryFooter}>
              <Text style={styles.memoryCount}>{state.megConversations?.length || 0} saved conversations</Text>
              <Pressable
                onPress={handleClearMeg}
                disabled={clearingMeg || !state.megConversations?.length}
                accessibilityRole='button'
                accessibilityLabel='Clear Meg chat history'
                accessibilityState={{ disabled: clearingMeg || !state.megConversations?.length, busy: clearingMeg }}
                style={({ pressed, hovered, focused }) => [
                  styles.clearChatButton,
                  hovered && !clearingMeg && styles.clearChatHovered,
                  focused && styles.clearChatFocused,
                  pressed && styles.pressed,
                ]}
              >
                <Text style={[styles.clearChatText, (!state.megConversations?.length || clearingMeg) && styles.disabledText]}>{clearingMeg ? 'Clearing…' : 'Clear chat history'}</Text>
              </Pressable>
            </View>
            {confirmingMegClear && !clearingMeg ? (
              <View style={styles.clearConfirmation}>
                <Text style={styles.supportingText}>This permanently removes every saved Meg conversation from your Bloom account. Tap Clear chat history again to continue.</Text>
                <Pressable
                  onPress={() => setConfirmingMegClear(false)}
                  accessibilityRole='button'
                  accessibilityLabel='Cancel clearing Meg history'
                  style={({ pressed }) => [styles.textButton, pressed && styles.pressed]}
                >
                  <Text style={styles.textButtonLabel}>Cancel</Text>
                </Pressable>
              </View>
            ) : null}
            {megClearError ? <Text style={styles.clearChatError} accessibilityRole='alert'>{megClearError}</Text> : null}
          </View>

          <View style={styles.section}>
            <View style={styles.sectionHeading}>
              <View style={styles.iconBox}>
                <Ionicons name='timer-outline' size={20} color={COLORS.brand} />
              </View>
              <View style={styles.headingCopy}>
                <Text style={styles.sectionTitle}>Auto-lock</Text>
                <Text style={styles.sectionDesc}>Lock after {privacy.appLockTimeout || 5} minutes away from Bloom.</Text>
              </View>
            </View>
            <View style={styles.timeoutOptions} accessibilityRole='radiogroup'>
              {[1, 2, 5].map((minutes) => {
                const selected = (privacy.appLockTimeout || 5) === minutes;
                return (
                  <Pressable
                    key={minutes}
                    onPress={() => savePrivacy({ appLockTimeout: minutes })}
                    accessibilityRole='radio'
                    accessibilityLabel={`${minutes} ${minutes === 1 ? 'minute' : 'minutes'}`}
                    accessibilityState={{ selected }}
                    style={({ pressed, hovered, focused }) => [
                      styles.timeoutOption,
                      selected && styles.timeoutSelected,
                      hovered && styles.timeoutHovered,
                      focused && styles.focusedControl,
                      pressed && styles.pressed,
                    ]}
                  >
                    <Text style={[styles.timeoutText, selected && styles.timeoutTextSelected]}>{minutes} min</Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          <View style={styles.localNote}>
            <Ionicons name='phone-portrait-outline' size={18} color={COLORS.sage} />
            <Text style={styles.localNoteText}>Bloom keeps cycle dates and check-ins in your private account. Device preferences remain local. Export or delete your records whenever you choose.</Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function BackButton({ onPress }) {
  return (
    <Pressable onPress={onPress} accessibilityRole='button' accessibilityLabel='Go back' hitSlop={8} style={({ pressed, hovered, focused }) => [styles.backButton, hovered && styles.backButtonHovered, focused && styles.backButtonFocused, pressed && styles.pressed]}>
      <Ionicons name='chevron-back' size={20} color={COLORS.ink} />
      <Text style={styles.backText}>Back</Text>
    </Pressable>
  );
}

const styles = createThemedStyles({
  safeArea: { flex: 1, backgroundColor: COLORS.canvas },
  scroll: { flex: 1 },
  scrollContent: { paddingBottom: 40 },
  content: { width: '100%', maxWidth: LAYOUT.maxContentWidth, alignSelf: 'center', paddingHorizontal: LAYOUT.screenPadding, paddingTop: 12 },
  backButton: { minHeight: 44, alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 2, marginLeft: -6, marginBottom: 8, paddingHorizontal: 6 },
  backText: { fontSize: 15, fontWeight: '600', color: COLORS.ink },
  pressed: { opacity: 0.65 },
  section: { paddingVertical: 24, borderTopWidth: 1, borderTopColor: COLORS.hairline },
  sectionHeading: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  iconBox: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.brandSoft },
  headingCopy: { flex: 1, paddingTop: 1 },
  sectionTitle: { fontSize: 16, lineHeight: 21, fontWeight: '600', color: COLORS.ink },
  sectionDesc: { marginTop: 3, fontSize: 13, lineHeight: 19, color: COLORS.muted },
  lockActions: { marginTop: 18, gap: 10 },
  activeLock: { marginTop: 18, minHeight: 64, paddingHorizontal: 14, borderRadius: LAYOUT.controlRadius, backgroundColor: COLORS.sageLight, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  activeLockCopy: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
  activeTextWrap: { flex: 1 },
  activeTitle: { fontSize: 14, fontWeight: '700', color: COLORS.ink },
  activeDesc: { marginTop: 1, fontSize: 12, color: COLORS.muted },
  textButton: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 4 },
  textButtonLabel: { fontSize: 14, fontWeight: '700', color: COLORS.brand },
  textButtonHovered: { backgroundColor: COLORS.surfaceWarm, borderRadius: 9 },
  textButtonFocused: { backgroundColor: COLORS.brandSoft, borderRadius: 9 },
  pinSetup: { marginTop: 18, padding: 16, borderRadius: LAYOUT.controlRadius, backgroundColor: COLORS.surfaceSoft, gap: 10 },
  inputLabel: { fontSize: 14, fontWeight: '600', color: COLORS.ink },
  pinInput: { minHeight: 54, borderWidth: 1, borderColor: COLORS.hairline, borderRadius: LAYOUT.controlRadius, backgroundColor: COLORS.canvas, paddingHorizontal: 16, color: COLORS.ink, fontSize: 20, letterSpacing: 8, textAlign: 'center' },
  supportingText: { fontSize: 12, lineHeight: 18, color: COLORS.muted, marginBottom: 2 },
  settingRow: { flexDirection: 'row', alignItems: 'center', gap: 20 },
  settingIcon: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.brandSoft },
  settingCopy: { flex: 1 },
  memoryFooter: { minHeight: 50, marginTop: 16, paddingTop: 12, borderTopWidth: 1, borderTopColor: COLORS.hairline, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  memoryCount: { flex: 1, fontSize: 12, lineHeight: 17, color: COLORS.muted },
  clearConfirmation: { marginTop: 10, flexDirection: 'row', alignItems: 'center', gap: 12 },
  clearChatError: { marginTop: 10, fontSize: 12, lineHeight: 17, color: COLORS.error },
  clearChatButton: { minHeight: 44, justifyContent: 'center' },
  clearChatHovered: { backgroundColor: '#FFF7F6', borderRadius: 9, paddingHorizontal: 6 },
  clearChatFocused: { backgroundColor: COLORS.brandSoft, borderRadius: 9, paddingHorizontal: 6 },
  clearChatText: { fontSize: 13, fontWeight: '700', color: COLORS.error },
  disabledText: { color: COLORS.muted },
  timeoutOptions: { flexDirection: 'row', gap: 8, marginTop: 18 },
  timeoutOption: { minWidth: 72, minHeight: 44, paddingHorizontal: 14, borderRadius: LAYOUT.controlRadius, borderWidth: 1, borderColor: COLORS.hairline, backgroundColor: COLORS.canvas, alignItems: 'center', justifyContent: 'center' },
  timeoutSelected: { borderColor: COLORS.brand, backgroundColor: COLORS.brandSoft },
  timeoutHovered: { borderColor: '#D7B1A5', backgroundColor: COLORS.surfaceWarm },
  focusedControl: { borderColor: COLORS.brand },
  timeoutText: { fontSize: 14, fontWeight: '600', color: COLORS.body },
  timeoutTextSelected: { color: COLORS.brand },
  localNote: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, paddingHorizontal: 4, paddingVertical: 12 },
  localNoteText: { flex: 1, fontSize: 13, lineHeight: 19, color: COLORS.muted },
  backButtonHovered: { backgroundColor: COLORS.surfaceSoft, borderRadius: 10 },
  backButtonFocused: { backgroundColor: COLORS.brandSoft, borderRadius: 10 },
});
