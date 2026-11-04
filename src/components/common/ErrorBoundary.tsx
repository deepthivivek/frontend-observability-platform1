'use client';

import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface ErrorBoundaryProps {
  children: ReactNode;
  fallbackTitle?: string;
  fallbackMessage?: string;
  onReset?: () => void;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught rendering error:', error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
    if (this.props.onReset) {
      this.props.onReset();
    }
  };

  render() {
    if (this.state.hasError) {
      return (
        <div
          role="alert"
          aria-live="assertive"
          className="rounded-xl border border-red-900/50 bg-red-950/20 p-5 text-red-200 backdrop-blur-sm"
        >
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-lg bg-red-900/40 text-red-400">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-base text-red-200">
                {this.props.fallbackTitle || 'Component Rendering Exception'}
              </h3>
              <p className="mt-1 text-sm text-red-300/80">
                {this.props.fallbackMessage ||
                  this.state.error?.message ||
                  'An unexpected error occurred while rendering this module.'}
              </p>
              <button
                onClick={this.handleReset}
                className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-red-900/40 hover:bg-red-800/60 border border-red-700/50 text-red-100 transition-colors"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                Retry Component
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
