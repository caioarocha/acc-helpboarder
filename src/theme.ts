import type { Health, StateKey } from '../shared/types';

/** Paleta do projeto */
export const PALETTE = {
  p950: '#10002B',
  p900: '#240046',
  p800: '#3C096C',
  p700: '#5A189A',
  p600: '#7B2CBF',
  p500: '#9D4EDD',
  p400: '#C77DFF',
  p300: '#E0AAFF',
  text: '#F7EEFF',
  muted: '#CDB3EA',
  subtle: '#9C7FC2',
  grid: 'rgba(224,170,255,0.10)',
};

/** Cores de status (escolhidas para contrastar com o fundo roxo) */
export const STATES: { key: Exclude<StateKey, 'cancelled' | 'other'>; label: string; color: string }[] = [
  { key: 'passed', label: 'Passed', color: '#4ADE80' },
  { key: 'failed', label: 'Failed', color: '#FB7185' },
  { key: 'blocked', label: 'Blocked', color: '#FBBF24' },
  { key: 'inProgress', label: 'In Progress', color: '#60A5FA' },
  { key: 'ready', label: 'Ready', color: '#94A3B8' },
  { key: 'new', label: 'New', color: '#CBD5E1' },
];

export const STATE_COLOR: Record<StateKey, string> = {
  passed: '#4ADE80',
  failed: '#FB7185',
  blocked: '#FBBF24',
  inProgress: '#60A5FA',
  ready: '#94A3B8',
  new: '#CBD5E1',
  cancelled: '#6B5B85',
  other: '#6B5B85',
};

export const MODE_COLOR = {
  Automatic: PALETTE.p400,
  Manual: 'rgba(224,170,255,0.25)',
  Unknown: '#6B5B85',
};

export const HEALTH_META: Record<Health, { label: string; tone: string }> = {
  saudavel: { label: 'Saudável', tone: 'ok' },
  atencao: { label: 'Atenção', tone: 'warn' },
  critica: { label: 'Crítica', tone: 'bad' },
  'nao-executada': { label: 'Não executada', tone: 'info' },
  'sem-testes': { label: 'Sem testes', tone: 'neutral' },
};

export const fmtPct = (v: number | null | undefined) => (v == null ? '—' : `${Math.round(v * 100)}%`);

/** Percentual com 2 casas decimais (ex.: 70,59%) */
export const fmtPct2 = (v: number | null | undefined) =>
  v == null
    ? '—'
    : `${(v * 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`;

export const fmtDateTime = (iso: string | null | undefined) =>
  iso
    ? new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
    : '—';

export const fmtDate =(iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleDateString('pt-BR', { timeZone: 'UTC' }) : '—';

export const approvalTone = (v: number | null) => (v == null ? 'neutral' : v >= 0.9 ? 'ok' : v >= 0.6 ? 'warn' : 'bad');
