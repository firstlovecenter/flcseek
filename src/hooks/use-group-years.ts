'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import type { GroupApiData } from '@/lib/types/api-responses';

export interface GroupYears {
  /** The month name of the current group (e.g. "January"). */
  groupName: string;
  /** All years that have a group with the same month name, newest first. */
  availableYears: number[];
  /** The current group's year, used as the default selection. */
  defaultYear: number | null;
  loading: boolean;
  error: string | null;
}

/**
 * Resolves the set of years available for a group's month name.
 *
 * This logic was previously copy-pasted across the group home, attendance and
 * reports pages (each re-fetching `groups.list({ active: true })` and deriving
 * the month's years). Centralizing it removes the duplication and benefits from
 * the API client's shared GET cache / in-flight dedupe.
 */
export function useGroupYears(groupId: string | undefined, enabled = true): GroupYears {
  const [groupName, setGroupName] = useState('');
  const [availableYears, setAvailableYears] = useState<number[]>([]);
  const [defaultYear, setDefaultYear] = useState<number | null>(null);
  const [loading, setLoading] = useState<boolean>(enabled);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled || !groupId) return;
    let cancelled = false;

    (async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await api.groups.list({ active: true });
        if (cancelled) return;

        if (response.success && response.data) {
          const groups: GroupApiData[] = (response.data.groups as GroupApiData[]) || [];
          const selectedGroup = groups.find((g) => g.id === groupId);
          if (!selectedGroup) {
            throw new Error('Group not found');
          }

          const monthName = selectedGroup.name;
          const matching = groups.filter(
            (g) => g.name.toLowerCase() === monthName.toLowerCase()
          );
          const years = Array.from(new Set(matching.map((g) => g.year))).sort(
            (a, b) => b - a
          );

          setGroupName(monthName);
          setAvailableYears(years);
          setDefaultYear(selectedGroup.year ?? years[0] ?? null);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load group data');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [groupId, enabled]);

  return { groupName, availableYears, defaultYear, loading, error };
}
