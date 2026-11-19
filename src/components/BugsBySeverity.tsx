import { useMemo, useState } from 'react';
import { ChevronRight } from 'lucide-react';
import type { BugItem, StorySummary } from '../../shared/types';
import { uniqueById } from '../../shared/metrics';
import { PALETTE } from '../theme';
import { IdLink } from './ui';

const SEVERITY_COLOR: Record<string, string> = {
  Critical: '#FB7185',
  High: '#FB923C',
  Medium: '#FBBF24',
  Low: '#60A5FA',
};

interface SeverityGroup {
  order: number;
  label: string;
  bugs: BugItem[];
  open: number;
}

/** Barras de bugs por severidade. Clique numa severidade para listar os bugs. */
export function BugsBySeverity({ stories }: { stories: StorySummary[] }) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const [onlyOpen, setOnlyOpen] = useState(false);

  const bugs = useMemo(() => uniqueById(stories.flatMap((s) => s.bugs)), [stories]);

  const rows = useMemo(() => {
    const groups = new Map<string, SeverityGroup>();
    for (const b of bugs) {
      const raw = b.severity?.trim() || '';
      const m = /^(\d+)\s*-\s*(.+)$/.exec(raw);
      const label = m ? m[2] : raw || 'Sem severidade';
      const order = m ? Number(m[1]) : raw ? 50 : 99;
      const g = groups.get(label) ?? { order, label, bugs: [], open: 0 };
      g.bugs.push(b);
      if (b.isOpen) g.open++;
      groups.set(label, g);
    }
    for (const g of groups.values()) {
      g.bugs.sort((a, b) => Number(b.isOpen) - Number(a.isOpen) || b.id - a.id);
    }
    return [...groups.values()].sort((a, b) => a.order - b.order);
  }, [bugs]);

  if (!bugs.length) return <p className="muted sev-empty">Nenhum bug vinculado aos Test Cases.</p>;

  const open = bugs.filter((b) => b.isOpen).length;
  const max = Math.max(1, ...rows.map((r) => r.bugs.length));

  return (
    <div className="sev">
      <div className="sev-summary">
        <strong>{bugs.length}</strong>
        <span className="muted small">
          bugs · <b className="sev-open">{open} abertos</b> · {bugs.length - open} fechados
        </span>
        <label className="sev-toggle">
          <input type="checkbox" checked={onlyOpen} onChange={(e) => setOnlyOpen(e.target.checked)} />
          Somente abertos
        </label>
      </div>

      <ul className="sev-list">
        {rows.map((r) => {
          const color = SEVERITY_COLOR[r.label] ?? PALETTE.subtle;
          const closed = r.bugs.length - r.open;
          const isOpen = expanded === r.label;
          const listed = onlyOpen ? r.bugs.filter((b) => b.isOpen) : r.bugs;
          return (
            <li key={r.label} className={isOpen ? 'expanded' : ''}>
              <button
                type="button"
                className="sev-row"
                onClick={() => setExpanded(isOpen ? null : r.label)}
                aria-expanded={isOpen}
                title="Clique para ver os bugs"
              >
                <span className="sev-label">
                  <ChevronRight size={14} className="sev-chevron" />
                  <span className="swatch" style={{ background: color }} />
                  {r.label}
                </span>
                <span className="sev-track">
                  <span className="sev-seg" style={{ width: `${(r.open / max) * 100}%`, background: color }} />
                  <span
                    className="sev-seg"
                    style={{ width: `${(closed / max) * 100}%`, background: color, opacity: 0.3 }}
                  />
                </span>
                <span className="sev-count">
                  <b>{r.bugs.length}</b>
                  <span className={r.open ? 'sev-open' : 'muted'}>{r.open === 1 ? '1 aberto' : `${r.open} abertos`}</span>
                </span>
              </button>

              {isOpen && (
                <ul className="sev-bugs">
                  {listed.map((b) => (
                    <li key={b.id} className="sev-bug-head">
                      <IdLink id={b.id} url={b.url} />
                      <span className="ellipsis" title={b.title}>
                        {b.title}
                      </span>
                      <span className={`badge small tone-${b.isOpen ? 'bad' : 'neutral'}`}>{b.state}</span>
                    </li>
                  ))}
                  {!listed.length && <li className="muted">Nenhum bug aberto nesta severidade.</li>}
                </ul>
              )}
            </li>
          );
        })}
      </ul>

      <div className="chart-legend">
        <span>
          <span className="swatch" style={{ background: PALETTE.p300 }} />
          Abertos
        </span>
        <span>
          <span className="swatch" style={{ background: PALETTE.p300, opacity: 0.3 }} />
          Fechados
        </span>
        <span>Clique numa severidade para ver os bugs</span>
      </div>
    </div>
  );
}
