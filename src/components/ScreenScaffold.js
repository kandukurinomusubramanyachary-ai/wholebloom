import React from 'react';
import { Platform, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { COLORS, createThemedStyles, LAYOUT } from '../utils/constants';

/**
 * Shared bounded shell for stack routes. The navigation card owns the viewport
 * and this component owns vertical scrolling on both native and web.
 */
export default function ScreenScaffold({
  children,
  edges = ['top', 'bottom'],
  scroll = true,
  style,
  contentContainerStyle,
  innerStyle,
  showsVerticalScrollIndicator = Platform.OS === 'web',
  keyboardShouldPersistTaps = 'handled',
  ...scrollProps
}) {
  const content = <View style={[styles.inner, innerStyle]}>{children}</View>;

  return (
    <SafeAreaView style={[styles.safeArea, style]} edges={edges}>
      {scroll ? (
        <ScrollView
          {...scrollProps}
          style={styles.scroll}
          contentContainerStyle={[styles.scrollContent, contentContainerStyle]}
          keyboardShouldPersistTaps={keyboardShouldPersistTaps}
          showsVerticalScrollIndicator={showsVerticalScrollIndicator}
        >
          {content}
        </ScrollView>
      ) : (
        <View style={styles.staticContent}>{content}</View>
      )}
    </SafeAreaView>
  );
}

const styles = createThemedStyles({
  safeArea: {
    flex: 1,
    minHeight: 0,
    backgroundColor: COLORS.canvas,
    ...Platform.select({
      web: {
        height: '100vh',
        maxHeight: '100vh',
        overflow: 'hidden',
      },
    }),
  },
  scroll: {
    flex: 1,
    minHeight: 0,
    ...Platform.select({
      web: {
        height: '100%',
        overflowY: 'auto',
        overscrollBehavior: 'contain',
      },
    }),
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 32,
  },
  staticContent: {
    flex: 1,
    minHeight: 0,
  },
  inner: {
    width: '100%',
    maxWidth: LAYOUT.maxContentWidth,
    alignSelf: 'center',
    paddingHorizontal: LAYOUT.screenPadding,
  },
});
