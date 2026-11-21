import { useMemo, useState } from 'react';
import { Clock, Hand, RotateCw, ShieldCheck, Target, XCircle, CircleDashed } from 'lucide-react';
import type { ConnectionStatus, RegEnv, RegItem } from '../../shared/types';
import { api, useAsync } from '../api';
import { PageHeader } from '../components/PageHeader';
import { EnvCompareChart, GoalCard, HistoryChart, QualityGatePanel, SuitesPanel } from '../components/regression';
import { Card, ErrorBox, IdLink, Skeleton } from '../components/ui';
import { fmtDateTime, fmtPct2 } from '../theme';

const ENV_KEY = 'cockpit.reg-env';

function readEnv(): RegEnv {
  try {
    return localStorage.getItem(ENV_KEY) === 'HFX' ? 'HFX' : 'HML';
  } catch {
    return 'HML';
  }
}

export function RegressionPage({ status }: { status: ConnectionStatus | null }) {
  const q = useAsync(() => api.regression(), 'regression');
  const [env, setEnvState] = useState<RegEnv>(readEnv);
  const setEnv = (e: RegEnv) => {
    setEnvState(e);
    try {
      localStorage.setItem(ENV_KEY, e);
    } catch {
      /* ignora */
    }
  };

  const data = q.data?.environments[env];
  const goal = q.data?.goal ?? 0.85;
  const history = useMemo(() => (q.data?.history ?? []).filter((p) => p.env === env), [q.data, env]);

  const lists = useMemo(() => {
    if (!data) return { failed: [], pending: [] };
    const tag = (items: RegItem[], channel: string) => items.map((i) => ({ ...i, channel }));
    const all = [...tag(data.groups.corban.items, 'CBN'), ...tag(data.groups.agencias.items, 'AGN')];
    return {
      failed: all.filter((i) => i.stateKey === 'failed' || i.stateKey === 'blocked'),
      pending: all.filter((i) => i.stateKey !== 'failed' && i.stateKey !== 'blocked' && i.stateKey !== 'passed'),
    };
  }, [data]);

  const projectName = status?.project ?? (status?.mode === 'mock' ? 'Projeto Demo' : 'projeto');
  const cons = data?.groups.consolidado;

  return (
    <>
      <PageHeader
        title="Regressão"
        subtitle={`Acompanhe o regressivo de CORBAN e Agências do ${projectName}`}
        status={status}
        syncedAt={q.data?.syncedAt}
      />

      <div className="card filter-bar">
        <label>Ambiente</label>
        <div className="segmented">
          {(['HML', 'HFX'] as RegEnv[]).map((e) => (
            <button key={e} type="button" className={env === e ? 'active' : ''} onClick={() => setEnv(e)}>
              {e}
            </button>
          ))}
        </div>
        <span className="goal-chip">
          <Target size={14} /> Meta {fmtPct2(goal)}
        </span>
        {data?.lastExecution && (
          <span className="muted small nowrap">
            <Clock size={13} style={{ verticalAlign: '-2px' }} /> Última execução em {env}: {fmtDateTime(data.lastExecution)}
          </span>
        )}
        <button className="btn icon push-right" onClick={q.reload} title="Atualizar">
          <RotateCw size={16} className={q.loading ? 'spin' : ''} />
        </button>
      </div>

      {q.error ? (
        <ErrorBox message={q.error} onRetry={q.reload} />
      ) : !data || !cons ? (
        <div className="page-grid">
          <div className="stack">
            <div className="goal-grid">
              {[0, 1, 2].map((i) => (
                <Skeleton key={i} height={190} />
              ))}
            </div>
            <div className="charts">
              <Skeleton height={300} />
              <Skeleton height={300} />
            </div>
          </div>
          <div className="stack">
            <Skeleton height={260} />
            <Skeleton height={260} />
          </div>
        </div>
      ) : (
        <div className={`page-grid ${q.loading ? 'is-loading' : ''}`}>
          <div className="stack">
            <div className="section-label">
              Regressivo automatizado · {env}
              <span className="muted small">
                Consolidado = CORBAN + Agências · {cons.passed} de {cons.total} passed
              </span>
            </div>
            <div className="goal-grid">
              <GoalCard group={data.groups.corban} goal={goal} />
              <GoalCard group={data.groups.agencias} goal={goal} />
              <GoalCard group={cons} goal={goal} />
            </div>

            {data.qualityGate && (
              <Card
                title={
                  <>
                    <ShieldCheck size={16} className="title-icon" /> Quality Gate · pipeline da GMUD · {env}
                  </>
                }
                extra={<span className="muted small">valor real usado na subida para produção</span>}
              >
                <QualityGatePanel key={env} qg={data.qualityGate} consolidado={cons} goal={goal} />
              </Card>
            )}

            <div className="charts">
              <Card title="HML x HFX" extra={<span className="muted small">% de Passed por grupo</span>}>
                <EnvCompareChart envs={q.data!.environments} goal={goal} />
              </Card>
              <Card title={`Evolução · ${env}`} extra={<span className="muted small">{history.length} dia(s) gravado(s)</span>}>
                <HistoryChart points={history} goal={goal} />
              </Card>
            </div>

            <div className="section-label">
              <span>
                <Hand size={15} style={{ verticalAlign: '-2px' }} /> Testes manuais · {env}
              </span>
              <span className="muted small">Não entram no consolidado</span>
            </div>
            <div className="goal-grid two">
              <GoalCard group={data.groups.manualCorban} goal={goal} compact />
              <GoalCard group={data.groups.manualAgencias} goal={goal} compact />
            </div>
          </div>

          <div className="stack">
            <Card
              title={
                <>
                  <XCircle size={15} className="title-icon bad" /> Falhas e bloqueios
                </>
              }
              extra={<span className="muted small">{lists.failed.length}</span>}
            >
              <RegList items={lists.failed} empty="Nenhum cenário com falha neste ambiente." />
            </Card>
            <Card
              title={
                <>
                  <CircleDashed size={15} className="title-icon warn" /> Não executados
                </>
              }
              extra={<span className="muted small">{lists.pending.length}</span>}
            >
              <RegList items={lists.pending} empty="Todos os cenários foram executados." />
            </Card>
          </div>

          <Card className="span-all" title={`Suites de regressão · ${env}`} extra={<span className="muted small">execuções dos jobs</span>}>
            <SuitesPanel key={env} suites={data.suites} />
          </Card>
        </div>
      )}
    </>
  );
}

function RegList({ items, empty }: { items: (RegItem & { channel: string })[]; empty: string }) {
  if (!items.length) return <p className="muted">{empty}</p>;
  return (
    <ul className="scenario-list tall">
      {items.map((i) => (
        <li key={`${i.channel}-${i.id}`}>
          <IdLink id={i.id} url={i.url} />
          <span className="ellipsis" title={`${i.title}\n${i.state}`}>
            {i.title}
          </span>
          <span className="muted small nowrap">{i.channel}</span>
        </li>
      ))}
    </ul>
  );
}
