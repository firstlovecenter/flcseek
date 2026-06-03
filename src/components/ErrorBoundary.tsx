'use client';

import React, { Component, ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { ErrorScreen } from '@/components/base/ErrorScreen';

interface Props {
  /** Fallback UI to render when an error is caught.
   *  If omitted a default "Something went wrong" card is shown. */
  fallback?: ReactNode;
  /** Called whenever an error is caught – useful for logging services. */
  onError?: (error: Error, info: React.ErrorInfo) => void;
  children: ReactNode;
}

interface State {
  error: Error | null;
}

/**
 * ErrorBoundary — catches any JavaScript errors in its child tree and
 * renders a fallback UI instead of crashing the whole page.
 */
export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    this.props.onError?.(error, info);

    if (process.env.NODE_ENV !== 'production') {
      console.error('[ErrorBoundary] Caught error:', error, info.componentStack);
    }
  }

  private handleReset = () => {
    this.setState({ error: null });
  };

  render() {
    if (this.state.error) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <ErrorScreen
          title="Something went wrong"
          message={
            process.env.NODE_ENV !== 'production'
              ? this.state.error.message
              : 'An unexpected error occurred. Please try again.'
          }
          onRetry={this.handleReset}
        />
      );
    }

    return this.props.children;
  }
}

export function WidgetErrorBoundary({ children }: { children: ReactNode }) {
  return (
    <ErrorBoundary
      fallback={
        <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-4 text-sm text-destructive">
          This widget failed to load. Please refresh the page.
        </div>
      }
    >
      {children}
    </ErrorBoundary>
  );
}
