import { useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, ExternalLink, Target, XCircle } from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  LabelList,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { RegEnv, RegEnvData, RegGroup, RegHistoryPoint, RegQualityGate, RegSuite } from '../../shared/types';
import { PALETTE, STATES, fmtDateTime, fmtPct2 } from '../theme';
import { IdLink, Pagination, StateBadge } from './ui';

const axisTick = { fill: PALETTE.muted, fontSize: 12 };
const tooltipBox = {
  contentStyle: { background: PALETTE.p950, border: `1px solid ${PALETTE.p700}`, borderRadius: 10, fontSize: 12 },
  itemStyle: { color: PALETTE.text },
  labelStyle: { color: PALETTE.muted },
};
export const ENV_COLOR: Record<RegEnv, string> = { HML: PALETTE.p400, HFX: '#60A5FA' };

/** Quantos Passed faltam para bater a meta */
export const missingForGoal = (g: RegGroup, goal: number) => Math.max(0, Math.ceil(goal * g.total - 1e-9) - g.passed);

/** Card com o % do grupo, barra com a marca da meta e o que falta */
export function GoalCard({ group, goal, compact = false }: { group: RegGroup; goal: number; compact?: boolean }) {
  const hit = group.rate != null && group.rate >= goal;
  const missing = missingForGoal(group, goal);
  const pct = (group.rate ?? 0) * 100;
  const states = STATES.filter((s) => s.key !== 'passed' && group.counts[s.key] > 0);

  return (
    <div className={`card goal-card ${compact ? 'compact' : ''} tone-${group.total === 0 ? 'neutral' : hit ? 'ok' : 'bad'}`}>
      <div className="goal-head">
        <span className="goal-label">{group.label}</span>
        {group.total > 0 && (
          <span className={`badge small tone-${hit ? 'ok' : 'bad'}`}>
            {hit ? <CheckCircle2 size={12} /> : <XCircle size={12} />}
            {hit ? 'Meta atingida' : 'Abaixo da meta'}
          </span>
        )}
      </div>
      <div className="goal-value">{fmtPct2(group.rate)}</div>
      <div className="goal-track" title={`Meta: ${fmtPct2(goal)}`}>
        <div className="goal-fill" style={{ width: `${Math.min(100, pct)}%` }} />
        <div className="goal-marker" style={{ left: `${goal * 100}%` }}>
          <span>{Math.round(goal * 100)}%</span>
        </div>
      </div>
      <div className="goal-foot">
        <span>
          <b>{group.passed}</b> de <b>{group.total}</b> passed
        </span>
        {group.total > 0 && (
          <span className={hit ? 'muted' : 'goal-missing'}>
            {hit ? `+${group.passed - Math.ceil(goal * group.total - 1e-9)} acima da meta` : `faltam ${missing} para ${Math.round(goal * 100)}%`}
          </span>
        )}
      </div>
      {!compact && (
        <div className="goal-states">
          {states.length ? (
            states.map((s) => (
              <span key={s.key}>
                <span className="swatch" style={{ background: s.color }} />
                {s.label} <b>{group.counts[s.key]}</b>
              </span>
            ))
          ) : (
            <span className="muted">Todos os cenários passaram</span>
          )}
        </div>
      )}
      {group.queryUrl && (
        <a className="goal-link" href={group.queryUrl} target="_blank" rel="noreferrer" title={group.queryName ?? undefined}>
          <ExternalLink size={12} /> {compact ? 'Query' : 'Abrir query'}
        </a>
      )}
    </div>
  );
}

