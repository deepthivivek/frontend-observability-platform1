'use client';

import { useState, useEffect, useCallback } from 'react';
import { DensityMode, TimezoneMode, TimeRangePreset } from '../types/telemetry';

export interface UserPreferences {
  density: DensityMode;
  timezone: TimezoneMode;
  timeRange: TimeRangePreset;
  liveMode: boolean;
  refreshIntervalSec: number;
}

const DEFAULT_PREFERENCES: UserPreferences = {
  density: 'comfortable',
  timezone: 'local',
  timeRange: '1h',
  liveMode: true,
  refreshIntervalSec: 5,
};

const STORAGE_KEY = 'observability_user_preferences_v1';

export function useUserPreferences() {
  const [preferences, setPreferences] = useState<UserPreferences>(DEFAULT_PREFERENCES);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        Promise.resolve().then(() => {
          setPreferences((prev) => ({ ...prev, ...parsed }));
          setIsLoaded(true);
        });
        return;
      }
    } catch (e) {
      console.warn('Could not read user preferences from localStorage', e);
    }
    Promise.resolve().then(() => setIsLoaded(true));
  }, []);

  const updatePreference = useCallback(<K extends keyof UserPreferences>(key: K, value: UserPreferences[K]) => {
    setPreferences(prev => {
      const next = { ...prev, [key]: value };
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch (e) {
        console.warn('Could not save preference to localStorage', e);
      }
      return next;
    });
  }, []);

  const toggleDensity = useCallback(() => {
    updatePreference('density', preferences.density === 'comfortable' ? 'compact' : 'comfortable');
  }, [preferences.density, updatePreference]);

  const toggleLiveMode = useCallback(() => {
    updatePreference('liveMode', !preferences.liveMode);
  }, [preferences.liveMode, updatePreference]);

  return {
    preferences,
    isLoaded,
    updatePreference,
    toggleDensity,
    toggleLiveMode,
  };
}
