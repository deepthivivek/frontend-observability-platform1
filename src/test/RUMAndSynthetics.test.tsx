import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, renderHook, act } from '@testing-library/react';
import { useSessionTelemetry } from '../hooks/useSessionTelemetry';
import { SessionReplayViewer } from '../components/rum/SessionReplayViewer';
import { ExceptionTracker } from '../components/rum/ExceptionTracker';
import { WebVitalsTracker } from '../components/rum/WebVitalsTracker';
import { SyntheticMonitors } from '../components/rum/SyntheticMonitors';
import { RumSyntheticsView } from '../components/rum/RumSyntheticsView';
import {
  SEED_RUM_SESSIONS,
  SEED_EXCEPTIONS,
  SEED_SYNTHETIC_MONITORS,
} from '../utils/rumSyntheticData';

describe('RUM & Synthetics Suite (Day 9)', () => {
  describe('useSessionTelemetry Hook', () => {
    it('initializes with default session and playback state', () => {
      const { result } = renderHook(() => useSessionTelemetry());

      expect(result.current.selectedSession).toBeDefined();
      expect(result.current.selectedSession.id).toBe(SEED_RUM_SESSIONS[0].id);
      expect(result.current.isPlaying).toBe(false);
      expect(result.current.playbackSpeed).toBe(1);
      expect(result.current.skipInactivity).toBe(true);
      expect(result.current.syntheticMonitors.length).toBeGreaterThan(0);
      expect(result.current.exceptions.length).toBeGreaterThan(0);
    });

    it('allows changing active session and updating time position', () => {
      const { result } = renderHook(() => useSessionTelemetry());

      act(() => {
        result.current.onSelectSession(SEED_RUM_SESSIONS[1].id);
      });

      expect(result.current.selectedSession.id).toBe(SEED_RUM_SESSIONS[1].id);

      act(() => {
        result.current.setPlaybackPositionMs(5000);
      });

      expect(result.current.playbackPositionMs).toBe(5000);
    });

    it('toggles playback, speed multipliers, and executes synthetic monitor simulation', () => {
      const { result } = renderHook(() => useSessionTelemetry());

      act(() => {
        result.current.togglePlay();
      });
      expect(result.current.isPlaying).toBe(true);

      act(() => {
        result.current.setPlaybackSpeed(4);
      });
      expect(result.current.playbackSpeed).toBe(4);

      act(() => {
        result.current.toggleSkipInactivity();
      });
      expect(result.current.skipInactivity).toBe(false);

      const monitorId = result.current.syntheticMonitors[0].id;
      act(() => {
        result.current.runSyntheticMonitor(monitorId);
      });
      const updated = result.current.syntheticMonitors.find((m) => m.id === monitorId);
      expect(updated?.status).toBe('passing');
    });
  });

  describe('SessionReplayViewer Component', () => {
    const mockSession = SEED_RUM_SESSIONS[0]; // usr_enterprise_882 (has rage clicks & 504)

    it('renders session header, frustration score, and rage click warning', () => {
      render(
        <SessionReplayViewer
          session={mockSession}
          playbackPositionMs={10200}
          onSeek={vi.fn()}
          isPlaying={false}
          onTogglePlay={vi.fn()}
          speed={1}
          onSpeedChange={vi.fn()}
          skipInactivity={true}
          onToggleSkipInactivity={vi.fn()}
          onInspectTrace={vi.fn()}
        />
      );

      expect(screen.getByText(/Session Frustration Score:/i)).toBeInTheDocument();
      expect(screen.getByText(/88\/100/i)).toBeInTheDocument();
      expect(screen.getByText(/6 Rage Clicks/i)).toBeInTheDocument();
      expect(screen.getByText(/2 Dead Clicks/i)).toBeInTheDocument();
      expect(screen.getByText(/dev.lead@fintech-corp.com/i)).toBeInTheDocument();
    });

    it('fires playback control callbacks on user actions', () => {
      const togglePlay = vi.fn();
      const onSpeedChange = vi.fn();
      const toggleSkip = vi.fn();

      render(
        <SessionReplayViewer
          session={mockSession}
          playbackPositionMs={10200}
          onSeek={vi.fn()}
          isPlaying={false}
          onTogglePlay={togglePlay}
          speed={1}
          onSpeedChange={onSpeedChange}
          skipInactivity={true}
          onToggleSkipInactivity={toggleSkip}
          onInspectTrace={vi.fn()}
        />
      );

      const playBtn = screen.getByRole('button', { name: /Play Replay/i });
      fireEvent.click(playBtn);
      expect(togglePlay).toHaveBeenCalledTimes(1);

      const speedBtn4x = screen.getByRole('button', { name: '4x' });
      fireEvent.click(speedBtn4x);
      expect(onSpeedChange).toHaveBeenCalledWith(4);

      const skipBtn = screen.getByRole('button', { name: /Skip Inactivity/i });
      fireEvent.click(skipBtn);
      expect(toggleSkip).toHaveBeenCalledTimes(1);
    });

    it('invokes onInspectTrace when clicking correlated trace button', () => {
      const inspectTrace = vi.fn();

      render(
        <SessionReplayViewer
          session={mockSession}
          playbackPositionMs={10200}
          onSeek={vi.fn()}
          isPlaying={false}
          onTogglePlay={vi.fn()}
          speed={1}
          onSpeedChange={vi.fn()}
          skipInactivity={true}
          onToggleSkipInactivity={vi.fn()}
          onInspectTrace={inspectTrace}
        />
      );

      const traceBtn = screen.getByRole('button', { name: /Inspect Correlated Trace/i });
      fireEvent.click(traceBtn);
      expect(inspectTrace).toHaveBeenCalledWith(mockSession.correlatedTraceId);
    });
  });

  describe('ExceptionTracker Component', () => {
    it('displays exception groups, unminified stack traces, and code snippet', () => {
      render(
        <ExceptionTracker
          exceptions={SEED_EXCEPTIONS}
          activeSession={SEED_RUM_SESSIONS[0]}
          onInspectTrace={vi.fn()}
        />
      );

      expect(screen.getAllByText(/Cannot read properties of undefined \(reading 'cartToken'\)/i).length).toBeGreaterThan(0);
      expect(screen.getByText(/Source-Mapped TypeScript Stack Trace/i)).toBeInTheDocument();
      expect(screen.getByText(/CheckoutModal.tsx:112/i)).toBeInTheDocument();
      expect(screen.getByText(/Client-Side Memory Leak Profiler/i)).toBeInTheDocument();
    });

    it('copies stack trace to clipboard when clicking copy button', () => {
      const writeTextMock = vi.fn().mockResolvedValue(undefined);
      Object.assign(navigator, {
        clipboard: {
          writeText: writeTextMock,
        },
      });

      render(
        <ExceptionTracker
          exceptions={SEED_EXCEPTIONS}
          activeSession={SEED_RUM_SESSIONS[0]}
          onInspectTrace={vi.fn()}
        />
      );

      const copyBtn = screen.getByRole('button', { name: /Copy Stack/i });
      fireEvent.click(copyBtn);
      expect(writeTextMock).toHaveBeenCalled();
    });
  });

  describe('WebVitalsTracker Component', () => {
    it('renders all Core Web Vitals scorecards with ratings and breakdown', () => {
      render(
        <WebVitalsTracker
          sessions={SEED_RUM_SESSIONS}
          activeSession={SEED_RUM_SESSIONS[0]}
          onSelectSession={vi.fn()}
          onInspectTrace={vi.fn()}
        />
      );

      expect(screen.getByText(/LCP \(P75\)/i)).toBeInTheDocument();
      expect(screen.getByText(/INP \(P75\)/i)).toBeInTheDocument();
      expect(screen.getByText(/CLS \(P75\)/i)).toBeInTheDocument();
      expect(screen.getByText(/FCP \(P75\)/i)).toBeInTheDocument();
      expect(screen.getByText(/TTFB \(P75\)/i)).toBeInTheDocument();

      expect(screen.getByText(/Network-to-RUM Attribution & Long Animation Frames/i)).toBeInTheDocument();
      expect(screen.getByText(/Real User Outlier Clustering Matrix/i)).toBeInTheDocument();
    });
  });

  describe('SyntheticMonitors Component', () => {
    it('renders synthetic canary suites with multi-region latency map and run simulation', () => {
      const onRunMock = vi.fn();

      render(
        <SyntheticMonitors
          monitors={SEED_SYNTHETIC_MONITORS}
          onRunMonitor={onRunMock}
          onInspectTrace={vi.fn()}
        />
      );

      expect(screen.getByText(/Active Synthetic Probes/i)).toBeInTheDocument();
      expect(screen.getAllByText(/Critical E-Commerce Checkout Flow/i).length).toBeGreaterThan(0);
      expect(screen.getByText(/US-East \(N. Virginia\)/i)).toBeInTheDocument();
      expect(screen.getByText(/EU-Central \(Frankfurt\)/i)).toBeInTheDocument();
      expect(screen.getByText(/AP-South \(Singapore\)/i)).toBeInTheDocument();

      const runButtons = screen.getAllByRole('button', { name: /Run Now/i });
      fireEvent.click(runButtons[0]);
    });
  });

  describe('RumSyntheticsView Top-Level Container', () => {
    it('renders and supports tab switching between Replay, Exceptions, Web Vitals, and Synthetics', () => {
      render(<RumSyntheticsView onInspectTrace={vi.fn()} />);

      // Default tab is Session Replay
      expect(screen.getByRole('button', { name: /Session Replay & Rage-Clicks/i })).toBeInTheDocument();
      expect(screen.getAllByText(/dev.lead@fintech-corp.com/i).length).toBeGreaterThan(0);

      // Switch to Source Maps & Memory Profiler tab
      const exceptionsTab = screen.getByRole('button', { name: /Source Maps & Memory Profiler/i });
      fireEvent.click(exceptionsTab);
      expect(screen.getByText(/Source-Mapped TypeScript Stack Trace/i)).toBeInTheDocument();

      // Switch to Web Vitals tab
      const vitalsTab = screen.getByRole('button', { name: /Core Web Vitals & Outliers/i });
      fireEvent.click(vitalsTab);
      expect(screen.getByText(/LCP \(P75\)/i)).toBeInTheDocument();

      // Switch to Synthetic Canaries tab
      const syntheticsTab = screen.getByRole('button', { name: /Synthetic Monitoring Canaries/i });
      fireEvent.click(syntheticsTab);
      expect(screen.getByText(/Active Synthetic Probes/i)).toBeInTheDocument();
    });
  });
});
