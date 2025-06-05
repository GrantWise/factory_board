'use client';

import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';

interface UseApiDataOptions<T> {
  initialData?: T;
  onError?: (error: any) => void;
  autoRefresh?: number; // milliseconds
}

interface UseApiDataReturn<T> {
  data: T | null;
  isLoading: boolean;
  error: any;
  refetch: () => Promise<void>;
  setData: (data: T | null) => void;
}

export function useApiData<T>(
  apiCall: () => Promise<T>,
  dependencies: any[] = [],
  options: UseApiDataOptions<T> = {}
): UseApiDataReturn<T> {
  const [data, setData] = useState<T | null>(options.initialData || null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<any>(null);

  const fetchData = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const result = await apiCall();
      setData(result);
    } catch (err: any) {
      setError(err);
      
      // Handle auth errors silently - don't spam console/toast
      if (err.status === 401 || err.status === 429) {
        // Auth required or rate limited - fail silently
        return;
      }
      
      console.error('API call failed:', err);
      
      if (options.onError) {
        options.onError(err);
      } else if (err.status !== 0) { // Don't show toast for network errors during development
        toast.error(err.error || 'Failed to fetch data');
      }
    } finally {
      setIsLoading(false);
    }
  }, dependencies);

  const refetch = useCallback(async () => {
    await fetchData();
  }, [fetchData]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Auto-refresh functionality
  useEffect(() => {
    if (options.autoRefresh && options.autoRefresh > 0) {
      const interval = setInterval(() => {
        fetchData();
      }, options.autoRefresh);

      return () => clearInterval(interval);
    }
  }, [fetchData, options.autoRefresh]);

  return {
    data,
    isLoading,
    error,
    refetch,
    setData,
  };
}