/** Colunas agrupadas: % de cada grupo em HML e HFX, com a linha da meta */
export function EnvCompareChart({ envs, goal }: { envs: Record<RegEnv, RegEnvData>; goal: number }) {
  const data = (['corban', 'agencias', 'consolidado'] as const).map((k) => ({
    name: envs.HML.groups[k].label,
    HML: envs.HML.groups[k].rate != null ? envs.HML.groups[k].rate! * 100 : null,
    HFX: envs.HFX.groups[k].rate != null ? envs.HFX.groups[k].rate! * 100 : null,
  }));
  const label = (v: unknown) => (v == null ? '' : `${Number(v).toFixed(1).replace('.', ',')}%`);
  return (
    <>
      <ResponsiveContainer width="100%" height={240}>
        <BarChart data={data} margin={{ top: 22, right: 12, bottom: 0, left: -14 }} barGap={6}>
          <CartesianGrid vertical={false} stroke={PALETTE.grid} />
          <XAxis dataKey="name" tick={axisTick} axisLine={false} tickLine={false} />
          <YAxis domain={[0, 100]} tick={axisTick} axisLine={false} tickLine={false} tickFormatter={(v) => `${v}%`} />
          <Tooltip {...tooltipBox} cursor={{ fill: 'rgba(224,170,255,0.06)' }} formatter={(v) => fmtPct2(Number(v) / 100)} />
          <ReferenceLine y={goal * 100} stroke={PALETTE.p300} strokeDasharray="6 4" />
          {(['HML', 'HFX'] as RegEnv[]).map((env) => (
            <Bar
              key={env}
              dataKey={env}
              fill={ENV_COLOR[env]}
              radius={[6, 6, 0, 0]}
              maxBarSize={44}
              minPointSize={3}
              isAnimationActive={false}
            >
              <LabelList dataKey={env} position="top" formatter={label} fill={PALETTE.text} fontSize={11} fontWeight={600} />
            </Bar>
          ))}
        </BarChart>
      </ResponsiveContainer>
      <div className="chart-legend">
        {(['HML', 'HFX'] as RegEnv[]).map((env) => (
          <span key={env}>
            <span className="swatch" style={{ background: ENV_COLOR[env] }} />
            {env}
          </span>
        ))}
        <span>
          <Target size={12} /> linha tracejada = meta {Math.round(goal * 100)}%
        </span>
      </div>
    </>
  );
}

const LINE_COLOR = { consolidado: PALETTE.p300, corban: '#4ADE80', agencias: '#FBBF24', qualityGate: '#FB7185' };

