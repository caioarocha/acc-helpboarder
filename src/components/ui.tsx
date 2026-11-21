import type { ReactNode } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  CircleDashed,
  MinusCircle,
  RotateCw,
  XCircle,
} from 'lucide-react';
import type { Health, StateCounts, StateKey } from '../../shared/types';
import { HEALTH_META, STATES, STATE_COLOR, approvalTone, fmtPct } from '../theme';

export function Card({ title, extra, children, className = '' }: { title?: ReactNode; extra?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`card ${className}`}>
      {(title || extra) && (
        <div className="card-head">
          {title && <h3>{title}</h3>}
          {extra}
        </div>
      )}
      {children}
    </section>
  );
}

export function KpiCard({ icon, value, label, hint, tone }: { icon: ReactNode; value: ReactNode; label: string; hint?: ReactNode; tone: string }) {
  return (
    <div className={`card kpi tone-${tone}`}>
      <div className="kpi-icon">{icon}</div>
      <div className="kpi-body">
        <div className="kpi-value">{value}</div>
        <div className="kpi-label">{label}</div>
        {hint && <div className="kpi-hint">{hint}</div>}
      </div>
    </div>
  );
}

const HEALTH_ICON: Record<Health, typeof CheckCircle2> = {
  saudavel: CheckCircle2,
  atencao: AlertTriangle,
  critica: XCircle,
  'nao-executada': CircleDashed,
  'sem-testes': MinusCircle,
};

export function HealthBadge({ health }: { health: Health }) {
  const meta = HEALTH_META[health];
  const Icon = HEALTH_ICON[health];
  return (
    <span className={`badge tone-${meta.tone}`}>
      <Icon size={14} />
      {meta.label}
    </span>
  );
}

export function StateBadge({ state, stateKey }: { state: string; stateKey: StateKey }) {
  return (
    <span className="state-badge" style={{ color: STATE_COLOR[stateKey], borderColor: STATE_COLOR[stateKey] }}>
      {state || '—'}
    </span>
  );
}

export function ApprovalBar({ rate }: { rate: number | null }) {
  if (rate == null) return <span className="muted">—</span>;
  return (
    <div className={`approval tone-${approvalTone(rate)}`}>
      <span>{fmtPct(rate)}</span>
      <div className="approval-track">
        <div className="approval-fill" style={{ width: `${Math.round(rate * 100)}%` }} />
      </div>
    </div>
  );
}

/** Barra empilhada com os states dos testes */
export function StackedBar({ counts, total }: { counts: StateCounts; total: number }) {
  if (!total) return <div className="stacked empty">Sem testes</div>;
  return (
    <div className="stacked">
      {STATES.map((s) => {
        const v = counts[s.key];
        if (!v) return null;
        const pct = (v / total) * 100;
        return (
          <div key={s.key} className="stacked-seg" style={{ width: `${pct}%`, background: s.color }} title={`${s.label}: ${v}`}>
            {pct >= 9 ? `${Math.round(pct)}%` : ''}
          </div>
        );
      })}
    </div>
  );
}

export function StateLegendList({ counts, hideZero = false }: { counts: StateCounts; hideZero?: boolean }) {
  return (
    <ul className="legend-list">
      {STATES.filter((s) => !hideZero || counts[s.key] > 0).map((s) => (
        <li key={s.key}>
          <span className="swatch" style={{ background: s.color }} />
          {s.label}
          <b>{counts[s.key]}</b>
        </li>
      ))}
    </ul>
  );
}

export function IdLink({ id, url }: { id: number; url: string }) {
  if (!url) return <span className="id-link">#{id}</span>;
  return (
    <a className="id-link" href={url} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()}>
      #{id}
    </a>
  );
}

export function ErrorBox({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="card error-box">
      <XCircle size={20} />
      <div>
        <strong>Não foi possível carregar os dados</strong>
        <p>{message}</p>
      </div>
      {onRetry && (
        <button className="btn ghost" onClick={onRetry}>
          <RotateCw size={16} /> Tentar novamente
        </button>
      )}
    </div>
  );
}

export function Warnings({ items }: { items: string[] }) {
  if (!items.length) return null;
  return (
    <div className="warn-box">
      <AlertTriangle size={16} />
      <div>
        {items.map((w) => (
          <div key={w}>{w}</div>
        ))}
      </div>
    </div>
  );
}

/** Lista de páginas com reticências: 1 … 4 5 6 … 12 */
function pageList(current: number, total: number): (number | '…')[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const pages = new Set([1, total, current - 1, current, current + 1]);
  const sorted = [...pages].filter((p) => p >= 1 && p <= total).sort((a, b) => a - b);
  const out: (number | '…')[] = [];
  sorted.forEach((p, i) => {
    if (i > 0 && p - sorted[i - 1] > 1) out.push('…');
    out.push(p);
  });
  return out;
}

/** Rodapé de tabela com paginação */
export function Pagination({
  page,
  pageSize,
  total,
  noun,
  onChange,
}: {
  page: number;
  pageSize: number;
  total: number;
  noun: string;
  onChange: (page: number) => void;
}) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const from = total ? (page - 1) * pageSize + 1 : 0;
  const to = Math.min(total, page * pageSize);
  return (
    <div className="table-foot">
      <span className="muted small">
        {from}–{to} de {total} {noun}
      </span>
      {pages > 1 && (
        <nav className="pager" aria-label="Paginação">
          <button type="button" onClick={() => onChange(page - 1)} disabled={page === 1} aria-label="Página anterior">
            <ChevronLeft size={16} />
          </button>
          {pageList(page, pages).map((p, i) =>
            p === '…' ? (
              <span key={`e${i}`} className="pager-gap">
                …
              </span>
            ) : (
              <button
                key={p}
                type="button"
                className={p === page ? 'active' : ''}
                onClick={() => onChange(p)}
                aria-current={p === page ? 'page' : undefined}
              >
                {p}
              </button>
            ),
          )}
          <button type="button" onClick={() => onChange(page + 1)} disabled={page === pages} aria-label="Próxima página">
            <ChevronRight size={16} />
          </button>
        </nav>
      )}
    </div>
  );
}

export function Skeleton({ height }: { height: number }) {
  return <div className="card skeleton" style={{ height }} />;
}
