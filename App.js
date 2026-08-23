import React, { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AppProvider, useApp } from './src/context/AppContext';
import { AuthProvider, useAuth } from './src/context/AuthContext';
import RootNavigator from './src/navigation/RootNavigator';
import AuthScreen from './src/screens/AuthScreen';
import SplashScreen from './src/screens/SplashScreen';
import StartupDiagnosticScreen from './src/components/StartupDiagnosticScreen';
import { markStartupReady } from './src/diagnostics/startupDiagnostics';
import { setActiveTheme } from './src/utils/constants';

function AuthenticatedBloom() {
  const { state } = useApp();
  return (
    <>
      <StatusBar style={state.resolvedTheme === 'dark' ? 'light' : 'dark'} />
      <RootNavigator />
    </>
  );
}

function BloomEntry() {
  const {
    user,
    initializing,
    retryStartup,
    startupFailure,
  } = useAuth();

  if (!user) setActiveTheme('light');

  useEffect(() => {
    if (!initializing && !user && !startupFailure) {
      markStartupReady();
    }
  }, [initializing, startupFailure, user]);

  if (startupFailure) {
    return (
      <StartupDiagnosticScreen
        failure={startupFailure}
        onRetry={retryStartup}
      />
    );
  }

  if (initializing) {
    return (
      <>
        <StatusBar style='dark' />
        <SplashScreen ready={false} onFinish={() => {}} />
      </>
    );
  }

  if (!user) {
    return (
      <>
        <StatusBar style='dark' />
        <AuthScreen />
      </>
    );
  }

  return (
    <AppProvider key={user.uid}>
      <AuthenticatedBloom />
    </AppProvider>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <BloomEntry />
      </AuthProvider>
    </SafeAreaProvider>
  );
}
