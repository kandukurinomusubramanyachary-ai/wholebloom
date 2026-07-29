import React from 'react';
import StartupDiagnosticScreen from './StartupDiagnosticScreen';
import {
  clearStartupFailure,
  createStartupFailure,
  getStartupStage,
  recordStartupFailure,
  setStartupStage,
} from '../diagnostics/startupDiagnostics';

export default class StartupErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      error: null,
      failure: null,
      retryKey: 0,
    };
  }

  static getDerivedStateFromError(error) {
    return {
      error,
      failure: createStartupFailure(error, getStartupStage()),
    };
  }

  componentDidCatch(error) {
    const failure = recordStartupFailure(error, getStartupStage());
    this.setState({ failure });
  }

  handleRetry = async () => {
    await clearStartupFailure();
    setStartupStage('app-mounted');
    this.setState((current) => ({
      error: null,
      failure: null,
      retryKey: current.retryKey + 1,
    }));
  };

  render() {
    if (this.state.error) {
      return (
        <StartupDiagnosticScreen
          failure={this.state.failure}
          onRetry={this.handleRetry}
        />
      );
    }

    return (
      <React.Fragment key={this.state.retryKey}>
        {this.props.children}
      </React.Fragment>
    );
  }
}

