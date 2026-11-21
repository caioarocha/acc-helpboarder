import { useMemo, useState } from 'react';
import { Search, X } from 'lucide-react';
import type { AutomationItem, BuildStatus } from '../../shared/types';
import { IdLink, Pagination, StateBadge } from './ui';

const PAGE = 15;
const STATE_ORDER = ['failed', 'blocked', 'inProgress', 'ready', 'new', 'passed', 'cancelled', 'other'];
const BUILD_LABEL: Record<BuildStatus, string> = {
  construido: 'Construído',
  'em-construcao': 'Em construção',
  'sem-tag': 'Sem tag',
};
const channelLabel = (c: string) => (c === 'Agencias' ? 'Agências' : c);

export function AutomationTable({ items }: { items: AutomationItem[] }) {
  const [search, setSearch] = useState('');
  const [state, setState] = useState('');
  const [build, setBuild] = useState('');
  const [func, setFunc] = useState('');
  const [page, setPage] = useState(1);

  const states = useMemo(() => [...new Set(items.map((i) => i.state))].sort(), [items]);
  const funcs = useMemo(() => [...new Set(items.map((i) => i.functionality))].sort(), [items]);

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase().replace('#', '');
    return items
      .filter(
        (i) =>
          (!state || i.state === state) &&
          (!build || i.build === build) &&
          (!func || i.functionality === func) &&
          (!s ||
            String(i.id).includes(s) ||
            i.title.toLowerCase().includes(s) ||
            (i.feature ?? '').toLowerCase().includes(s) ||
            (i.scenarioTag ?? '').toLowerCase().includes(s)),
      )
      .sort(
        (a, b) =>
          STATE_ORDER.indexOf(a.stateKey) - STATE_ORDER.indexOf(b.stateKey) || a.title.localeCompare(b.title),
      );
  }, [items, search, state, build, func]);

  const resetPage = () => setPage(1);
  const visible = filtered.slice((page - 1) * PAGE, page * PAGE);
  const hasFilter = search || state || build || func;

  return (
    <>
      <div className="table-filters">
        <div className="input-wrap">
          <Search size={16} className="input-icon" />
          <input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              resetPage();
            }}
            placeholder="Buscar por ID, título, feature ou tag do cenário"
          />
        </div>
        <select value={state} onChange={(e) => (setState(e.target.value), resetPage())}>
          <option value="">Todos os states</option>
          {states.map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>
        <select value={build} onChange={(e) => (setBuild(e.target.value), resetPage())}>
          <option value="">Construído e em construção</option>
          <option value="construido">Construído</option>
          <option value="em-construcao">Em construção</option>
        </select>
        <select value={func} onChange={(e) => (setFunc(e.target.value), resetPage())}>
          <option value="">Todas as funcionalidades</option>
          {funcs.map((f) => (
            <option key={f}>{f}</option>
          ))}
        </select>
        {hasFilter && (
          <button
            type="button"
            className="btn ghost small"
            onClick={() => {
              setSearch('');
              setState('');
              setBuild('');
              setFunc('');
              resetPage();
            }}
          >
            <X size={14} /> Limpar
          </button>
        )}
      </div>

      <div className="table-wrap">
        <table className="table auto-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Cenário</th>
              <th>Canal</th>
              <th>Funcionalidade</th>
              <th>Construção</th>
              <th>State</th>
              <th className="num">Score</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((i) => (
              <tr key={i.id}>
                <td>
                  <IdLink id={i.id} url={i.url} />
                </td>
                <td className="auto-title" title={[i.title, i.feature, i.scenarioTag].filter(Boolean).join('\n')}>
                  {i.title}
                </td>
                <td className="nowrap small">{i.channels.map(channelLabel).join(' + ') || '—'}</td>
                <td className="nowrap small muted">{i.functionality}</td>
                <td>
                  <span className={`badge small tone-${i.build === 'construido' ? 'ok' : i.build === 'em-construcao' ? 'warn' : 'neutral'}`}>
                    {BUILD_LABEL[i.build]}
                  </span>
                </td>
                <td>
                  <StateBadge state={i.state} stateKey={i.stateKey} />
                </td>
                <td className="num">{i.score ?? '—'}</td>
              </tr>
            ))}
            {!visible.length && (
              <tr>
                <td colSpan={7} className="muted" style={{ textAlign: 'center', padding: 24 }}>
                  Nenhum cenário encontrado com esses filtros.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <Pagination page={page} pageSize={PAGE} total={filtered.length} noun="cenários" onChange={setPage} />
    </>
  );
}
