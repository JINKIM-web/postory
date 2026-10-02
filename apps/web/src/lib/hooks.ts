import { useCallback, useEffect, useRef, useState, type DependencyList } from "react";
import { subscribe, type StoreName } from "./db";

// IndexedDB를 읽고, 관련 저장소가 바뀌면 다시 읽는다.
export function useLive<T>(load: () => Promise<T>, deps: DependencyList, stores?: StoreName[]): { data: T | undefined; loading: boolean; reload: () => void } {
  const [data, setData] = useState<T>();
  const [loading, setLoading] = useState(true);
  const loadRef = useRef(load);
  loadRef.current = load;
  const seq = useRef(0);

  const reload = useCallback(() => {
    const n = ++seq.current;
    loadRef
      .current()
      .then((value) => {
        if (n === seq.current) setData(value);
      })
      .catch((err) => console.error(err))
      .finally(() => {
        if (n === seq.current) setLoading(false);
      });
  }, []);

  useEffect(() => {
    setLoading(true);
    reload();
    return subscribe((changed) => {
      if (!stores || changed.some((s) => stores.includes(s))) reload();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return { data, loading, reload };
}

// Blob → object URL (언마운트 시 해제)
export function useObjectUrl(blob: Blob | null | undefined): string | null {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!blob) {
      setUrl(null);
      return;
    }
    const u = URL.createObjectURL(blob);
    setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [blob]);
  return url;
}

export function useDebouncedCallback<A extends unknown[]>(fn: (...args: A) => void, ms: number): ((...args: A) => void) & { flush: () => void } {
  const fnRef = useRef(fn);
  fnRef.current = fn;
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pending = useRef<A | null>(null);

  const flush = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    if (pending.current) {
      const args = pending.current;
      pending.current = null;
      fnRef.current(...args);
    }
  }, []);

  useEffect(() => flush, [flush]);

  const debounced = useCallback(
    (...args: A) => {
      pending.current = args;
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(flush, ms);
    },
    [flush, ms],
  ) as ((...args: A) => void) & { flush: () => void };
  debounced.flush = flush;
  return debounced;
}
