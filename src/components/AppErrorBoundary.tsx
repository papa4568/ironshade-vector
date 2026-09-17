import { Component, type ErrorInfo, type ReactNode } from 'react';

type Props = { children: ReactNode };
type State = { failed: boolean; incidentId: string };

function incidentId() {
  const stamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).slice(2, 7).toUpperCase();
  return `${stamp}-${random}`;
}

export class AppErrorBoundary extends Component<Props, State> {
  state: State = { failed: false, incidentId: '' };

  static getDerivedStateFromError(): State {
    return { failed: true, incidentId: incidentId() };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Ironshade runtime recovery boundary', { error, componentStack: info.componentStack });
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <main className="surface-loader" role="alert" aria-live="assertive">
        <div>
          <span>QUIET SIGNAL // RUNTIME RECOVERY</span>
          <b>The current screen stopped unexpectedly.</b>
          <p>Your last committed local save was left untouched. Incident {this.state.incidentId}.</p>
          <button onClick={() => window.location.reload()}>Reload game</button>
        </div>
      </main>
    );
  }
}
