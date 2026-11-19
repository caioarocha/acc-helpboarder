import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router';
import { OverviewPanel } from '../components/OverviewPanel';
import { BookOpen, Bug, ChevronDown, ChevronUp, CircleCheck, Filter, Layers, Hourglass, ListChecks, RotateCw, Search, X } from 'lucide-react';
import type { ConnectionStatus } from '../../shared/types';
import { api, parseIds, useAsync } from '../api';
import { PageHeader } from '../components/PageHeader';
import { StoriesTable } from '../components/StoriesTable';
import { StoryDetail } from '../components/StoryDetail';
import { ResultsByStoryChart } from '../components/charts';
import { BugsBySeverity } from '../components/BugsBySeverity';
import { Card, ErrorBox, KpiCard, Skeleton, Warnings } from '../components/ui';
import { approvalTone, fmtPct } from '../theme';

const STORAGE_KEY = 'helpboarder.us-ids';
const FILTER_OPEN_KEY = 'helpboarder.us-filter-open';

function readSaved() {
  try {
    return localStorage.getItem(STORAGE_KEY) ?? '';
  } catch {
    return '';
  }
}

export function UserStoriesPage({ status }: { status: ConnectionStatus | null }) {
  const [params, setParams] = useSearchParams();
  const idsParam = params.get('ids') ?? '';
  const ids = useMemo(() => parseIds(idsParam), [idsParam]);
  const [input, setInput] = useState(ids.join(', '));
  const [filterOpen, setFilterOpen] = useState(() => {
    try {
      return localStorage.getItem(FILTER_OPEN_KEY) !== 'false';
    } catch {
      return true;
    }
  });
  const toggleFilter = (open: boolean) => {
    setFilterOpen(open);
    try {
      localStorage.setItem(FILTER_OPEN_KEY, String(open));
    } catch {
      /* ignora */
    }
  };

  // Sem IDs na URL: reabre a última consulta
  useEffect(() => {
    if (!idsParam) {
      const saved = readSaved();
      if (saved) setParams({ ids: saved }, { replace: true });
    }
  }, [idsParam, setParams]);

  useEffect(() => setInput(ids.join(', ')), [ids]);

  const q = useAsync(() => (ids.length ? api.stories(ids) : null), ids.join(','));
  const stories = q.data?.stories ?? [];
  // Sem "sel" na URL = visão geral (todas as US)
  const selId = Number(params.get('sel')) || null;
  const selected = (selId && stories.find((s) => s.id === selId)) || null;
  const scope = selected ? [selected] : stories;

  const apply = () => {
    const next = parseIds(input);
    try {
      localStorage.setItem(STORAGE_KEY, next.join(','));
    } catch {
      /* ignora */
    }
    setParams(next.length ? { ids: next.join(',') } : {});
  };

  /** Clicar na US selecionada de novo volta para a visão geral */
  const select = (id: number | null) => {
    const next = new URLSearchParams(params);
    if (id === null || id === selected?.id) next.delete('sel');
    else next.set('sel', String(id));
    setParams(next, { replace: true });
  };

  const m = selected ? selected.metrics : q.data?.totals;
  const pending = m ? m.counts.new + m.counts.ready + m.counts.inProgress : 0;
  // Sem IDs, o filtro fica sempre aberto
  const showFilter = filterOpen || !ids.length;
  return (
    <>
      <PageHeader
        title="User Stories"
        subtitle="Acompanhe a cobertura e a saúde das histórias"
        status={status}
        syncedAt={q.data?.syncedAt}
      />

      {!showFilter ? (
        <div className="card filter-collapsed">
          <button type="button" className="filter-toggle" onClick={() => toggleFilter(true)} aria-expanded={false}>
            <ChevronDown size={16} />
            <Filter size={15} />
            <span className="filter-toggle-label">Filtro</span>
            <span className="muted ellipsis">
              {ids.length} US: {ids.map((i) => `#${i}`).join(', ')}
            </span>
          </button>
          <button type="button" className="btn icon" onClick={q.reload} title="Atualizar">
            <RotateCw size={16} className={q.loading ? 'spin' : ''} />
          </button>
        </div>
      ) : (
      <form
        className="card filter-bar"
        onSubmit={(e) => {
          e.preventDefault();
          apply();
        }}
      >
        {ids.length > 0 && (
          <button
            type="button"
            className="filter-collapse-btn"
            onClick={() => toggleFilter(false)}
            title="Recolher filtro"
            aria-expanded={true}
          >
            <ChevronUp size={16} />
          </button>
        )}
        <label htmlFor="us-ids">IDs das US</label>
        <div className="input-wrap">
          <Search size={16} className="input-icon" />
          <input
            id="us-ids"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ex.: 12345, 12346, 12347"
            autoComplete="off"
          />
          {input && (
            <button type="button" className="input-clear" onClick={() => setInput('')} aria-label="Limpar">
              <X size={16} />
            </button>
          )}
        </div>
        <button type="submit" className="btn primary">
          <Filter size={16} /> Aplicar filtros
        </button>
        <button type="button" className="btn icon" onClick={q.reload} title="Atualizar" disabled={!ids.length}>
          <RotateCw size={16} className={q.loading && ids.length ? 'spin' : ''} />
        </button>
      </form>
      )}

      {q.data && <Warnings items={q.data.warnings} />}
      {q.data && q.data.notFound.length > 0 && (
        <Warnings items={[`IDs não encontrados no Azure DevOps: ${q.data.notFound.map((i) => `#${i}`).join(', ')}`]} />
      )}

      {!ids.length ? (
        <div className="card empty-state">
          <BookOpen size={36} />
          <h3>Informe os IDs das User Stories</h3>
          <p className="muted">
            Digite um ou mais IDs separados por vírgula e clique em <b>Aplicar filtros</b>. O dashboard busca as
            Test Suites IPC, os Test Cases e os Bugs de cada história.
          </p>
        </div>
      ) : q.error ? (
        <ErrorBox message={q.error} onRetry={q.reload} />
      ) : !q.data || (q.loading && !stories.length) ? (
        <div className="page-grid">
          <div className="stack">
            <div className="kpis">
              {[0, 1, 2, 3].map((i) => (
                <Skeleton key={i} height={96} />
              ))}
            </div>
            <div className="charts">
              <Skeleton height={260} />
              <Skeleton height={260} />
            </div>
            <Skeleton height={220} />
          </div>
          <Skeleton height={640} />
        </div>
      ) : !stories.length || !m ? (
        <div className="card empty-state">
          <BookOpen size={36} />
          <h3>Nenhuma User Story encontrada</h3>
          <p className="muted">Confira os IDs informados.</p>
        </div>
      ) : (
        <div className={`page-grid ${q.loading ? 'is-loading' : ''}`}>
          <div className="stack">
            <div className="selection-note">
              {selected ? (
                <>
                  <span>
                    Exibindo dados da <b>US #{selected.id}</b>
                    <span className="muted"> · clique nela de novo ou em "Ver todas" para voltar</span>
                  </span>
                  <button type="button" className="btn small" onClick={() => select(null)}>
                    <Layers size={14} /> Ver todas as US
                  </button>
                </>
              ) : (
                <span>
                  Visão geral de <b>todas as {stories.length} US</b>
                  <span className="muted"> · clique numa US da tabela para ver só ela</span>
                </span>
              )}
            </div>

            <div className="kpis">
              <KpiCard
                icon={<Hourglass size={22} />}
                value={pending}
                label="Pendentes de execução"
                hint={
                  pending
                    ? [
                        m.counts.inProgress && `${m.counts.inProgress} in progress`,
                        m.counts.ready && `${m.counts.ready} ready`,
                        m.counts.new && `${m.counts.new} new`,
                      ]
                        .filter(Boolean)
                        .join(' · ')
                    : 'Tudo executado'
                }
                tone={pending ? 'warn' : 'ok'}
              />
              <KpiCard
                icon={<ListChecks size={22} />}
                value={m.total}
                label="Test Cases"
                hint={
                  m.counts.cancelled
                    ? `${m.counts.cancelled} cancelados fora`
                    : `${scope.reduce((n, s) => n + s.suites.length, 0)} suite(s)`
                }
                tone="info"
              />
              <KpiCard
                icon={<CircleCheck size={22} />}
                value={fmtPct(m.approvalRate)}
                label="Aprovação"
                hint={`${m.counts.passed} passed`}
                tone={approvalTone(m.approvalRate)}
              />
              <KpiCard
                icon={<Bug size={22} />}
                value={m.openBugs}
                label="Bugs abertos"
                hint={`${m.bugs} no total`}
                tone={m.openBugs ? 'bad' : 'ok'}
              />
            </div>

            <div className="charts">
              <Card title={selected ? `Resultado dos testes · US #${selected.id}` : 'Resultado dos testes por User Story'}>
                <ResultsByStoryChart stories={scope} />
              </Card>
              <Card title={selected ? `Bugs por severidade · US #${selected.id}` : 'Bugs por severidade'}>
                <BugsBySeverity key={selected?.id ?? 'all'} stories={scope} />
              </Card>
            </div>

            <Card title={`User Stories selecionadas (${stories.length})`}>
              <StoriesTable stories={stories} selectedId={selected?.id} onSelect={select} />
            </Card>
          </div>

          {selected ? <StoryDetail story={selected} /> : <OverviewPanel stories={stories} metrics={m} />}
        </div>
      )}
    </>
  );
}
