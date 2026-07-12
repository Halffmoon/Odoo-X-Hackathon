"use client";

/**
 * useApi — a tiny data-fetching hook over apiClient.
 *
 * Standardizes the loading / error / empty / refetch lifecycle every feature
 * screen needs, so pages don't hand-roll useEffect boilerplate. The fetcher is
 * given an AbortSignal; stale responses are discarded on unmount / re-run.
 */
import { useCallback, useEffect, useRef, useState } from "react";

import { ApiError } from "./api-client";

export interface ApiState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

export function useApi<T>(
  fetcher: (signal: AbortSignal) => Promise<T>,
  deps: unknown[] = [],
): ApiState<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  // Keep the latest fetcher without making it a dependency.
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  const refetch = useCallback(() => setTick((t) => t + 1), []);

  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    setLoading(true);
    setError(null);

    fetcherRef.current(controller.signal)
      .then((res) => {
        if (active) {
          setData(res);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (!active || controller.signal.aborted) return;
        setError(err instanceof ApiError ? err.message : "Something went wrong.");
        setLoading(false);
      });

    return () => {
      active = false;
      controller.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tick, ...deps]);

  return { data, loading, error, refetch };
}
