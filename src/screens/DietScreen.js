import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, LAYOUT } from '../utils/constants';

export default function DietScreen() {
  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <View style={styles.screen}>
        <View style={styles.content}>
          <View style={styles.icon} accessibilityElementsHidden>
            <Ionicons name='nutrition-outline' size={32} color={COLORS.brand} />
          </View>
          <Text accessibilityRole='header' style={styles.title}>
            Diet is under construction
          </Text>
          <Text style={styles.message}>
            We are preparing this space. It will be available in a future update.
          </Text>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.canvas,
  },
  screen: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: LAYOUT.screenPadding,
  },
  content: {
    width: '100%',
    maxWidth: 420,
    alignItems: 'center',
  },
  icon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.brandSoft,
  },
  title: {
    marginTop: 20,
    fontSize: 24,
    lineHeight: 30,
    fontWeight: '700',
    color: COLORS.ink,
    textAlign: 'center',
  },
  message: {
    maxWidth: 360,
    marginTop: 8,
    fontSize: 15,
    lineHeight: 22,
    color: COLORS.body,
    textAlign: 'center',
  },
});