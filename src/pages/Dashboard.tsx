import { useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { BookOpen, Bug, CalendarRange, CircleCheck, ListChecks, RotateCw } from 'lucide-react';
import type { ConnectionStatus, Health } from '../../shared/types';
import { uniqueById } from '../../shared/metrics';
import { api, useAsync } from '../api';
import { PageHeader } from '../components/PageHeader';
import { StoriesTable } from '../components/StoriesTable';
import { StatusDistributionChart } from '../components/charts';
import { BugsBySeverity } from '../components/BugsBySeverity';
import { Card, ErrorBox, HealthBadge, IdLink, KpiCard, Skeleton, StackedBar, StateLegendList, Warnings } from '../components/ui';
import { approvalTone, fmtDate, fmtPct } from '../theme';

const HEALTH_ORDER: Health[] = ['critica', 'atencao', 'nao-executada', 'sem-testes', 'saudavel'];

export function DashboardPage({ status }: { status: ConnectionStatus | null }) {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const its = useAsync(() => api.iterations(), 'iterations');

  const iterations = its.data ?? [];
  const iteration = params.get('sprint') ?? iterations.find((i) => i.isCurrent)?.path ?? iterations[0]?.path ?? '';
  const current = iterations.find((i) => i.path === iteration);

  const q = useAsync(() => (iteration ? api.dashboard(iteration) : null), iteration);
  const stories = q.data?.stories ?? [];
  const t = q.data?.totals;

  const healthCounts = useMemo(() => {
    const c = Object.fromEntries(HEALTH_ORDER.map((h) => [h, 0])) as Record<Health, number>;
    for (const s of stories) c[s.metrics.health]++;
    return c;
  }, [stories]);

  const allBugs = useMemo(() => uniqueById(stories.flatMap((s) => s.bugs)), [stories]);
  const openBugs = useMemo(() => allBugs.filter((b) => b.isOpen).sort((a, b) => b.id - a.id), [allBugs]);

  const sortedStories = useMemo(
    () => [...stories].sort((a, b) => HEALTH_ORDER.indexOf(a.metrics.health) - HEALTH_ORDER.indexOf(b.metrics.health)),
    [stories],
  );

  const projectName = status?.project ?? (status?.mode === 'mock' ? 'Projeto Demo' : 'projeto');
  const error = its.error ?? q.error;

  return (
    <>
      <PageHeader
        title="Dashboard"
        subtitle={`Acompanhe a cobertura dos testes do ${projectName}`}
        status={status}
        syncedAt={q.data?.syncedAt}
      />

      <div className="card filter-bar">
        <label htmlFor="sprint">
          <CalendarRange size={16} /> Sprint
        </label>
        <select
          id="sprint"
          value={iteration}
          onChange={(e) => setParams({ sprint: e.target.value })}
          disabled={!iterations.length}
        >
          {iterations.map((i) => (
            <option key={i.path} value={i.path}>
              {i.path}
              {i.isCurrent ? '  (atual)' : ''}
            </option>
          ))}
        </select>
        {current?.startDate && (
          <span className="muted small">
            {fmtDate(current.startDate)} até {fmtDate(current.finishDate)}
          </span>
        )}
        <button className="btn icon push-right" onClick={q.reload} title="Atualizar" disabled={!iteration}>
          <RotateCw size={16} className={q.loading && iteration ? 'spin' : ''} />
        </button>
      </div>

      {q.data && <Warnings items={q.data.warnings} />}

      {error ? (
        <ErrorBox message={error} onRetry={() => (its.error ? its.reload() : q.reload())} />
      ) : !q.data ? (
        <div className="page-grid">
          <div className="stack">
            <div className="kpis">
              {[0, 1, 2, 3].map((i) => (
                <Skeleton key={i} height={96} />
              ))}
            </div>
            <div className="charts">
              <Skeleton height={280} />
              <Skeleton height={280} />
            </div>
            <Skeleton height={300} />
          </div>
          <div className="stack">
            <Skeleton height={300} />
            <Skeleton height={200} />
            <Skeleton height={200} />
          </div>
        </div>
      ) : !stories.length ? (
        <div className="card empty-state">
          <CalendarRange size={36} />
          <h3>Nenhuma User Story nesta sprint</h3>
          <p className="muted">Escolha outra sprint ou confira a Area Path configurada no .env.</p>
        </div>
      ) : (
        <div className={`page-grid ${q.loading ? 'is-loading' : ''}`}>
          <div className="stack">
            <div className="kpis">
              <KpiCard icon={<BookOpen size={22} />} value={t!.stories} label="User Stories" hint="na sprint" tone="brand" />
              <KpiCard
                icon={<ListChecks size={22} />}
                value={t!.total}
                label="Test Cases"
                hint={`${t!.executed} executados`}
                tone="info"
              />
              <KpiCard
                icon={<CircleCheck size={22} />}
                value={fmtPct(t!.approvalRate)}
                label="Aprovação"
                hint={`${t!.counts.passed} passed`}
                tone={approvalTone(t!.approvalRate)}
              />
              <KpiCard
                icon={<Bug size={22} />}
                value={t!.openBugs}
                label="Bugs abertos"
                hint={`${t!.bugs} no total`}
                tone={t!.openBugs ? 'bad' : 'ok'}
              />
            </div>

            <div className="charts">
              <Card title="Test Cases por status">
                <StatusDistributionChart counts={t!.counts} />
              </Card>
              <Card title="Bugs por severidade">
                <BugsBySeverity stories={stories} />
              </Card>
            </div>

            <Card
              title={`User Stories da sprint (${stories.length})`}
              extra={<span className="muted small">Clique para ver os detalhes</span>}
            >
              <StoriesTable
                stories={sortedStories}
                showSprint
                onSelect={(id) => navigate(`/user-stories?ids=${stories.map((s) => s.id).join(',')}&sel=${id}`)}
              />
            </Card>
          </div>

          <div className="stack">
            <Card title="Progresso da sprint">
              <div className="big-number">
                <strong>{fmtPct(t!.executionRate)}</strong>
                <span className="muted small">
                  executado · {t!.executed} de {t!.total} Test Cases
                </span>
              </div>
              <StackedBar counts={t!.counts} total={t!.total} />
              <StateLegendList counts={t!.counts} />
              {t!.counts.cancelled > 0 && (
                <p className="muted small">{t!.counts.cancelled} cancelado(s), fora do cálculo</p>
              )}
            </Card>

            <Card title="Saúde das User Stories">
              <ul className="health-list">
                {HEALTH_ORDER.map((h) => (
                  <li key={h}>
                    <HealthBadge health={h} />
                    <b>{healthCounts[h]}</b>
                  </li>
                ))}
              </ul>
            </Card>

            <Card title="Bugs abertos" extra={<span className="muted small">{openBugs.length}</span>}>
              {openBugs.length ? (
                <ul className="bug-list">
                  {openBugs.slice(0, 6).map((b) => (
                    <li key={b.id}>
                      <IdLink id={b.id} url={b.url} />
                      <span className="ellipsis" title={b.title}>
                        {b.title}
                      </span>
                      {b.severity && <span className="muted small nowrap">{b.severity.split(' - ')[1] ?? b.severity}</span>}
                    </li>
                  ))}
                  {openBugs.length > 6 && <li className="muted small">+{openBugs.length - 6} bugs</li>}
                </ul>
              ) : (
                <p className="muted">Nenhum bug aberto nesta sprint.</p>
              )}
            </Card>
          </div>
        </div>
      )}
    </>
  );
}
