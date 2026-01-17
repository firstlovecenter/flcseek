import { useCallback, useState, useRef, useEffect } from 'react';
import { api, type APIResponse } from '@/lib/api';

interface UseApiOptions<T> {
  immediate?: boolean;
  onSuccess?: (data: T) => void;
  onError?: (error: string) => void;
}

interface UseApiResult<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  execute: (...args: any[]) => Promise<APIResponse<T>>;
  reset: () => void;
}

/**
 * Hook for making API calls with loading and error state management
 * 
 * @example
 * const { data, loading, error, execute } = useApi(
 *   () => api.people.list({ include: 'progress' }),
 *   { immediate: true }
 * );
 * 
 * @example
 * const { execute: createPerson } = useApi(
 *   (person) => api.people.create(person),
 *   { onSuccess: () => refetch() }
 * );
 */
export function useApi<T = any>(
  apiCall: (...args: any[]) => Promise<APIResponse<T>>,
  options: UseApiOptions<T> = {}
): UseApiResult<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(options.immediate ?? false);
  const [error, setError] = useState<string | null>(null);
  const mountedRef = useRef(true);

  const execute = useCallback(async (...args: any[]) => {
    setLoading(true);
    setError(null);

    try {
      const response = await apiCall(...args);

      if (!mountedRef.current) return response;

      if (response.success && response.data) {
        setData(response.data as T);
        options.onSuccess?.(response.data as T);
      } else if (response.error) {
        const errorMessage = response.error.message;
        setError(errorMessage);
        options.onError?.(errorMessage);
      }

      return response;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      if (mountedRef.current) {
        setError(errorMessage);
        options.onError?.(errorMessage);
      }
      return {
        success: false,
        error: { code: 'UNKNOWN_ERROR', message: errorMessage },
      };
    } finally {
      if (mountedRef.current) {
        setLoading(false);
      }
    }
  }, [apiCall, options.onSuccess, options.onError]);

  const reset = useCallback(() => {
    setData(null);
    setError(null);
    setLoading(false);
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    
    if (options.immediate) {
      execute();
    }

    return () => {
      mountedRef.current = false;
    };
  }, [options.immediate]); // execute is intentionally excluded to prevent re-fetching on every render

  return { data, loading, error, execute, reset };
}

/**
 * Hook for list queries with pagination and filtering support
 */
export function useApiList<T = any>(
  listFn: (params: any) => Promise<APIResponse<{ [key: string]: T[] }>>,
  options: UseApiOptions<T[]> & {
    dataKey?: string;
    defaultParams?: Record<string, any>;
  } = {}
) {
  const { dataKey = 'items', defaultParams = {}, ...apiOptions } = options;
  const [params, setParams] = useState(defaultParams);
  const [items, setItems] = useState<T[]>([]);
  const [meta, setMeta] = useState<{ total?: number; hasMore?: boolean }>({});

  const { loading, error, execute, reset } = useApi(
    (queryParams) => listFn({ ...params, ...queryParams }),
    {
      ...apiOptions,
      onSuccess: (data) => {
        const list = data?.[dataKey] || [];
        setItems(list);
        apiOptions.onSuccess?.(list);
      },
    }
  );

  const fetch = useCallback((queryParams?: Record<string, any>) => {
    if (queryParams) {
      setParams((prev) => ({ ...prev, ...queryParams }));
    }
    return execute(queryParams);
  }, [execute]);

  const refetch = useCallback(() => execute({}), [execute]);

  return {
    items,
    loading,
    error,
    meta,
    params,
    fetch,
    refetch,
    reset,
    setParams,
  };
}

/**
 * Hook for mutation operations (create, update, delete)
 */
export function useApiMutation<TInput = any, TOutput = any>(
  mutationFn: (input: TInput) => Promise<APIResponse<TOutput>>,
  options: UseApiOptions<TOutput> = {}
) {
  const [isSubmitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [result, setResult] = useState<TOutput | null>(null);

  const mutate = useCallback(async (input: TInput) => {
    setSubmitting(true);
    setSubmitError(null);

    try {
      const response = await mutationFn(input);

      if (response.success && response.data) {
        setResult(response.data);
        options.onSuccess?.(response.data);
      } else if (response.error) {
        setSubmitError(response.error.message);
        options.onError?.(response.error.message);
      }

      return response;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setSubmitError(errorMessage);
      options.onError?.(errorMessage);
      return {
        success: false,
        error: { code: 'UNKNOWN_ERROR', message: errorMessage },
      };
    } finally {
      setSubmitting(false);
    }
  }, [mutationFn, options.onSuccess, options.onError]);

  const reset = useCallback(() => {
    setSubmitError(null);
    setResult(null);
    setSubmitting(false);
  }, []);

  return {
    mutate,
    isSubmitting,
    submitError,
    result,
    reset,
  };
}

// Export pre-configured API hooks
export const useApiHooks = {
  // People
  usePeople: (params?: Parameters<typeof api.people.list>[0]) =>
    useApi(() => api.people.list(params), { immediate: true }),

  usePerson: (id: string) =>
    useApi(() => api.people.get(id), { immediate: !!id }),

  useCreatePerson: (options?: UseApiOptions<any>) =>
    useApiMutation((data) => api.people.create(data), options),

  // Groups
  useGroups: (params?: Parameters<typeof api.groups.list>[0]) =>
    useApi(() => api.groups.list(params), { immediate: true }),

  useGroup: (id: string) =>
    useApi(() => api.groups.get(id), { immediate: !!id }),

  // Users
  useUsers: (params?: Parameters<typeof api.users.list>[0]) =>
    useApi(() => api.users.list(params), { immediate: true }),

  useLeaders: () =>
    useApi(() => api.users.getLeaders(), { immediate: true }),

  // Stats
  useStats: (params?: Parameters<typeof api.stats.getDashboard>[0]) =>
    useApi(() => api.stats.getDashboard(params), { immediate: true }),

  // Milestones
  useMilestones: (includeInactive = false) =>
    useApi(() => api.milestones.list(includeInactive), { immediate: true }),
};
