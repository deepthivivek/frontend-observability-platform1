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
          className="rounded-2xl border border-rose-500/40 bg-[#1E1724]/90 p-5 text-rose-200 backdrop-blur-xl shadow-[0_0_30px_rgba(244,63,94,0.18)]"
        >
          <div className="flex items-start gap-3.5">
            <div className="p-2.5 rounded-xl bg-rose-500/15 text-rose-400 border border-rose-500/30 shadow-[0_0_12px_rgba(244,63,94,0.2)]">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-base text-white">
                {this.props.fallbackTitle || 'Component Rendering Exception'}
              </h3>
              <p className="mt-1 text-sm text-rose-300/80">
                {this.props.fallbackMessage ||
                  this.state.error?.message ||
                  'An unexpected error occurred while rendering this module.'}
              </p>
              <button
                onClick={this.handleReset}
                className="mt-3.5 inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono font-medium rounded-lg bg-rose-500/20 hover:bg-rose-500/30 border border-rose-500/40 text-rose-100 transition-colors shadow-[0_0_10px_rgba(244,63,94,0.2)]"
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
