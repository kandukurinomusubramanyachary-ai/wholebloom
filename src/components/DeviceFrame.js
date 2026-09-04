import React from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';

// Native no-op: on iOS/Android the app already runs on a real device frame.
export default function DeviceFrame({ children }) {
  return children;
}

// Native uses the real measured SafeAreaProvider.
export function SafeAreaShim({ children }) {
  return <SafeAreaProvider>{children}</SafeAreaProvider>;
}

// iPhone 17 logical viewport (points) + safe-area insets, shared with the web
// frame so SafeAreaProvider reports realistic values in both places.
export const IPHONE_METRICS = {
  frame: { x: 0, y: 0, width: 402, height: 874 },
  insets: { top: 59, left: 0, right: 0, bottom: 34 },
};
