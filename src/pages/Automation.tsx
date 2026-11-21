import { useMemo, useState } from 'react';
import { Bot, CheckCircle2, CircleCheck, ExternalLink, Hammer, RotateCw, Wrench, XCircle } from 'lucide-react';
import type { AutomationItem, Channel, ConnectionStatus, StateCounts } from '../../shared/types';
import { emptyCounts } from '../../shared/metrics';
import { api, useAsync } from '../api';
import { PageHeader } from '../components/PageHeader';
import { AutomationTable } from '../components/AutomationTable';
import { BuildDonut, ChannelCompare, ScopeGrowthChart, buildGrowth } from '../components/automationCharts';
import { Card, ErrorBox, IdLink, KpiCard, Skeleton, StackedBar, StateLegendList, Warnings } from '../components/ui';
import { approvalTone, fmtPct } from '../theme';

type ChannelFilter = 'all' | Channel;
const CHANNEL_KEY = 'cockpit.auto-channel';
const CHANNELS: { key: ChannelFilter; label: string }[] = [
  { key: 'all', label: 'Todos' },
  { key: 'CORBAN', label: 'CORBAN' },
  { key: 'Agencias', label: 'Agências' },
];

function countStates(items: AutomationItem[]): StateCounts {
  const c = emptyCounts();
  for (const i of items) c[i.stateKey]++;
  return c;
}

function readChannel(): ChannelFilter {
  try {
    const v = localStorage.getItem(CHANNEL_KEY);
    return v === 'CORBAN' || v === 'Agencias' ? v : 'all';
  } catch {
    return 'all';
  }
}

