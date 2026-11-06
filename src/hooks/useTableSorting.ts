'use client';

import { useState, useMemo, useCallback } from 'react';
import { ApiRequestLog } from '../types/telemetry';

export type SortField = 'timestamp' | 'endpoint' | 'statusCode' | 'latencyMs' | 'method';
export type SortDirection = 'asc' | 'desc';

export interface SortConfig {
  field: SortField;
  direction: SortDirection;
}

export function useTableSorting(initialField: SortField = 'timestamp', initialDirection: SortDirection = 'desc') {
  const [sortConfig, setSortConfig] = useState<SortConfig>({
    field: initialField,
    direction: initialDirection,
  });

  const toggleSort = useCallback((field: SortField) => {
    setSortConfig((prev) => {
      if (prev.field === field) {
        return {
          field,
          direction: prev.direction === 'asc' ? 'desc' : 'asc',
        };
      }
      return {
        field,
        direction: field === 'timestamp' || field === 'latencyMs' || field === 'statusCode' ? 'desc' : 'asc',
      };
    });
  }, []);

  const sortLogs = useCallback((logs: ApiRequestLog[]): ApiRequestLog[] => {
    if (!logs || logs.length === 0) return [];
    const { field, direction } = sortConfig;
    const modifier = direction === 'asc' ? 1 : -1;

    return [...logs].sort((a, b) => {
      if (field === 'timestamp') {
        return (a.timestamp - b.timestamp) * modifier;
      }
      if (field === 'statusCode') {
        return (a.statusCode - b.statusCode) * modifier;
      }
      if (field === 'latencyMs') {
        return (a.latencyMs - b.latencyMs) * modifier;
      }
      if (field === 'endpoint') {
        return a.endpoint.localeCompare(b.endpoint) * modifier;
      }
      if (field === 'method') {
        return a.method.localeCompare(b.method) * modifier;
      }
      return 0;
    });
  }, [sortConfig]);

  return {
    sortConfig,
    toggleSort,
    sortLogs,
  };
}
