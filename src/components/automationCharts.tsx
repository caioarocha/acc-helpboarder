import { Area, Bar, CartesianGrid, Cell, ComposedChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { PALETTE, fmtPct } from '../theme';

export const BUILD_COLOR = { construido: '#4ADE80', emConstrucao: '#FBBF24' };

const axisTick = { fill: PALETTE.muted, fontSize: 12 };

/** Rosca Construído x Em construção com o total no centro */
export function BuildDonut({ built, building }: { built: number; building: number }) {
  const total = built + building;
  const data = [
    { name: 'Construído', value: built, color: BUILD_COLOR.construido },
    { name: 'Em construção', value: building, color: BUILD_COLOR.emConstrucao },
  ];
  return (
    <div className="donut-wrap">
      <div className="donut">
        <ResponsiveContainer width="100%" height={180}>
          <PieChart>
            <Pie
              data={total ? data : [{ name: 'Vazio', value: 1, color: PALETTE.grid }]}
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
            {total > 0 && (
              <Tooltip
                contentStyle={{
                  background: PALETTE.p950,
                  border: `1px solid ${PALETTE.p700}`,
                  borderRadius: 10,
                  fontSize: 12,
                }}
                itemStyle={{ color: PALETTE.text }}
              />
            )}
          </PieChart>
        </ResponsiveContainer>
        <div className="donut-center">
          <strong>{total}</strong>
          <span>cenários</span>
        </div>
      </div>
      <ul className="donut-legend">
        {data.map((d) => (
          <li key={d.name}>
            <span className="swatch" style={{ background: d.color }} />
            <div>
              {d.name}
              <b>
                {d.value} · {total ? fmtPct(d.value / total) : '—'}
              </b>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Comparação por canal: barra de construído x em construção */
export function ChannelCompare({
  rows,
  active,
  onPick,
}: {
  rows: { key: string; label: string; built: number; building: number }[];
  active: string;
  onPick: (key: string) => void;
}) {
  const max = Math.max(1, ...rows.map((r) => r.built + r.building));
  return (
    <ul className="channel-list">
      {rows.map((r) => {
        const total = r.built + r.building;
        return (
          <li key={r.key}>
            <button
              type="button"
              className={`channel-row ${active === r.key ? 'active' : ''}`}
              onClick={() => onPick(active === r.key ? 'all' : r.key)}
              title={active === r.key ? 'Mostrar todos os canais' : `Filtrar por ${r.label}`}
            >
              <div className="channel-head">
                <strong>{r.label}</strong>
                <span className="muted small">
                  {total} cenários · {total ? fmtPct(r.built / total) : '—'} construído
                </span>
              </div>
              <div className="channel-track">
                <span style={{ width: `${(r.built / max) * 100}%`, background: BUILD_COLOR.construido }}>
                  {r.built > 0 && r.built / max > 0.08 ? r.built : ''}
                </span>
                <span style={{ width: `${(r.building / max) * 100}%`, background: BUILD_COLOR.emConstrucao }}>
                  {r.building > 0 && r.building / max > 0.06 ? r.building : ''}
                </span>
              </div>
              <div className="channel-foot small">
                <span>
                  <span className="swatch" style={{ background: BUILD_COLOR.construido }} /> {r.built} construído
                </span>
                <span>
                  <span className="swatch" style={{ background: BUILD_COLOR.emConstrucao }} /> {r.building} em construção
                </span>
              </div>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

const MONTHS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
const monthKey = (d: Date) => `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
const monthLabel = (key: string) => {
  const [y, m] = key.split('-');
  return `${MONTHS[Number(m) - 1]}/${y.slice(2)}`;
};

export interface GrowthPoint {
  key: string;
  label: string;
  novos: number;
  acumulado: number;
}

/** Agrupa as datas de criação por mês e calcula o acumulado (meses sem criação também aparecem). */
export function buildGrowth(dates: (string | null)[]): GrowthPoint[] {
  const perMonth = new Map<string, number>();
  for (const d of dates) {
    if (!d) continue;
    const k = monthKey(new Date(d));
    perMonth.set(k, (perMonth.get(k) ?? 0) + 1);
  }
  if (!perMonth.size) return [];
  const keys = [...perMonth.keys()].sort();
  const [y0, m0] = keys[0].split('-').map(Number);
  const end = monthKey(new Date());
  const last = keys[keys.length - 1] > end ? keys[keys.length - 1] : end;
  const out: GrowthPoint[] = [];
  let acc = 0;
  for (let y = y0, m = m0; ; m++) {
    if (m > 12) {
      m = 1;
      y++;
    }
    const k = `${y}-${String(m).padStart(2, '0')}`;
    const novos = perMonth.get(k) ?? 0;
    acc += novos;
    out.push({ key: k, label: monthLabel(k), novos, acumulado: acc });
    if (k >= last) break;
  }
  return out;
}

/** Área com o acumulado de cenários + colunas com os criados no mês */
export function ScopeGrowthChart({ points }: { points: GrowthPoint[] }) {
  if (!points.length) return <p className="muted sev-empty">Sem datas de criação para montar o gráfico.</p>;
  const last = points[points.length - 1];
  const recent = points.slice(-3).reduce((n, p) => n + p.novos, 0);
  const peak = points.reduce((a, b) => (b.novos > a.novos ? b : a));

  return (
    <>
      <div className="growth-summary">
        <div>
          <strong>{last.acumulado}</strong>
          <span className="muted small">cenários no escopo</span>
        </div>
        <div>
          <strong>+{recent}</strong>
          <span className="muted small">nos últimos 3 meses</span>
        </div>
        <div>
          <strong>{peak.novos}</strong>
          <span className="muted small">maior mês ({peak.label})</span>
        </div>
      </div>
      <ResponsiveContainer width="100%" height={280}>
        <ComposedChart data={points} margin={{ top: 10, right: 0, bottom: 0, left: -12 }}>
          <defs>
            <linearGradient id="growthFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={PALETTE.p400} stopOpacity={0.55} />
              <stop offset="100%" stopColor={PALETTE.p400} stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} stroke={PALETTE.grid} />
          <XAxis dataKey="label" tick={axisTick} axisLine={false} tickLine={false} minTickGap={16} />
          <YAxis yAxisId="acc" allowDecimals={false} tick={axisTick} axisLine={false} tickLine={false} />
          <YAxis
            yAxisId="new"
            orientation="right"
            allowDecimals={false}
            domain={[0, (max: number) => Math.max(4, Math.ceil((max * 2.2) / 10) * 10)]}
            tick={{ ...axisTick, fill: BUILD_COLOR.construido, fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            width={34}
          />
          <Tooltip
            cursor={{ fill: 'rgba(224,170,255,0.06)' }}
            contentStyle={{ background: PALETTE.p950, border: `1px solid ${PALETTE.p700}`, borderRadius: 10, fontSize: 12 }}
            itemStyle={{ color: PALETTE.text }}
            labelStyle={{ color: PALETTE.muted }}
          />
          <Bar
            yAxisId="new"
            dataKey="novos"
            name="Criados no mês"
            fill={BUILD_COLOR.construido}
            fillOpacity={0.75}
            radius={[4, 4, 0, 0]}
            maxBarSize={22}
            isAnimationActive={false}
          />
          <Area
            yAxisId="acc"
            type="monotone"
            dataKey="acumulado"
            name="Total acumulado"
            stroke={PALETTE.p300}
            strokeWidth={2.5}
            fill="url(#growthFill)"
            dot={false}
            activeDot={{ r: 4 }}
            isAnimationActive={false}
          />
        </ComposedChart>
      </ResponsiveContainer>
      <div className="chart-legend">
        <span>
          <span className="swatch" style={{ background: PALETTE.p300 }} />
          Total acumulado (escala à esquerda)
        </span>
        <span>
          <span className="swatch" style={{ background: BUILD_COLOR.construido }} />
          Criados no mês (escala à direita)
        </span>
      </div>
    </>
  );
}
