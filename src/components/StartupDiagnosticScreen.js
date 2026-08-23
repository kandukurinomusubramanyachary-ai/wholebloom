import React, { useEffect, useMemo, useState } from 'react';
import Constants from 'expo-constants';
import {
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { loadLastStartupFailure } from '../diagnostics/startupDiagnostics';
import { COLORS, createThemedStyles, LAYOUT, WEB_FOCUS } from '../utils/constants';

const FALLBACK_FAILURE = {
  diagnosticId: 'bloom-unavailable',
  stage: 'app-mounted',
  message: 'Bloom encountered an unexpected startup error.',
};

export default function StartupDiagnosticScreen({ failure, onRetry }) {
  const [restoredFailure, setRestoredFailure] = useState(null);
  const [retrying, setRetrying] = useState(false);
  const [copied, setCopied] = useState(false);
  const displayedFailure = failure || restoredFailure || FALLBACK_FAILURE;

  useEffect(() => {
    if (failure) return undefined;

    let active = true;
    loadLastStartupFailure().then((storedFailure) => {
      if (active && storedFailure) setRestoredFailure(storedFailure);
    });
    return () => {
      active = false;
    };
  }, [failure]);

  const diagnosticText = useMemo(
    () => {
      const platformConstants = Platform.constants || {};
      const deviceName = [
        platformConstants.Manufacturer,
        platformConstants.Model || platformConstants.interfaceIdiom,
      ].filter(Boolean).join(' ');
      return [
      'Bloom startup diagnostic',
      'Diagnostic ID: ' + displayedFailure.diagnosticId,
      'Stage: ' + displayedFailure.stage,
      'Message: ' + displayedFailure.message,
      'Bloom version: ' + (Constants.expoConfig?.version || 'unknown'),
      'Platform: ' + Platform.OS,
      'OS version: ' + String(Platform.Version),
      'Device: ' + (deviceName || 'unavailable'),
      'Timestamp: ' + (displayedFailure.timestamp || new Date().toISOString()),
      ].join('\n');
    },
    [displayedFailure]
  );

  const canCopy = true;

  async function handleRetry() {
    if (retrying || typeof onRetry !== 'function') return;
    setRetrying(true);
    setCopied(false);
    try {
      await onRetry();
    } finally {
      setRetrying(false);
    }
  }

  async function handleCopy() {
    if (!canCopy) return;
    try {
      const Clipboard = await import('expo-clipboard');
      await Clipboard.setStringAsync(diagnosticText);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.shell}>
          <Text style={styles.brand}>Bloom</Text>

          <View style={styles.card} accessibilityRole='alert'>
            <Text style={styles.eyebrow}>STARTUP DIAGNOSTIC</Text>
            <Text style={styles.title}>{'Bloom couldn\u2019t start'}</Text>
            <Text style={styles.message}>{displayedFailure.message}</Text>

            <View style={styles.stageBox}>
              <Text style={styles.stageLabel}>Diagnostic ID</Text>
              <Text selectable style={styles.stageValue}>
                {displayedFailure.diagnosticId}
              </Text>
              <Text style={styles.stageLabel}>Startup stage</Text>
              <Text selectable style={styles.stageValue}>
                {displayedFailure.stage}
              </Text>
            </View>

            <Pressable
              onPress={handleRetry}
              disabled={retrying || typeof onRetry !== 'function'}
              accessibilityRole='button'
              accessibilityLabel='Retry starting Bloom'
              style={({ pressed, focused }) => [
                styles.primaryButton,
                focused && styles.focused,
                pressed && styles.pressed,
                retrying && styles.disabled,
              ]}
            >
              <Text style={styles.primaryButtonText}>
                {retrying ? 'Retrying\u2026' : 'Retry'}
              </Text>
            </Pressable>

            {canCopy ? (
              <Pressable
                onPress={handleCopy}
                accessibilityRole='button'
                accessibilityLabel='Copy Bloom startup diagnostic'
                style={({ pressed, focused }) => [
                  styles.secondaryButton,
                  focused && styles.focused,
                  pressed && styles.pressed,
                ]}
              >
                <Text style={styles.secondaryButtonText}>
                  {copied ? 'Technical details copied' : 'Copy technical details'}
                </Text>
              </Pressable>
            ) : null}
          </View>

          <Text style={styles.privacyNote}>
            This diagnostic contains only a sanitised technical message and startup stage.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = createThemedStyles({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.splash,
  },
  content: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: LAYOUT.screenPadding,
    paddingVertical: 32,
  },
  shell: {
    width: '100%',
    maxWidth: 420,
    alignSelf: 'center',
  },
  brand: {
    marginBottom: 24,
    fontSize: 22,
    lineHeight: 28,
    fontWeight: '700',
    letterSpacing: -0.3,
    textAlign: 'center',
    color: COLORS.logoInk,
  },
  card: {
    padding: 22,
    borderWidth: 1,
    borderColor: COLORS.hairline,
    borderRadius: LAYOUT.cardRadius,
    backgroundColor: COLORS.white,
  },
  eyebrow: {
    marginBottom: 8,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '700',
    letterSpacing: 1,
    color: COLORS.brand,
  },
  title: {
    fontSize: 26,
    lineHeight: 32,
    fontWeight: '700',
    letterSpacing: -0.35,
    color: COLORS.ink,
  },
  message: {
    marginTop: 10,
    fontSize: 15,
    lineHeight: 22,
    color: COLORS.body,
  },
  stageBox: {
    marginTop: 20,
    marginBottom: 20,
    padding: 14,
    borderRadius: LAYOUT.controlRadius,
    backgroundColor: COLORS.surfaceSoft,
  },
  stageLabel: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '600',
    color: COLORS.muted,
  },
  stageValue: {
    marginTop: 4,
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '600',
    color: COLORS.ink,
  },
  primaryButton: {
    minHeight: 52,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
    borderRadius: LAYOUT.controlRadius,
    backgroundColor: COLORS.brand,
  },
  primaryButtonText: {
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '600',
    color: COLORS.white,
  },
  secondaryButton: {
    minHeight: 52,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
    paddingHorizontal: 20,
    borderWidth: 1,
    borderColor: COLORS.hairline,
    borderRadius: LAYOUT.controlRadius,
    backgroundColor: COLORS.white,
  },
  secondaryButtonText: {
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '600',
    color: COLORS.ink,
  },
  focused: Platform.select({
    web: WEB_FOCUS,
    default: {},
  }),
  pressed: {
    opacity: 0.76,
  },
  disabled: {
    opacity: 0.6,
  },
  privacyNote: {
    marginTop: 16,
    paddingHorizontal: 10,
    fontSize: 12,
    lineHeight: 18,
    textAlign: 'center',
    color: COLORS.muted,
  },
});
