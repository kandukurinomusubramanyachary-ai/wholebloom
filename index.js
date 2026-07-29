const React = require('react');
const { View } = require('react-native');
const registerRootComponentModule = require('expo/build/launch/registerRootComponent');
const StartupDiagnosticScreen = require('./src/components/StartupDiagnosticScreen').default;
const StartupErrorBoundary = require('./src/components/StartupErrorBoundary').default;
const {
  clearStartupFailure,
  installGlobalErrorHandler,
  loadLastStartupFailure,
  recordStartupFailure,
  setStartupStage,
} = require('./src/diagnostics/startupDiagnostics');

const registerRootComponent =
  registerRootComponentModule.default || registerRootComponentModule;

installGlobalErrorHandler();
setStartupStage('app-mounted');

function loadBloomApplication() {
  try {
    const applicationModule = require('./App');
    const AppComponent = applicationModule.default || applicationModule;
    if (typeof AppComponent !== 'function') {
      throw new Error('Bloom application entry is unavailable.');
    }
    return {
      status: 'ready',
      AppComponent,
      failure: null,
    };
  } catch (error) {
    return {
      status: 'failed',
      AppComponent: null,
      failure: recordStartupFailure(error, 'app-mounted'),
    };
  }
}

function BloomBootstrap() {
  const [loadState, setLoadState] = React.useState({
    status: 'restoring',
    AppComponent: null,
    failure: null,
  });

  React.useEffect(() => {
    let active = true;

    loadLastStartupFailure().then((storedFailure) => {
      if (!active) return;
      if (storedFailure) {
        setLoadState({
          status: 'failed',
          AppComponent: null,
          failure: storedFailure,
        });
        return;
      }
      setLoadState(loadBloomApplication());
    });

    return () => {
      active = false;
    };
  }, []);

  const handleRetry = React.useCallback(async () => {
    await clearStartupFailure();
    setStartupStage('app-mounted');
    setLoadState({
      status: 'restoring',
      AppComponent: null,
      failure: null,
    });
    setLoadState(loadBloomApplication());
  }, []);

  if (loadState.status === 'failed') {
    return React.createElement(StartupDiagnosticScreen, {
      failure: loadState.failure,
      onRetry: handleRetry,
    });
  }

  if (loadState.status !== 'ready' || !loadState.AppComponent) {
    return React.createElement(View, {
      style: { flex: 1, backgroundColor: '#FFFDFE' },
    });
  }

  return React.createElement(
    StartupErrorBoundary,
    null,
    React.createElement(loadState.AppComponent)
  );
}

registerRootComponent(BloomBootstrap);

