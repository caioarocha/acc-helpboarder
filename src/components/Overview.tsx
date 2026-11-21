import { useMemo, type ReactNode } from 'react';
import { Link } from 'react-router';
import {
  ArrowRight,
  BookOpen,
  Bot,
  CheckCircle2,
  Bug as BugIcon,
  CircleCheck,
  Clock,
  Hammer,
  Hourglass,
  RefreshCcw,
  ShieldCheck,
  Target,
  TrendingUp,
  XCircle,
} from 'lucide-react';
import { Area, AreaChart, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { Health, RegEnv, RegGroup, StorySummary } from '../../shared/types';
import { emptyCounts } from '../../shared/metrics';
import { api, useAsync } from '../api';
import { HEALTH_META, PALETTE, approvalTone, fmtPct, fmtPct2 } from '../theme';
import { BuildDonut, buildGrowth } from './automationCharts';
import { StackedBar, StateLegendList } from './ui';
import { useSavedUsIds } from '../usIds';

const TONE_COLOR: Record<string, string> = {
  ok: '#4ADE80',
  warn: '#FBBF24',
  bad: '#FB7185',
  info: '#60A5FA',
  neutral: '#94A3B8',
  brand: PALETTE.p400,
};
const HEALTH_ORDER: Health[] = ['critica', 'atencao', 'nao-executada', 'sem-testes', 'saudavel'];


const daysAgo = (iso: string) => Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 864e5));
const fmtDay = (iso: string) => new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });

const goalTone = (rate: number | null | undefined, goal: number) => (rate == null ? 'neutral' : rate >= goal ? 'ok' : 'bad');
const missing = (g: RegGroup, goal: number) => Math.max(0, Math.ceil(goal * g.total - 1e-9) - g.passed);

/** Medidor circular com marca da meta */
function Ring({
  value,
  goal,
  size = 150,
  stroke = 14,
  tone,
  children,
}: {
  value: number | null | undefined;
  goal?: number;
  size?: number;
  stroke?: number;
  tone: string;
  children: ReactNode;
}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const v = Math.max(0, Math.min(1, value ?? 0));
  const color = TONE_COLOR[tone] ?? TONE_COLOR.brand;
  const tick = (() => {
    if (goal == null) return null;
    const a = ((goal * 360 - 90) * Math.PI) / 180;
    const inner = r - stroke / 2 - 3;
    const outer = r + stroke / 2 + 3;
    return {
      x1: size / 2 + inner * Math.cos(a),
      y1: size / 2 + inner * Math.sin(a),
      x2: size / 2 + outer * Math.cos(a),
      y2: size / 2 + outer * Math.sin(a),
    };
  })();
  return (
    <div className="ring" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <defs>
          <filter id={`glow-${tone}`} x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="4" result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(224,170,255,0.10)" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${v * c} ${c}`}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          filter={`url(#glow-${tone})`}
        />
        {tick && <line {...tick} stroke={PALETTE.p300} strokeWidth={3} strokeLinecap="round" />}
      </svg>
      <div className="ring-center">{children}</div>
    </div>
  );
}

/** Barra fina com preenchimento e marca opcional da meta */
function Bar({ value, goal, tone }: { value: number | null | undefined; goal?: number; tone: string }) {
  return (
    <div className="ovx-bar">
      <div className="ovx-bar-fill" style={{ width: `${Math.min(100, (value ?? 0) * 100)}%`, background: TONE_COLOR[tone] }} />
      {goal != null && <div className="ovx-bar-goal" style={{ left: `${goal * 100}%` }} />}
    </div>
  );
}

function Panel({
  icon,
  title,
  subtitle,
  to,
  className = '',
  children,
}: {
  icon: ReactNode;
  title: string;
  subtitle?: string;
  to: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section className={`card ovx-panel ${className}`}>
      <header className="ovx-panel-head">
        <span className="ovx-panel-icon">{icon}</span>
        <div>
          <h3>{title}</h3>
          {subtitle && <p className="muted small">{subtitle}</p>}
        </div>
        <Link to={to} className="ovx-open">
          Abrir aba <ArrowRight size={14} />
        </Link>
      </header>
      {children}
    </section>
  );
}

function Highlight({
  icon,
  label,
  value,
  sub,
  tone,
  loading,
}: {
  icon: ReactNode;
  label: string;
  value: ReactNode;
  sub: ReactNode;
  tone: string;
  loading?: boolean;
}) {
  return (
    <div className={`ovx-hl tone-${tone}`}>
      <div className="ovx-hl-top">
        <span className="ovx-hl-icon">{icon}</span>
        <span className="ovx-hl-label">{label}</span>
      </div>
      {loading ? <div className="skeleton ovx-hl-skel" /> : <strong className="ovx-hl-value">{value}</strong>}
      <span className="ovx-hl-sub">{sub}</span>
    </div>
  );
}