export function AutomationPage({ status }: { status: ConnectionStatus | null }) {
  const q = useAsync(() => api.automation(), 'automation');
  const [channel, setChannelState] = useState<ChannelFilter>(readChannel);

  const setChannel = (c: ChannelFilter) => {
    setChannelState(c);
    try {
      localStorage.setItem(CHANNEL_KEY, c);
    } catch {
      /* ignora */
    }
  };

  const all = q.data?.items ?? [];
  const items = useMemo(
    () => (channel === 'all' ? all : all.filter((i) => i.channels.includes(channel))),
    [all, channel],
  );

  const stats = useMemo(() => {
    const built = items.filter((i) => i.build === 'construido');
    const building = items.filter((i) => i.build === 'em-construcao');
    const counts = countStates(items);
    const executed = counts.passed + counts.failed;
    return {
      total: items.length,
      built: built.length,
      building,
      counts,
      failed: items.filter((i) => i.stateKey === 'failed').sort((a, b) => a.title.localeCompare(b.title)),
      successRate: executed ? counts.passed / executed : null,
      executed,
    };
  }, [items]);

  const channelRows = useMemo(
    () =>
      (['CORBAN', 'Agencias'] as Channel[]).map((c) => {
        const list = all.filter((i) => i.channels.includes(c));
        return {
          key: c,
          label: c === 'Agencias' ? 'Agências' : c,
          built: list.filter((i) => i.build === 'construido').length,
          building: list.filter((i) => i.build === 'em-construcao').length,
        };
      }),
    [all],
  );

  const growth = useMemo(() => buildGrowth(items.map((i) => i.createdDate)), [items]);

  const projectName = status?.project ?? (status?.mode === 'mock' ? 'Projeto Demo' : 'projeto');
  const channelName = CHANNELS.find((c) => c.key === channel)?.label ?? 'Todos';

  return (
    <>
      <PageHeader
        title="Automação"
        subtitle={`Acompanhe o escopo de automação ativo do ${projectName}`}
        status={status}
        syncedAt={q.data?.syncedAt}
      />

      <div className="card filter-bar">
        <label>Canal</label>
        <div className="segmented" role="tablist">
          {CHANNELS.map((c) => (
            <button
              key={c.key}
              type="button"
              role="tab"
              aria-selected={channel === c.key}
              className={channel === c.key ? 'active' : ''}
              onClick={() => setChannel(c.key)}
            >
              {c.label}
            </button>
          ))}
        </div>
        {q.data?.queryName && (
          <span className="muted small query-name" title="Query do Azure DevOps usada nesta aba">
            Query: {q.data.queryName}
          </span>
        )}
        <div className="push-right filter-actions">
          {q.data?.queryUrl && (
            <a className="btn small ghost" href={q.data.queryUrl} target="_blank" rel="noreferrer">
              <ExternalLink size={14} /> Abrir query
            </a>
          )}
          <button className="btn icon" onClick={q.reload} title="Atualizar">
            <RotateCw size={16} className={q.loading ? 'spin' : ''} />
          </button>
        </div>
      </div>

      {q.data && <Warnings items={q.data.warnings} />}

      {q.error ? (
        <ErrorBox message={q.error} onRetry={q.reload} />
      ) : !q.data ? (
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
            <Skeleton height={360} />
          </div>
          <div className="stack">
            <Skeleton height={280} />
            <Skeleton height={300} />
          </div>
        </div>
      ) : (
        <div className={`page-grid ${q.loading ? 'is-loading' : ''}`}>
          <div className="stack">
            <div className="kpis">
              <KpiCard
                icon={<Bot size={22} />}
                value={stats.total}
                label="Cenários no escopo"
                hint={channel === 'all' ? 'CORBAN + Agências' : channelName}
                tone="brand"
              />
              <KpiCard
                icon={<CheckCircle2 size={22} />}
                value={stats.built}
                label="Construído"
                hint={`${fmtPct(stats.total ? stats.built / stats.total : null)} do escopo`}
                tone="ok"
              />
              <KpiCard
                icon={<Hammer size={22} />}
                value={stats.building.length}
                label="Em construção"
                hint={`${fmtPct(stats.total ? stats.building.length / stats.total : null)} do escopo`}
                tone={stats.building.length ? 'warn' : 'ok'}
              />
              <KpiCard
                icon={<CircleCheck size={22} />}
                value={fmtPct(stats.successRate)}
                label="Sucesso na execução"
                hint={`${stats.counts.passed} passed · ${stats.counts.failed} failed`}
                tone={approvalTone(stats.successRate)}
              />
            </div>

            <div className="charts">
              <Card title="Construído x Em construção">
                <BuildDonut built={stats.built} building={stats.building.length} />
              </Card>
              <Card title="Por canal" extra={<span className="muted small">Clique para filtrar</span>}>
                <ChannelCompare rows={channelRows} active={channel} onPick={(k) => setChannel(k as ChannelFilter)} />
              </Card>
            </div>

            <Card
              title="Crescimento do escopo automatizado"
              extra={<span className="muted small">por data de criação do cenário</span>}
            >
              <ScopeGrowthChart points={growth} />
            </Card>
          </div>

          <div className="stack">
            <Card title="Status de execução">
              <div className="big-number">
                <strong>{stats.total}</strong>
                <span className="muted small">cenários · {stats.executed} com resultado (Passed/Failed)</span>
              </div>
              <StackedBar counts={stats.counts} total={stats.total - stats.counts.cancelled} />
              <StateLegendList counts={stats.counts} hideZero />
            </Card>

            <Card
              title={
                <>
                  <Wrench size={15} className="title-icon warn" /> Em construção
                </>
              }
              extra={<span className="muted small">{stats.building.length}</span>}
            >
              <ScenarioList items={stats.building} empty="Nenhum cenário em construção." />
            </Card>

            <Card
              title={
                <>
                  <XCircle size={15} className="title-icon bad" /> Com falha
                </>
              }
              extra={<span className="muted small">{stats.failed.length}</span>}
            >
              <ScenarioList items={stats.failed} empty="Nenhum cenário com falha." />
            </Card>
          </div>

          <Card
            className="span-all"
            title={`Cenários (${items.length})`}
            extra={<span className="muted small">Canal: {channelName}</span>}
          >
            <AutomationTable key={channel} items={items} />
          </Card>
        </div>
      )}
    </>
  );
}

function ScenarioList({ items, empty }: { items: AutomationItem[]; empty: string }) {
  if (!items.length) return <p className="muted">{empty}</p>;
  return (
    <ul className="scenario-list">
      {items.map((i) => (
        <li key={i.id}>
          <IdLink id={i.id} url={i.url} />
          <span className="ellipsis" title={i.title}>
            {i.title}
          </span>
          <span className="muted small nowrap">{i.channels.map((c) => (c === 'Agencias' ? 'AGN' : 'CBN')).join('+')}</span>
        </li>
      ))}
    </ul>
  );
}