/** Linha do % ao longo dos dias (fotos salvas a cada atualização) */
export function HistoryChart({ points, goal }: { points: RegHistoryPoint[]; goal: number }) {
  const data = points.map((p) => ({
    label: p.date.split('-').reverse().slice(0, 2).join('/'),
    consolidado: p.consolidado != null ? p.consolidado * 100 : null,
    corban: p.corban != null ? p.corban * 100 : null,
    agencias: p.agencias != null ? p.agencias * 100 : null,
    qualityGate: p.qualityGate != null ? p.qualityGate * 100 : null,
  }));
  return (
    <>
      {data.length < 2 && (
        <p className="muted small history-note">
          O histórico começou a ser gravado agora. A cada dia em que o dashboard for aberto, um ponto novo entra no gráfico.
        </p>
      )}
      <ResponsiveContainer width="100%" height={data.length < 2 ? 200 : 240}>
        <LineChart data={data} margin={{ top: 14, right: 16, bottom: 0, left: -14 }}>
          <CartesianGrid vertical={false} stroke={PALETTE.grid} />
          <XAxis dataKey="label" tick={axisTick} axisLine={false} tickLine={false} />
          <YAxis domain={[0, 100]} tick={axisTick} axisLine={false} tickLine={false} tickFormatter={(v) => `${v}%`} />
          <Tooltip {...tooltipBox} formatter={(v) => fmtPct2(Number(v) / 100)} />
          <ReferenceLine y={goal * 100} stroke={PALETTE.p300} strokeDasharray="6 4" />
          {(['consolidado', 'corban', 'agencias', 'qualityGate'] as const).map((k) => (
            <Line
              key={k}
              type="monotone"
              dataKey={k}
              name={
                k === 'consolidado' ? 'Consolidado' : k === 'corban' ? 'CORBAN' : k === 'agencias' ? 'Agências' : 'Quality Gate'
              }
              stroke={LINE_COLOR[k]}
              strokeWidth={k === 'consolidado' ? 3 : 2}
              strokeDasharray={k === 'qualityGate' ? '4 3' : undefined}
              dot={{ r: data.length < 2 ? 5 : 3 }}
              connectNulls
              isAnimationActive={false}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
      <div className="chart-legend">
        <span>
          <span className="swatch" style={{ background: LINE_COLOR.consolidado }} />
          Consolidado
        </span>
        <span>
          <span className="swatch" style={{ background: LINE_COLOR.corban }} />
          CORBAN
        </span>
        <span>
          <span className="swatch" style={{ background: LINE_COLOR.agencias }} />
          Agências
        </span>
        <span>
          <span className="swatch" style={{ background: LINE_COLOR.qualityGate }} />
          Quality Gate
        </span>
        <span>
          <Target size={12} /> meta {Math.round(goal * 100)}%
        </span>
      </div>
    </>
  );
}

/**
 * Quality Gate da pipeline da GMUD: soma Tests Passed/Failed das suites da esteira.
 * Mostrado ao lado do % das queries para conferir se os números batem.
 */
export function QualityGatePanel({ qg, consolidado, goal }: { qg: RegQualityGate; consolidado: RegGroup; goal: number }) {
  const [showSuites, setShowSuites] = useState(false);
  const total = qg.testsPassed + qg.testsFailed;
  const hit = qg.rate != null && qg.rate >= goal;
  const toConvert = Math.max(0, Math.ceil(goal * total - 1e-9) - qg.testsPassed);
  const consHit = consolidado.rate != null && consolidado.rate >= goal;
  const diff = qg.rate != null && consolidado.rate != null ? (qg.rate - consolidado.rate) * 100 : null;
  const agree = hit === consHit;
  const failedSuites = [...qg.suites].filter((s) => s.testsFailed > 0).sort((a, b) => b.testsFailed - a.testsFailed);

  return (
    <div className="qg">
      <div className="qg-grid">
        <div className="qg-tile bad">
          <span>Quality Gate - Failed's</span>
          <strong>{qg.testsFailed}</strong>
          <small>Soma Tests Failed</small>
        </div>
        <div className="qg-tile ok">
          <span>Quality Gate - Passed's</span>
          <strong>{qg.testsPassed}</strong>
          <small>Soma Tests Passed</small>
        </div>
        <div className={`qg-result tone-${total ? (hit ? 'ok' : 'bad') : 'neutral'}`}>
          <div className="goal-head">
            <span className="goal-label">Resultado na pipeline</span>
            {total > 0 && (
              <span className={`badge small tone-${hit ? 'ok' : 'bad'}`}>
                {hit ? <CheckCircle2 size={12} /> : <XCircle size={12} />}
                {hit ? 'Meta atingida' : 'Abaixo da meta'}
              </span>
            )}
          </div>
          <div className="goal-value">{fmtPct2(qg.rate)}</div>
          <div className="goal-track" title={`Meta: ${fmtPct2(goal)}`}>
            <div className="goal-fill" style={{ width: `${Math.min(100, (qg.rate ?? 0) * 100)}%` }} />
            <div className="goal-marker" style={{ left: `${goal * 100}%` }}>
              <span>{Math.round(goal * 100)}%</span>
            </div>
          </div>
          <div className="goal-foot">
            <span className="muted">
              {qg.testsPassed} ÷ ({qg.testsPassed} + {qg.testsFailed}) · {qg.suites.length} suites
            </span>
            {total > 0 && !hit && <span className="goal-missing">faltam {toConvert} falhas virarem passed</span>}
          </div>
        </div>
      </div>

      <div className={`qg-check tone-${agree ? 'ok' : 'warn'}`}>
        {agree ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}
        <div>
          <b>Conferência com as queries:</b> Consolidado {fmtPct2(consolidado.rate)} ({consolidado.passed}/{consolidado.total}{' '}
          cenários) × Quality Gate {fmtPct2(qg.rate)} ({qg.testsPassed}/{total} testes)
          {diff != null && (
            <span className="muted">
              {' '}
              · diferença de {diff >= 0 ? '+' : ''}
              {diff.toFixed(2).replace('.', ',')} p.p.
            </span>
          )}
          <div className="small">
            {agree
              ? hit
                ? 'Os dois estão acima da meta: a pipeline deve passar.'
                : 'Os dois estão abaixo da meta: a pipeline vai barrar a subida.'
              : hit
                ? 'Atenção: as queries estão abaixo da meta, mas o Quality Gate está acima. Confira as suites.'
                : 'Atenção: as queries batem a meta, mas o Quality Gate da pipeline está abaixo. A subida pode ser barrada.'}
          </div>
        </div>
      </div>

      <div className="qg-actions">
        <button type="button" className="btn small" onClick={() => setShowSuites((v) => !v)} disabled={!failedSuites.length}>
          {showSuites ? 'Ocultar' : 'Ver'} suites com falha ({failedSuites.length})
        </button>
        {qg.queryUrl && (
          <a className="btn small ghost" href={qg.queryUrl} target="_blank" rel="noreferrer">
            <ExternalLink size={14} /> {qg.queryName ?? 'Abrir query'}
          </a>
        )}
      </div>

      {showSuites && (
        <ul className="qg-suites">
          {failedSuites.map((s) => (
            <li key={s.id}>
              <IdLink id={s.id} url={s.url} />
              <span className="ellipsis" title={s.title}>
                {s.title}
              </span>
              <span className="small text-ok nowrap">{s.testsPassed} passed</span>
              <span className="small text-bad nowrap">
                <b>{s.testsFailed}</b> failed
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

const duration = (s: RegSuite) => {
  if (!s.start || !s.end) return '—';
  const min = Math.round((new Date(s.end).getTime() - new Date(s.start).getTime()) / 60000);
  if (min < 60) return `${min} min`;
  if (min < 1440) return `${Math.floor(min / 60)}h ${min % 60}min`;
  return `${Math.floor(min / 1440)}d ${Math.floor((min % 1440) / 60)}h`;
};

const PAGE = 15;

/** Resumo + tabela das suites de regressão do ambiente */
export function SuitesPanel({ suites }: { suites: RegSuite[] }) {
  const [channel, setChannel] = useState<'all' | 'CORBAN' | 'Agencias'>('all');
  const [onlyFailed, setOnlyFailed] = useState(false);
  const [page, setPage] = useState(1);

  const filtered = useMemo(
    () =>
      suites
        .filter((s) => (channel === 'all' || s.channel === channel) && (!onlyFailed || s.stateKey === 'failed'))
        .sort((a, b) => Number(b.stateKey === 'failed') - Number(a.stateKey === 'failed') || (b.end ?? '').localeCompare(a.end ?? '')),
    [suites, channel, onlyFailed],
  );
  const scope = suites.filter((s) => channel === 'all' || s.channel === channel);
  const failedSuites = scope.filter((s) => s.stateKey === 'failed').length;
  const tp = scope.reduce((n, s) => n + s.testsPassed, 0);
  const tf = scope.reduce((n, s) => n + s.testsFailed, 0);
  const hasAgn = suites.some((s) => s.channel === 'Agencias');

  if (!suites.length) return <p className="muted">Nenhuma suite de regressão encontrada para este ambiente.</p>;

  return (
    <>
      <div className="suite-summary">
        <div>
          <strong>{scope.length}</strong>
          <span className="muted small">suites</span>
        </div>
        <div>
          <strong className="text-bad">{failedSuites}</strong>
          <span className="muted small">suites com falha</span>
        </div>
        <div>
          <strong>
            <span className="text-ok">{tp}</span> / <span className="text-bad">{tf}</span>
          </strong>
          <span className="muted small">testes passed / failed (última execução)</span>
        </div>
        <div>
          <strong>{fmtPct2(tp + tf ? tp / (tp + tf) : null)}</strong>
          <span className="muted small">sucesso dos testes nas suites</span>
        </div>
      </div>

      <div className="table-filters">
        {hasAgn && (
          <div className="segmented">
            {(['all', 'CORBAN', 'Agencias'] as const).map((c) => (
              <button
                key={c}
                type="button"
                className={channel === c ? 'active' : ''}
                onClick={() => {
                  setChannel(c);
                  setPage(1);
                }}
              >
                {c === 'all' ? 'Todas' : c === 'Agencias' ? 'Agências' : c}
              </button>
            ))}
          </div>
        )}
        <label className="sev-toggle" style={{ marginLeft: 0 }}>
          <input type="checkbox" checked={onlyFailed} onChange={(e) => (setOnlyFailed(e.target.checked), setPage(1))} />
          Somente com falha
        </label>
      </div>

      <div className="table-wrap">
        <table className="table auto-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Suite</th>
              <th>Canal</th>
              <th>State</th>
              <th className="num">Passed</th>
              <th className="num">Failed</th>
              <th>Última execução</th>
              <th>Duração</th>
            </tr>
          </thead>
          <tbody>
            {filtered.slice((page - 1) * PAGE, page * PAGE).map((s) => (
              <tr key={s.id}>
                <td>
                  <IdLink id={s.id} url={s.url} />
                </td>
                <td className="auto-title" title={`${s.title}${s.onlyFailed ? '\nReexecução só das falhas' : ''}`}>
                  {s.title}
                  {s.onlyFailed && <span className="muted small"> · só falhas</span>}
                </td>
                <td className="small nowrap">{s.channel === 'Agencias' ? 'Agências' : s.channel}</td>
                <td>
                  <StateBadge state={s.state} stateKey={s.stateKey} />
                </td>
                <td className="num text-ok">{s.testsPassed}</td>
                <td className={`num ${s.testsFailed ? 'text-bad' : 'muted'}`}>{s.testsFailed}</td>
                <td className="small nowrap">{fmtDateTime(s.end ?? s.start)}</td>
                <td className="small nowrap muted">{duration(s)}</td>
              </tr>
            ))}
            {!filtered.length && (
              <tr>
                <td colSpan={8} className="muted" style={{ textAlign: 'center', padding: 20 }}>
                  Nenhuma suite com esses filtros.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <Pagination page={page} pageSize={PAGE} total={filtered.length} noun="suites" onChange={setPage} />
    </>
  );
}
