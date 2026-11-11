import { Component, type ErrorInfo, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';

interface State {
  failed: boolean;
}

/** Shows a recoverable message instead of a blank page if rendering throws. */
export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { failed: false };

  static getDerivedStateFromError(): State {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('UI error', error, info.componentStack);
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <div className="mx-auto max-w-lg p-6">
        <EmptyState
          title="Something went wrong"
          description="The page hit an unexpected error. Reloading usually fixes it."
          action={<Button onClick={() => window.location.reload()}>Reload page</Button>}
        />
      </div>
    );
  }
}