const sparkTooltip = {
  contentStyle: { background: PALETTE.p950, border: `1px solid ${PALETTE.p700}`, borderRadius: 10, fontSize: 12 },
  itemStyle: { color: PALETTE.text },
  labelStyle: { color: PALETTE.muted },
};

function PanelSkeleton({ height }: { height: number }) {
  return <div className="skeleton" style={{ height, borderRadius: 12 }} />;
}

/** Visão geral do projeto: o principal de Regressão, Automação e User Stories */
export function OverviewSection() {
  const { ids: usIds } = useSavedUsIds();
  const stories = useAsync(() => (usIds.length ? api.stories(usIds) : null), `ov-us-${usIds.join(',')}`);
  const automation = useAsync(() => api.automation(), 'ov-automation');
  const regression = useAsync(() => api.regression(), 'ov-regression');

  const goal = regression.data?.goal ?? 0.85;
  const envs = regression.data?.environments;

  // ----- Automação -----
  const auto = useMemo(() => {
    const items = automation.data?.items ?? [];
    const counts = emptyCounts();
    for (const i of items) counts[i.stateKey]++;
    const built = items.filter((i) => i.build === 'construido').length;
    const building = items.filter((i) => i.build === 'em-construcao').length;
    const executed = counts.passed + counts.failed;
    const channels = (['CORBAN', 'Agencias'] as const).map((c) => {
      const list = items.filter((i) => i.channels.includes(c));
      const b = list.filter((i) => i.build === 'construido').length;
      return { key: c, label: c === 'Agencias' ? 'Agências' : c, total: list.length, rate: list.length ? b / list.length : null };
    });
    const growth = buildGrowth(items.map((i) => i.createdDate));
    const recent = growth.slice(-3).reduce((n, p) => n + p.novos, 0);
    return {
      total: items.length,
      built,
      building,
      builtRate: items.length ? built / items.length : null,
      counts,
      success: executed ? counts.passed / executed : null,
      channels,
      growth,
      recent,
    };
  }, [automation.data]);

  // ----- User Stories -----
  const us = useMemo(() => {
    const list = stories.data?.stories ?? [];
    const health = Object.fromEntries(HEALTH_ORDER.map((h) => [h, 0])) as Record<Health, number>;
    for (const s of list) health[s.metrics.health]++;
    const attention = list
      .filter((s) => s.metrics.health === 'critica' || s.metrics.health === 'atencao')
      .sort((a, b) => (a.metrics.approvalRate ?? 0) - (b.metrics.approvalRate ?? 0))
      .slice(0, 4);
    return { list, health, attention };
  }, [stories.data]);
  const ust = stories.data?.totals;

  // ----- Histórico da regressão (consolidado) -----
  const history = useMemo(() => {
    const byDate = new Map<string, { label: string; HML: number | null; HFX: number | null }>();
    for (const p of regression.data?.history ?? []) {
      const row = byDate.get(p.date) ?? { label: p.date.split('-').reverse().slice(0, 2).join('/'), HML: null, HFX: null };
      row[p.env] = p.consolidado != null ? p.consolidado * 100 : null;
      byDate.set(p.date, row);
    }
    return [...byDate.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([, v]) => v);
  }, [regression.data]);

  // Destaques que não aparecem nos painéis abaixo
  const usPending = useMemo(() => {
    const c = stories.data?.totals.counts;
    if (!c) return null;
    return {
      total: c.new + c.ready + c.inProgress,
      parts: [
        c.inProgress && `${c.inProgress} in progress`,
        c.ready && `${c.ready} ready`,
        c.new && `${c.new} new`,
      ]
        .filter(Boolean)
        .join(' · '),
    };
  }, [stories.data]);
  const openBugs = useMemo(() => {
    if (!stories.data) return null;
    const unique = new Map<number, { isOpen: boolean; severity: string | null }>();
    for (const s of stories.data.stories) for (const b of s.bugs) unique.set(b.id, b);
    const open = [...unique.values()].filter((b) => b.isOpen);
    const sev = new Map<string, { order: number; n: number }>();
    for (const b of open) {
      const m = /^(\d+)\s*-\s*(.+)$/.exec(b.severity ?? '');
      const label = m ? m[2] : b.severity || 'Sem severidade';
      const cur = sev.get(label) ?? { order: m ? Number(m[1]) : 99, n: 0 };
      cur.n++;
      sev.set(label, cur);
    }
    const bySeverity = [...sev.entries()]
      .sort((a, b) => a[1].order - b[1].order)
      .map(([label, v]) => `${v.n} ${label}`)
      .join(' · ');
    return { open: open.length, total: unique.size, bySeverity };
  }, [stories.data]);
  const lastRun = { hml: envs?.HML.lastExecution ?? null, hfx: envs?.HFX.lastExecution ?? null };

  return (
    <div className="ovx">
      {/* Destaques */}
      <div className="ovx-highlights">
        <Highlight
          icon={<Hourglass size={16} />}
          label="Pendentes nas US"
          value={usIds.length ? (usPending?.total ?? '—') : '—'}
          sub={
            !usIds.length
              ? 'nenhuma US consultada'
              : usPending
                ? usPending.parts || 'todos os Test Cases executados'
                : 'carregando…'
          }
          tone={!usIds.length || !usPending ? 'neutral' : usPending.total ? 'warn' : 'ok'}
          loading={usIds.length > 0 && !stories.data && !stories.error}
        />
        <Highlight
          icon={<BugIcon size={16} />}
          label="Bugs abertos nas US"
          value={usIds.length ? (openBugs?.open ?? '—') : '—'}
          sub={
            !usIds.length
              ? 'nenhuma US consultada'
              : openBugs
                ? openBugs.open
                  ? `${openBugs.bySeverity} · ${openBugs.total} no total`
                  : `nenhum aberto · ${openBugs.total} no total`
                : 'carregando…'
          }
          tone={!usIds.length || !openBugs ? 'neutral' : openBugs.open ? 'bad' : 'ok'}
          loading={usIds.length > 0 && !stories.data && !stories.error}
        />
        <Highlight
          icon={<Clock size={16} />}
          label="Última execução · HML"
          value={lastRun.hml ? fmtDay(lastRun.hml) : '—'}
          sub={
            lastRun.hml
              ? `HML há ${daysAgo(lastRun.hml)} dia(s) · HFX ${lastRun.hfx ? `${fmtDay(lastRun.hfx)} (${daysAgo(lastRun.hfx)}d)` : '—'}`
              : 'HML e HFX'
          }
          tone={lastRun.hml ? (daysAgo(lastRun.hml) > 7 ? 'warn' : 'info') : 'neutral'}
          loading={!envs && !regression.error}
        />
        <Highlight
          icon={<Bot size={16} />}
          label="Automação construída"
          value={fmtPct(auto.builtRate)}
          sub={`${auto.built} de ${auto.total} cenários`}
          tone="brand"
          loading={!automation.data && !automation.error}
        />
        <Highlight
          icon={<CircleCheck size={16} />}
          label="Aprovação das US"
          value={usIds.length ? fmtPct(ust?.approvalRate) : '—'}
          sub={usIds.length ? `${ust?.stories ?? '…'} US · ${ust?.total ?? '…'} test cases` : 'nenhuma US consultada'}
          tone={usIds.length ? approvalTone(ust?.approvalRate ?? null) : 'neutral'}
          loading={usIds.length > 0 && !stories.data && !stories.error}
        />
      </div>

      {/* Regressão */}
      <Panel
        icon={<RefreshCcw size={18} />}
        title="Regressão"
        subtitle={`Meta ${fmtPct2(goal)} · Passed ÷ total da query · automatizado (CORBAN + Agências)`}
        to="/regressao"
      >
        {regression.error ? (
          <p className="ovx-error">{regression.error}</p>
        ) : !envs ? (
          <PanelSkeleton height={260} />
        ) : (
          <div className="ovx-reg">
            {(['HML', 'HFX'] as RegEnv[]).map((env) => {
              const e = envs[env];
              const cons = e.groups.consolidado;
              const tone = goalTone(cons.rate, goal);
              const q = e.qualityGate;
              const qTone = goalTone(q?.rate, goal);
              const miss = missing(cons, goal);
              return (
                <div key={env} className={`ovx-env tone-${tone}`}>
                  <div className="ovx-env-head">
                    <span className="ovx-env-pill">{env}</span>
                    <span className={`badge small tone-${tone}`}>
                      {tone === 'ok' ? <CheckCircle2 size={12} /> : <XCircle size={12} />}
                      {tone === 'ok' ? 'Meta atingida' : 'Abaixo da meta'}
                    </span>
                  </div>
                  <div className="ovx-env-body">
                    <Ring value={cons.rate} goal={goal} tone={tone}>
                      <strong>{fmtPct2(cons.rate)}</strong>
                      <span>consolidado</span>
                      <small>
                        {cons.passed}/{cons.total}
                      </small>
                    </Ring>
                    <div className="ovx-env-side">
                      {[e.groups.corban, e.groups.agencias].map((g) => (
                        <div key={g.key} className="ovx-row">
                          <div className="ovx-row-top">
                            <span>{g.label}</span>
                            <b className={`text-${goalTone(g.rate, goal) === 'ok' ? 'ok' : 'bad'}`}>{fmtPct2(g.rate)}</b>
                          </div>
                          <Bar value={g.rate} goal={goal} tone={goalTone(g.rate, goal)} />
                          <span className="muted small">
                            {g.passed}/{g.total} passed
                            {g.counts.ready > 0 && ` · ${g.counts.ready} não executados`}
                          </span>
                        </div>
                      ))}
                      {q && (
                        <div className={`ovx-qg tone-${qTone}`} title="Soma de Tests Passed/Failed das suites da esteira (pipeline da GMUD)">
                          <ShieldCheck size={14} />
                          <span>Quality Gate</span>
                          <b>{fmtPct2(q.rate)}</b>
                          <span className="muted small">
                            {q.testsPassed}/{q.testsPassed + q.testsFailed}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="ovx-env-foot">
                    {miss > 0 ? (
                      <>
                        <Target size={13} /> Faltam <b>{miss}</b> cenários passarem para bater {Math.round(goal * 100)}%
                      </>
                    ) : (
                      <>
                        <CheckCircle2 size={13} /> <b>{cons.passed - Math.ceil(goal * cons.total - 1e-9)}</b> cenários acima da meta
                      </>
                    )}
                  </div>
                </div>
              );
            })}

            <div className="ovx-trend">
              <div className="ovx-trend-head">
                <TrendingUp size={15} />
                <span>Evolução do consolidado</span>
                <span className="muted small">{history.length} dia(s) gravado(s)</span>
              </div>
              <ResponsiveContainer width="100%" height={190}>
                <LineChart data={history} margin={{ top: 8, right: 8, bottom: 0, left: -24 }}>
                  <XAxis dataKey="label" tick={{ fill: PALETTE.muted, fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis domain={[0, 100]} tick={{ fill: PALETTE.muted, fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(v) => `${v}%`} />
                  <Tooltip {...sparkTooltip} formatter={(v) => fmtPct2(Number(v) / 100)} />
                  <ReferenceLine y={goal * 100} stroke={PALETTE.p300} strokeDasharray="5 4" />
                  <Line type="monotone" dataKey="HML" stroke={PALETTE.p400} strokeWidth={2.5} dot={{ r: 4 }} connectNulls isAnimationActive={false} />
                  <Line type="monotone" dataKey="HFX" stroke="#60A5FA" strokeWidth={2.5} dot={{ r: 4 }} connectNulls isAnimationActive={false} />
                </LineChart>
              </ResponsiveContainer>
              <div className="chart-legend">
                <span>
                  <span className="swatch" style={{ background: PALETTE.p400 }} /> HML
                </span>
                <span>
                  <span className="swatch" style={{ background: '#60A5FA' }} /> HFX
                </span>
                <span>
                  <Target size={12} /> meta
                </span>
              </div>
            </div>
          </div>
        )}
      </Panel>

      <div className="ovx-two">
        {/* Automação */}
        <Panel
          icon={<Bot size={18} />}
          title="Automação"
          subtitle={automation.data?.queryName ? `Query: ${automation.data.queryName}` : 'Escopo de cenários automatizados'}
          to="/automacao"
        >
          {automation.error ? (
            <p className="ovx-error">{automation.error}</p>
          ) : !automation.data ? (
            <PanelSkeleton height={380} />
          ) : (
            <div className="ovx-auto">
              <div className="ovx-auto-top">
                <BuildDonut built={auto.built} building={auto.building} />
                <div className="ovx-mini-stats">
                  <div className="ovx-mini tone-warn">
                    <Hammer size={15} />
                    <b>{auto.building}</b>
                    <span>em construção</span>
                  </div>
                  <div className={`ovx-mini tone-${approvalTone(auto.success)}`}>
                    <CircleCheck size={15} />
                    <b>{fmtPct(auto.success)}</b>
                    <span>sucesso na execução</span>
                  </div>
                </div>
              </div>

              <div className="ovx-block">
                <div className="ovx-block-title">Status de execução</div>
                <StackedBar counts={auto.counts} total={auto.total - auto.counts.cancelled} />
                <StateLegendList counts={auto.counts} hideZero />
              </div>

              <div className="ovx-block">
                <div className="ovx-block-title">Construído por canal</div>
                {auto.channels.map((c) => (
                  <div key={c.key} className="ovx-row">
                    <div className="ovx-row-top">
                      <span>
                        {c.label} <span className="muted small">· {c.total} cenários</span>
                      </span>
                      <b>{fmtPct(c.rate)}</b>
                    </div>
                    <Bar value={c.rate} tone="ok" />
                  </div>
                ))}
              </div>

              <div className="ovx-block">
                <div className="ovx-block-title">
                  Crescimento do escopo <span className="muted small">· +{auto.recent} nos últimos 3 meses</span>
                </div>
                <ResponsiveContainer width="100%" height={110}>
                  <AreaChart data={auto.growth} margin={{ top: 6, right: 4, bottom: 0, left: 4 }}>
                    <defs>
                      <linearGradient id="ovxGrowth" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={PALETTE.p400} stopOpacity={0.6} />
                        <stop offset="100%" stopColor={PALETTE.p400} stopOpacity={0.02} />
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="label" hide />
                    <Tooltip {...sparkTooltip} />
                    <Area
                      type="monotone"
                      dataKey="acumulado"
                      name="Total acumulado"
                      stroke={PALETTE.p300}
                      strokeWidth={2}
                      fill="url(#ovxGrowth)"
                      isAnimationActive={false}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}
        </Panel>

        {/* User Stories */}
        <Panel
          icon={<BookOpen size={18} />}
          title="User Stories"
          subtitle={usIds.length ? `${usIds.length} US da última consulta` : undefined}
          to="/user-stories"
        >
          {!usIds.length ? (
            <div className="ovx-empty">
              <BookOpen size={34} />
              <p>Nenhuma US consultada ainda.</p>
              <Link to="/user-stories" className="btn primary small">
                Informar IDs das US
              </Link>
            </div>
          ) : stories.error ? (
            <p className="ovx-error">{stories.error}</p>
          ) : !ust ? (
            <PanelSkeleton height={380} />
          ) : (
            <div className="ovx-us">
              <div className="ovx-us-top">
                <Ring value={ust.approvalRate} tone={approvalTone(ust.approvalRate)} size={140} stroke={13}>
                  <strong>{fmtPct(ust.approvalRate)}</strong>
                  <span>aprovação</span>
                </Ring>
                <div className="ovx-us-stats">
                  <div>
                    <b>{ust.stories}</b>
                    <span>US</span>
                  </div>
                  <div>
                    <b>{ust.total}</b>
                    <span>test cases</span>
                  </div>
                  <div>
                    <b>{fmtPct(ust.executionRate)}</b>
                    <span>executado</span>
                  </div>
                  <div className={ust.openBugs ? 'bad' : 'ok'}>
                    <b>{ust.openBugs}</b>
                    <span>bugs abertos</span>
                  </div>
                </div>
              </div>

              <div className="ovx-block">
                <div className="ovx-block-title">Saúde das User Stories</div>
                <div className="ovx-health-bar">
                  {HEALTH_ORDER.filter((h) => us.health[h] > 0).map((h) => (
                    <span
                      key={h}
                      className={`tone-${HEALTH_META[h].tone}`}
                      style={{ flex: us.health[h] }}
                      title={`${HEALTH_META[h].label}: ${us.health[h]}`}
                    >
                      {us.health[h]}
                    </span>
                  ))}
                </div>
                <div className="ovx-health-legend">
                  {HEALTH_ORDER.filter((h) => us.health[h] > 0).map((h) => (
                    <span key={h}>
                      <i className={`tone-${HEALTH_META[h].tone}`} /> {HEALTH_META[h].label} <b>{us.health[h]}</b>
                    </span>
                  ))}
                </div>
              </div>

              <div className="ovx-block">
                <div className="ovx-block-title">Pedem atenção</div>
                {us.attention.length ? (
                  <ul className="ovx-attention">
                    {us.attention.map((s: StorySummary) => (
                      <li key={s.id}>
                        <Link to={`/user-stories?ids=${usIds.join(',')}&sel=${s.id}`}>
                          <span className={`dot tone-${HEALTH_META[s.metrics.health].tone}`} />
                          <b>#{s.id}</b>
                          <span className="ellipsis">{s.title}</span>
                          <span className={`text-${approvalTone(s.metrics.approvalRate) === 'ok' ? 'ok' : 'bad'} nowrap`}>
                            {fmtPct(s.metrics.approvalRate)}
                          </span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="muted small">
                    <CheckCircle2 size={13} style={{ verticalAlign: '-2px', color: TONE_COLOR.ok }} /> Nenhuma US crítica ou em
                    atenção.
                  </p>
                )}
              </div>
            </div>
          )}
        </Panel>
      </div>
    </div>
  );
}
