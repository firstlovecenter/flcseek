import { useState, useEffect, useCallback, useRef } from 'react';

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

// Simple in-memory cache
const cache = new Map<string, CacheEntry<any>>();
const CACHE_TTL = 30000; // 30 seconds

interface UseFetchOptions {
  enabled?: boolean;
  cacheTime?: number;
  refetchInterval?: number;
}

export function useFetch<T>(
  url: string | null,
  token: string | null,
  options: UseFetchOptions = {}
) {
  const { enabled = true, cacheTime = CACHE_TTL, refetchInterval } = options;
  
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);
  
  const abortControllerRef = useRef<AbortController | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const fetchData = useCallback(async (forceRefresh = false) => {
    if (!url || !token || !enabled) {
      setLoading(false);
      return;
    }

    // Check cache first
    if (!forceRefresh) {
      const cached = cache.get(url);
      if (cached && Date.now() - cached.timestamp < cacheTime) {
        setData(cached.data);
        setLoading(false);
        setError(null);
        return;
      }
    }

    // Cancel previous request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      setLoading(true);
      setError(null);

      const response = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      
      // Update cache
      cache.set(url, { data: result, timestamp: Date.now() });
      
      setData(result);
    } catch (err: any) {
      if (err.name === 'AbortError') {
        // Request was aborted, ignore
        return;
      }
      setError(err);
    } finally {
      setLoading(false);
    }
  }, [url, token, enabled, cacheTime]);

  useEffect(() => {
    fetchData();

    // Set up auto-refetch if interval is specified
    if (refetchInterval && refetchInterval > 0) {
      intervalRef.current = setInterval(() => {
        fetchData(true);
      }, refetchInterval);
    }

    return () => {
      // Cleanup
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [fetchData, refetchInterval]);

  const refetch = useCallback(() => {
    return fetchData(true);
  }, [fetchData]);

  const mutate = useCallback((newData: T) => {
    if (url) {
      cache.set(url, { data: newData, timestamp: Date.now() });
      setData(newData);
    }
  }, [url]);

  return { data, loading, error, refetch, mutate };
}

// Hook for fetching people with stats
export function usePeopleWithStats(
  token: string | null,
  filters?: { group_id?: string; group?: string; month?: string; limit?: number; offset?: number }
) {
  const queryParams = new URLSearchParams();
  if (filters?.group_id) queryParams.set('group_id', filters.group_id);
  if (filters?.group) queryParams.set('group', filters.group);
  if (filters?.month) queryParams.set('month', filters.month);
  if (filters?.limit) queryParams.set('limit', filters.limit.toString());
  if (filters?.offset) queryParams.set('offset', filters.offset.toString());

  const url = token ? `/api/people/with-stats${queryParams.toString() ? '?' + queryParams.toString() : ''}` : null;

  return useFetch<{ people: any[]; total: number; has_more: boolean }>(url, token, {
    cacheTime: 15000, // 15 seconds cache
  });
}

// Hook for fetching person details
export function usePersonDetails(token: string | null, personId: string | null) {
  const url = token && personId ? `/api/people/${personId}` : null;
  
  return useFetch<{
    person: any;
    progress: any[];
    attendance: any[];
    attendanceCount: number;
  }>(url, token, {
    cacheTime: 10000, // 10 seconds cache
  });
}

// Hook for fetching department summary
export function useDepartmentSummary(token: string | null) {
  const url = token ? '/api/departments/summary' : null;
  
  return useFetch<{ summary: any[] }>(url, token, {
    cacheTime: 30000, // 30 seconds cache
  });
}

// Clear cache function (useful after mutations)
export function clearCache(pattern?: string) {
  if (pattern) {
    // Clear specific entries
    const keysToDelete: string[] = [];
    cache.forEach((_, key) => {
      if (key.includes(pattern)) {
        keysToDelete.push(key);
      }
    });
    keysToDelete.forEach(key => cache.delete(key));
  } else {
    // Clear all cache
    cache.clear();
  }
}
