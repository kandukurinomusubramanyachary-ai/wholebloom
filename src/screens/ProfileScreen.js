import React, { useState } from 'react';
import { Platform, View, Text, Pressable, StyleSheet, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import { COLORS, ELEVATION, LAYOUT } from '../utils/constants';
import ScreenHeader from '../components/ScreenHeader';
import Card from '../components/Card';
import Button from '../components/Button';

export default function ProfileScreen({ navigation }) {
  const { state, resetAllData } = useApp();
  const { user, logOut } = useAuth();
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [logoutError, setLogoutError] = useState('');
  const [deletingData, setDeletingData] = useState(false);
  const [deleteError, setDeleteError] = useState('');
  const trackingMode = state.settings?.trackingMode || state.profile?.trackingMode || 'cycle';
  const modeLabel = trackingMode === 'pcos' ? 'PCOS support mode' : 'Basic cycle mode';
  const movementDays = state.stats?.movementDays ?? new Set(
    (state.movements || [])
      .filter((item) => item.status !== 'not_today')
      .map((item) => item.date)
  ).size;
  const stats = [
    { value: state.stats?.totalCheckins ?? state.checkins?.length ?? 0, label: 'Check-ins' },
    { value: state.stats?.totalCycles ?? state.periods?.length ?? 0, label: 'Cycles' },
    { value: state.bookmarks?.length ?? 0, label: 'Saved' },
    { value: state.stats?.mealsLogged ?? state.meals?.length ?? 0, label: 'Meals' },
    { value: movementDays, label: 'Movement days' },
  ];

  const menuSections = [
    {
      title: 'Privacy and care',
      items: [
        { icon: 'shield-checkmark-outline', title: 'Privacy & security', subtitle: 'App lock and preview controls', route: 'PrivacySettings' },
        { icon: 'medkit-outline', title: 'Doctor summary', subtitle: 'Preview a private, appointment-ready report', route: 'DoctorReport' },
        { icon: 'download-outline', title: 'Export your data', subtitle: 'Keep a copy for yourself or your doctor', route: 'ExportData' },
      ],
    },
    {
      title: 'Your preferences',
      items: [
        { icon: 'notifications-outline', title: 'Reminders', subtitle: 'Choose when Bloom gently checks in', route: 'Reminders' },
        { icon: 'options-outline', title: 'Personalisation', subtitle: `${modeLabel}, goals and guidance`, route: 'Preferences' },
      ],
    },
  ];

  async function handleDeleteData() {
    if (deletingData) return;
    setDeletingData(true);
    setDeleteError('');
    try {
      await resetAllData();
      setShowDeleteConfirm(false);
    } catch (error) {
      setDeleteError('Bloom could not delete your tracked data. Please try again.');
    } finally {
      setDeletingData(false);
    }
  }

  async function handleLogout() {
    if (loggingOut) return;
    setLoggingOut(true);
    setLogoutError('');
    try {
      await logOut();
    } catch (error) {
      setLogoutError('Bloom could not log out right now. Please try again.');
      setLoggingOut(false);
    }
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <ScrollView style={styles.screen} contentContainerStyle={styles.scrollContent}>
        <View style={styles.inner}>
          <ScreenHeader title='Your space' subtitle='Manage Bloom in a way that feels private and comfortable.' />

          <View style={styles.profileRow}>
            <View style={styles.avatar} accessibilityLabel='Bloom flower mark'>
              <Ionicons name='flower-outline' size={32} color={COLORS.brand} />
            </View>
            <View style={styles.profileCopy}>
              <Text style={styles.name}>{state.profile?.name || 'Your Bloom'}</Text>
              <Text style={styles.profileMeta}>
                {state.profile?.age ? `${state.profile.age} years old` : 'A quiet record of your own patterns'}
              </Text>
              <View style={styles.modeBadge}>
                <Ionicons
                  name={trackingMode === 'pcos' ? 'flower-outline' : 'calendar-outline'}
                  size={14}
                  color={COLORS.brand}
                />
                <Text style={styles.modeText}>{modeLabel}</Text>
              </View>
            </View>
          </View>

          <View style={styles.activitySection}>
            <View style={styles.activityHeading}>
              <Text style={[styles.sectionTitle, styles.activityTitle]}>Your activity</Text>
              <Text style={styles.activityCaption}>A simple view of what you have chosen to record</Text>
            </View>
            <View style={styles.statsGrid} accessibilityLabel='Your Bloom activity'>
              {stats.map((item, index) => (
                <View
                  key={item.label}
                  style={[
                    styles.stat,
                    ![2, 4].includes(index) && styles.statDivider,
                    index < 3 && styles.statRowDivider,
                  ]}
                >
                  <Text style={styles.statValue}>{item.value}</Text>
                  <Text style={styles.statLabel}>{item.label}</Text>
                </View>
              ))}
            </View>
          </View>

          <Card variant='sage' style={styles.privacyNote}>
            <View style={styles.noteIcon}>
              <Ionicons name='lock-closed-outline' size={20} color={COLORS.sage} />
            </View>
            <View style={styles.flex}>
              <Text style={styles.noteTitle}>Your records belong to your account</Text>
              <Text style={styles.noteText}>Your cycle dates and check-ins are available only after secure sign-in. You decide when to export or erase your data.</Text>
            </View>
          </Card>

          {menuSections.map((section) => (
            <View key={section.title} style={styles.menuSection}>
              <Text style={styles.sectionTitle}>{section.title}</Text>
              <View style={styles.menuGroup}>
                {section.items.map((item, index) => (
                  <Pressable
                    key={item.title}
                    onPress={() => navigation.navigate(item.route)}
                    accessibilityRole='button'
                    accessibilityLabel={`${item.title}. ${item.subtitle}`}
                    style={({ pressed, hovered, focused }) => [
                      styles.menuItem,
                      index < section.items.length - 1 && styles.menuItemBorder,
                      hovered && styles.menuItemHovered,
                      focused && styles.menuItemFocused,
                      pressed && styles.menuItemPressed,
                    ]}
                  >
                    <View style={styles.menuIcon}>
                      <Ionicons name={item.icon} size={21} color={COLORS.body} />
                    </View>
                    <View style={styles.menuText}>
                      <Text style={styles.menuTitle}>{item.title}</Text>
                      <Text style={styles.menuSubtitle}>{item.subtitle}</Text>
                    </View>
                    <Ionicons name='chevron-forward' size={19} color={COLORS.muted} />
                  </Pressable>
                ))}
              </View>
            </View>
          ))}

          <View style={styles.menuSection}>
            <Text style={styles.sectionTitle}>Account</Text>
            <View style={styles.menuGroup}>
              <Pressable
                onPress={handleLogout}
                disabled={loggingOut}
                accessibilityRole='button'
                accessibilityLabel='Log out of Bloom'
                accessibilityState={{ disabled: loggingOut, busy: loggingOut }}
                style={({ pressed, hovered, focused }) => [
                  styles.menuItem,
                  hovered && styles.menuItemHovered,
                  focused && styles.menuItemFocused,
                  pressed && styles.menuItemPressed,
                  loggingOut && styles.disabledItem,
                ]}
              >
                <View style={styles.menuIcon}>
                  <Ionicons name='log-out-outline' size={21} color={COLORS.body} />
                </View>
                <View style={styles.menuText}>
                  <Text style={styles.menuTitle}>{loggingOut ? 'Logging out…' : 'Log out'}</Text>
                  <Text style={styles.menuSubtitle}>{user?.email || 'Return to secure sign-in'}</Text>
                </View>
                <Ionicons name='chevron-forward' size={19} color={COLORS.muted} />
              </Pressable>
            </View>
            {logoutError ? <Text style={styles.logoutError} accessibilityRole='alert'>{logoutError}</Text> : null}
          </View>

          <View style={styles.dataSection}>
            <Text style={styles.sectionTitle}>Your data</Text>
            {!showDeleteConfirm ? (
              <Pressable
                onPress={() => setShowDeleteConfirm(true)}
                accessibilityRole='button'
                style={({ pressed, hovered, focused }) => [
                  styles.deleteTrigger,
                  hovered && styles.deleteTriggerHovered,
                  focused && styles.focusedControl,
                  pressed && styles.menuItemPressed,
                ]}
              >
                <Ionicons name='trash-outline' size={20} color={COLORS.error} />
                <Text style={styles.deleteTriggerText}>Delete tracked Bloom data</Text>
              </Pressable>
            ) : (
              <Card style={styles.confirmCard}>
                <Text style={styles.confirmTitle}>Delete tracked data from your account?</Text>
                <Text style={styles.confirmText}>This permanently removes your check-ins, cycle dates, meals, movement, Meg chats, saved articles and settings from your Bloom account and this device. Your sign-in and required consent profile remain so you can keep using Bloom. It cannot be undone.</Text>
                {deleteError ? <Text style={styles.logoutError} accessibilityRole='alert'>{deleteError}</Text> : null}
                <View style={styles.confirmActions}>
                  <Button
                    title='Keep my data'
                    variant='secondary'
                    onPress={() => setShowDeleteConfirm(false)}
                    disabled={deletingData}
                    style={styles.confirmButton}
                  />
                  <Button
                    title='Delete tracked data'
                    variant='danger'
                    onPress={handleDeleteData}
                    loading={deletingData}
                    disabled={deletingData}
                    style={styles.confirmButton}
                  />
                </View>
              </Card>
            )}
          </View>

          <Text style={styles.version}>Bloom 1.0 · Private by design</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: COLORS.canvas },
  screen: { flex: 1, backgroundColor: COLORS.canvas },
  scrollContent: { paddingBottom: 40 },
  inner: {
    width: '100%',
    maxWidth: LAYOUT.maxContentWidth,
    alignSelf: 'center',
    paddingHorizontal: LAYOUT.screenPadding,
    paddingTop: 24,
  },
  flex: { flex: 1 },
  profileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 15,
    marginBottom: 22,
  },
  avatar: {
    width: 58,
    height: 58,
    borderRadius: 29,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.brandSoft,
  },
  profileCopy: { flex: 1 },
  name: {
    fontSize: 20,
    lineHeight: 26,
    fontWeight: '600',
    color: COLORS.ink,
  },
  profileMeta: {
    marginTop: 2,
    fontSize: 13,
    lineHeight: 18,
    color: COLORS.muted,
  },
  modeBadge: {
    minHeight: 30,
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 7,
    paddingHorizontal: 10,
    borderRadius: 15,
    backgroundColor: COLORS.brandSoft,
  },
  modeText: {
    fontSize: 11,
    lineHeight: 15,
    fontWeight: '700',
    color: COLORS.brand,
  },
  activitySection: {
    marginTop: 2,
  },
  activityHeading: {
    marginBottom: 10,
  },
  activityTitle: { marginBottom: 0 },
  activityCaption: {
    marginTop: 2,
    fontSize: 12,
    lineHeight: 17,
    color: COLORS.muted,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    overflow: 'hidden',
    borderRadius: LAYOUT.cardRadius,
    backgroundColor: COLORS.surfaceSoft,
  },
  stat: {
    minWidth: 92,
    minHeight: 74,
    flexGrow: 1,
    flexBasis: '28%',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
    paddingVertical: 12,
  },
  statDivider: { borderRightWidth: 1, borderRightColor: COLORS.hairline },
  statRowDivider: { borderBottomWidth: 1, borderBottomColor: COLORS.hairline },
  statValue: {
    fontSize: 20,
    lineHeight: 26,
    fontWeight: '600',
    color: COLORS.ink,
  },
  statLabel: {
    marginTop: 3,
    fontSize: 12,
    lineHeight: 16,
    color: COLORS.muted,
  },
  privacyNote: {
    marginTop: 24,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    borderWidth: 0,
  },
  noteIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.white,
  },
  noteTitle: {
    fontSize: 15,
    lineHeight: 21,
    fontWeight: '600',
    color: COLORS.ink,
  },
  noteText: {
    marginTop: 4,
    fontSize: 13,
    lineHeight: 19,
    color: COLORS.body,
  },
  menuSection: { marginTop: 28 },
  sectionTitle: {
    marginBottom: 10,
    fontSize: 14,
    lineHeight: 19,
    fontWeight: '600',
    color: COLORS.ink,
  },
  menuGroup: {
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: COLORS.hairline,
    backgroundColor: COLORS.white,
  },
  menuItem: {
    minHeight: 72,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 13,
    paddingHorizontal: 14,
    backgroundColor: COLORS.white,
  },
  menuItemBorder: { borderBottomWidth: 1, borderBottomColor: COLORS.hairline },
  menuItemPressed: { backgroundColor: COLORS.surfaceSoft },
  menuItemHovered: { backgroundColor: COLORS.surfaceWarm },
  menuItemFocused: { backgroundColor: COLORS.brandSoft },
  disabledItem: { opacity: 0.62 },
  menuIcon: {
    width: 40,
    height: 40,
    marginRight: 12,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.surfaceSoft,
  },
  menuText: { flex: 1, paddingRight: 10 },
  menuTitle: {
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '600',
    color: COLORS.ink,
  },
  menuSubtitle: {
    marginTop: 3,
    fontSize: 12,
    lineHeight: 17,
    color: COLORS.muted,
  },
  logoutError: { marginTop: 8, fontSize: 13, lineHeight: 18, color: COLORS.error },
  dataSection: { marginTop: 28 },
  deleteTrigger: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 9,
    borderWidth: 1,
    borderColor: '#E8C8C4',
    borderRadius: LAYOUT.controlRadius,
    backgroundColor: COLORS.white,
  },
  deleteTriggerHovered: { backgroundColor: '#FFF7F6', borderColor: '#DCA9A2' },
  focusedControl: { borderColor: COLORS.brand },
  deleteTriggerText: {
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '600',
    color: COLORS.error,
  },
  confirmCard: {
    borderWidth: 0,
    backgroundColor: '#FFF7F6',
    ...Platform.select({ web: ELEVATION.web, ios: ELEVATION.ios, android: ELEVATION.android, default: {} }),
  },
  confirmTitle: {
    fontSize: 17,
    lineHeight: 23,
    fontWeight: '600',
    color: COLORS.ink,
  },
  confirmText: {
    marginTop: 6,
    fontSize: 14,
    lineHeight: 21,
    color: COLORS.body,
  },
  confirmActions: {
    marginTop: 18,
    flexDirection: 'row',
    gap: 10,
  },
  confirmButton: { flex: 1, paddingHorizontal: 12 },
  version: {
    marginTop: 28,
    fontSize: 12,
    lineHeight: 17,
    color: COLORS.muted,
    textAlign: 'center',
  },
});
