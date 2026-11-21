import { useCallback, useEffect, useState } from 'react';
import type {
  AutomationResponse,
  ConnectionStatus,
  Iteration,
  RegressionResponse,
  StoriesResponse,
} from '../shared/types';

export interface BugsMeta {
  ai: { running: boolean; model: string; installed: boolean; models: string[] };
  areas: string[];
  iterations: { path: string; isCurrent: boolean }[];
  mock: boolean;
}

export interface BasicWorkItem {
  id: number;
  title: string;
  type: string;
  areaPath: string;
  iterationPath: string;
}

export interface BugTemplate {
  id: string;
  name: string;
  fields: Record<string, string>;
  updatedAt: string;
}

export interface CreatedBug {
  validateOnly: boolean;
  id: number | null;
  title: string;
  url: string | null;
  attachments: number;
}

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
  automation: () => get<AutomationResponse>('/api/automation'),
  regression: () => get<RegressionResponse>('/api/regression'),
  bugsMeta: () => get<BugsMeta>('/api/bugs/meta'),
  workItemsBasic: (ids: number[]) => get<BasicWorkItem[]>(`/api/workitems/basic?ids=${ids.join(',')}`),
  bugTemplates: () => get<BugTemplate[]>('/api/bugs/templates'),
  saveBugTemplate: async (name: string, fields: Record<string, string>) => {
    const res = await fetch('/api/bugs/templates', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, fields }),
    });
    const body = await res.json().catch(() => null);
    if (!res.ok) throw new Error(body?.error ?? `Erro ${res.status}`);
    return body as BugTemplate;
  },
  deleteBugTemplate: async (id: string) => {
    const res = await fetch(`/api/bugs/templates/${encodeURIComponent(id)}`, { method: 'DELETE' });
    if (!res.ok) throw new Error(`Erro ${res.status}`);
  },
  createBug: async (payload: Record<string, unknown>) => {
    const res = await fetch('/api/bugs/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const body = await res.json().catch(() => null);
    if (!res.ok) throw new Error(body?.error ?? `Erro ${res.status}`);
    return body as CreatedBug;
  },
  /** Gera o bug em streaming: chama onText a cada pedaço recebido */
  generateBug: async (
    payload: { description: string; images: { name: string; dataUrl: string }[] },
    onText: (full: string) => void,
    signal: AbortSignal,
  ) => {
    const res = await fetch('/api/bugs/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal,
    });
    if (!res.ok || !res.body) {
      const body = await res.json().catch(() => null);
      throw new Error(body?.error ?? `Erro ${res.status}`);
    }
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let full = '';
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      full += decoder.decode(value, { stream: true });
      onText(full);
    }
    return full;
  },
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
