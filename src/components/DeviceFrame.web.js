import React from 'react';
import { Platform, StyleSheet, View, useWindowDimensions } from 'react-native';
import { SafeAreaFrameContext, SafeAreaInsetsContext } from 'react-native-safe-area-context';

// Modest web safe-area insets: a little breathing room at top/bottom so screens
// that use SafeAreaView edges don't hug the very edge of the browser window.
export const WEB_SAFE_AREA_INSETS = { top: 12, left: 0, right: 0, bottom: 12 };

// Kept for compatibility with any code importing it; on web the app now fills
// the browser instead of rendering a phone shell.
export const IPHONE_METRICS = {
  frame: { x: 0, y: 0, width: 402, height: 874 },
  insets: { top: 59, left: 0, right: 0, bottom: 34 },
};

// Feed the safe-area contexts the real window frame plus modest fixed insets,
// so the app fills the browser and never gets remeasured to a phone size.
export function SafeAreaShim({ children }) {
  const { width, height } = useWindowDimensions();
  const frame = { x: 0, y: 0, width, height };
  return (
    <SafeAreaFrameContext.Provider value={frame}>
      <SafeAreaInsetsContext.Provider value={WEB_SAFE_AREA_INSETS}>
        {children}
      </SafeAreaInsetsContext.Provider>
    </SafeAreaFrameContext.Provider>
  );
}

// Web: run normally — the app fills the full browser viewport. No phone frame.
export default function DeviceFrame({ children }) {
  return (
    <View style={styles.stage}>
      {Platform.OS === 'web' ? <BackdropStyles /> : null}
      {children}
    </View>
  );
}

// Reset default page background/margins so the app fills the browser cleanly.
function BackdropStyles() {
  React.useEffect(() => {
    if (typeof document === 'undefined') return undefined;
    const id = 'bloom-device-frame-bg';
    if (document.getElementById(id)) return undefined;
    const style = document.createElement('style');
    style.id = id;
    style.textContent = `
      html, body, #root { height: 100%; margin: 0; }
      body { background: #ffffff; }
    `;
    document.head.appendChild(style);
    return () => {};
  }, []);
  return null;
}

const styles = StyleSheet.create({
  stage: {
    flex: 1,
    // @ts-ignore web-only
    minHeight: Platform.OS === 'web' ? '100vh' : undefined,
  },
});
