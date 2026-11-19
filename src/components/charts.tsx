import { Bar, BarChart, CartesianGrid, Cell, LabelList, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { StateCounts, StorySummary } from '../../shared/types';
import { MODE_COLOR, PALETTE, STATES, fmtPct } from '../theme';

const tooltipStyle = {
  contentStyle: {
    background: PALETTE.p950,
    border: `1px solid ${PALETTE.p700}`,
    borderRadius: 10,
    color: PALETTE.text,
    fontSize: 12,
  },
  itemStyle: { color: PALETTE.text },
  labelStyle: { color: PALETTE.muted, marginBottom: 4 },
  cursor: { fill: 'rgba(224,170,255,0.06)' },
};

const axisTick = { fill: PALETTE.muted, fontSize: 12 };
const hideZero = (v: unknown) => (Number(v) > 0 ? String(v) : '');

/** Barras empilhadas: resultado dos testes por User Story */
export function ResultsByStoryChart({ stories }: { stories: StorySummary[] }) {
  const data = stories.map((s) => ({ name: `#${s.id}`, title: s.title, ...s.metrics.counts }));
  const totals = STATES.map((s) => ({ ...s, value: stories.reduce((acc, st) => acc + st.metrics.counts[s.key], 0) }));
  const height = Math.max(170, data.length * 40 + 40);

  return (
    <>
      <div className="chart-scroll">
        <ResponsiveContainer width="100%" height={height}>
          <BarChart data={data} layout="vertical" margin={{ top: 4, right: 12, bottom: 0, left: 0 }} barCategoryGap={8}>
            <CartesianGrid horizontal={false} stroke={PALETTE.grid} />
            <XAxis type="number" allowDecimals={false} tick={axisTick} axisLine={false} tickLine={false} />
            <YAxis type="category" dataKey="name" width={70} tick={axisTick} axisLine={false} tickLine={false} />
            <Tooltip cursor={tooltipStyle.cursor} content={(p) => <StoryTooltip {...(p as unknown as StoryTooltipProps)} />} />
            {STATES.map((s) => (
              <Bar key={s.key} dataKey={s.key} name={s.label} stackId="a" fill={s.color} isAnimationActive={false}>
                <LabelList dataKey={s.key} position="center" formatter={hideZero} fill={PALETTE.p950} fontSize={11} fontWeight={600} />
              </Bar>
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className="chart-legend">
        {totals.map((t) => (
          <span key={t.key}>
            <span className="swatch" style={{ background: t.color }} />
            {t.label} ({t.value})
          </span>
        ))}
      </div>
    </>
  );
}

interface StoryTooltipProps {
  active?: boolean;
  label?: string;
  payload?: { dataKey?: string; name?: string; value?: number; color?: string; payload?: { title?: string } }[];
}

function StoryTooltip({ active, label, payload }: StoryTooltipProps) {
  if (!active || !payload?.length) return null;
  const items = payload.filter((p) => Number(p.value) > 0);
  return (
    <div className="chart-tip">
      <div className="chart-tip-title">
        {label} · {payload[0]?.payload?.title}
      </div>
      {items.length ? (
        items.map((p) => (
          <div key={p.dataKey} className="chart-tip-row">
            <span className="swatch" style={{ background: p.color }} />
            {p.name}
            <b>{p.value}</b>
          </div>
        ))
      ) : (
        <div className="muted">Sem testes</div>
      )}
    </div>
  );
}

/** Colunas: quantidade de Test Cases por state */
export function StatusDistributionChart({ counts }: { counts: StateCounts }) {
  const data = STATES.map((s) => ({ label: s.label, value: counts[s.key], color: s.color }));
  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={data} margin={{ top: 18, right: 8, bottom: 0, left: -18 }}>
        <CartesianGrid vertical={false} stroke={PALETTE.grid} />
        <XAxis dataKey="label" tick={axisTick} axisLine={false} tickLine={false} interval={0} />
        <YAxis allowDecimals={false} tick={axisTick} axisLine={false} tickLine={false} />
        <Tooltip {...tooltipStyle} formatter={(v) => [v, 'Test Cases']} />
        <Bar dataKey="value" radius={[6, 6, 0, 0]} isAnimationActive={false} maxBarSize={48}>
          {data.map((d) => (
            <Cell key={d.label} fill={d.color} />
          ))}
          <LabelList dataKey="value" position="top" fill={PALETTE.text} fontSize={12} fontWeight={600} />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

/** Rosca: automatizados x manuais */
export function AutomationDonut({ automated, manual, unknown }: { automated: number; manual: number; unknown: number }) {
  const total = automated + manual + unknown;
  const data = [
    { name: 'Automatizados', value: automated, color: MODE_COLOR.Automatic },
    { name: 'Manuais', value: manual, color: MODE_COLOR.Manual },
    ...(unknown ? [{ name: 'Não definido', value: unknown, color: MODE_COLOR.Unknown }] : []),
  ];

  return (
    <div className="donut-wrap">
      <div className="donut">
        <ResponsiveContainer width="100%" height={180}>
          <PieChart>
            <Pie
              data={total ? data : [{ name: 'Sem testes', value: 1, color: PALETTE.grid }]}
              dataKey="value"
              innerRadius={62}
              outerRadius={84}
              startAngle={90}
              endAngle={-270}
              stroke="none"
              isAnimationActive={false}
            >
              {(total ? data : [{ color: PALETTE.grid }]).map((d, i) => (
                <Cell key={i} fill={d.color} />
              ))}
            </Pie>
            {total > 0 && <Tooltip {...tooltipStyle} />}
          </PieChart>
        </ResponsiveContainer>
        <div className="donut-center">
          <strong>{total ? fmtPct(automated / total) : '—'}</strong>
          <span>Automatizada</span>
        </div>
      </div>
      <ul className="donut-legend">
        {data.map((d) => (
          <li key={d.name}>
            <span className="swatch" style={{ background: d.color }} />
            <div>
              {d.name}
              <b>{d.value}</b>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
