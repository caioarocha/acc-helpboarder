import { useCallback, useEffect, useState } from 'react';
import type { ConnectionStatus, Iteration, StoriesResponse } from '../shared/types';

async function get<T>(url: string): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url);
  } catch {
    throw new Error('Não foi possível falar com o servidor local. Ele está rodando (npm run dev)?');
  }
  const body = await res.json().catch(() => null);
  if (!res.ok) throw new Error(body?.error ?? `Erro ${res.status}`);
  return body as T;
}

export const api = {
  status: () => get<ConnectionStatus>('/api/status'),
  iterations: () => get<Iteration[]>('/api/iterations'),
  stories: (ids: number[]) => get<StoriesResponse>(`/api/stories?ids=${ids.join(',')}`),
  dashboard: (iteration: string) => get<StoriesResponse>(`/api/dashboard?iteration=${encodeURIComponent(iteration)}`),
};

export interface AsyncState<T> {
  data: T | null;
  error: string | null;
  loading: boolean;
  reload: () => void;
}

/** Executa uma chamada assíncrona sempre que `key` mudar. */
export function useAsync<T>(fn: () => Promise<T> | null, key: string): AsyncState<T> {
  const [state, setState] = useState<{ data: T | null; error: string | null; loading: boolean }>({
    data: null,
    error: null,
    loading: true,
  });
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let alive = true;
    const p = fn();
    if (!p) {
      setState({ data: null, error: null, loading: false });
      return;
    }
    setState((s) => ({ ...s, loading: true, error: null }));
    p.then((data) => alive && setState({ data, error: null, loading: false })).catch(
      (e: Error) => alive && setState((s) => ({ ...s, error: e.message, loading: false })),
    );
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, tick]);

  const reload = useCallback(() => setTick((t) => t + 1), []);
  return { ...state, reload };
}

export function parseIds(text: string): number[] {
  return [
    ...new Set(
      text
        .split(/[\s,;]+/)
        .map((s) => Number(s.replace('#', '')))
        .filter((n) => Number.isInteger(n) && n > 0),
    ),
  ];
}
