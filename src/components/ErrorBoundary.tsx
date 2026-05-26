'use client';

import React, { Component, ReactNode } from 'react';
import { Button, Result } from 'antd';

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
 *
 * React error boundaries must be class components (hooks cannot catch render errors).
 *
 * Usage:
 * ```tsx
 * <ErrorBoundary>
 *   <DashboardCharts />
 * </ErrorBoundary>
 *
 * // With custom fallback:
 * <ErrorBoundary fallback={<p>Chart failed to load.</p>}>
 *   <DashboardCharts />
 * </ErrorBoundary>
 * ```
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
    // Forward to an external logging service if provided
    this.props.onError?.(error, info);

    // Always log in development
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
        <Result
          status="error"
          title="Something went wrong"
          subTitle={
            process.env.NODE_ENV !== 'production'
              ? this.state.error.message
              : 'An unexpected error occurred. Please try again.'
          }
          extra={
            <Button type="primary" onClick={this.handleReset}>
              Try again
            </Button>
          }
        />
      );
    }

    return this.props.children;
  }
}

/**
 * Convenience wrapper for common widget-level error boundary usage.
 * Renders a compact inline error instead of a full-page Result.
 */
export function WidgetErrorBoundary({ children }: { children: ReactNode }) {
  return (
    <ErrorBoundary
      fallback={
        <div className="p-4 border border-red-200 rounded bg-red-50 text-red-700 text-sm">
          This widget failed to load. Please refresh the page.
        </div>
      }
    >
      {children}
    </ErrorBoundary>
  );
}
