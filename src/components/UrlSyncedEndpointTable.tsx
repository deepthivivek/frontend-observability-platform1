'use client';

import React, { useCallback } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import type { EndpointRow } from '@/src/lib/metrics';
import {
  sanitizeSortDirection,
  sanitizeStatusFilter,
  type EndpointStatusFilter,
  type SortDirection,
} from '@/src/lib/filterEndpoints';
import { EndpointTable } from './EndpointTable';

export function UrlSyncedEndpointTable({
  endpoints,
}: {
  endpoints: readonly EndpointRow[];
}) {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();

  const query = searchParams.get('q') ?? '';
  const status = sanitizeStatusFilter(searchParams.get('status'));
  const sort = sanitizeSortDirection(searchParams.get('sort'));

  const updateUrlParams = useCallback(
    (updates: {
      q?: string;
      status?: EndpointStatusFilter;
      sort?: SortDirection;
    }) => {
      const params = new URLSearchParams(searchParams.toString());

      if (updates.q !== undefined) {
        if (updates.q.length > 0) {
          params.set('q', updates.q);
        } else {
          params.delete('q');
        }
      }

      if (updates.status !== undefined) {
        if (updates.status !== 'All') {
          params.set('status', updates.status);
        } else {
          params.delete('status');
        }
      }

      if (updates.sort !== undefined) {
        if (updates.sort !== 'none') {
          params.set('sort', updates.sort);
        } else {
          params.delete('sort');
        }
      }

      const qs = params.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [pathname, router, searchParams]
  );

  return (
    <EndpointTable
      endpoints={endpoints}
      query={query}
      status={status}
      sort={sort}
      onQueryChange={(q) => updateUrlParams({ q })}
      onStatusChange={(nextStatus) => updateUrlParams({ status: nextStatus })}
      onSortChange={(nextSort) => updateUrlParams({ sort: nextSort })}
      onResetFilters={() =>
        updateUrlParams({ q: '', status: 'All', sort: 'none' })
      }
    />
  );
}
