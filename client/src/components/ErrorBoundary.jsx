import { Component } from 'react';

export default class ErrorBoundary extends Component {
  state = { error: null };
  static getDerivedStateFromError(error) { return { error }; }
  render() {
    if (this.state.error) {
      return (
        <div className="min-h-dvh flex items-center justify-center bg-[var(--surface-page)]">
          <div className="text-center max-w-md px-4">
            <h2 className="text-xl font-semibold text-[var(--text-primary)] mb-2">Something went wrong</h2>
            <p className="text-[var(--text-muted)] text-sm mb-4">{this.state.error.message}</p>
            <button onClick={() => window.location.reload()} className="px-4 py-2 bg-[var(--brand)] text-[var(--text-on-brand)] rounded-lg text-sm">
              Reload page
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
