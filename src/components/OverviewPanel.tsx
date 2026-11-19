import { Bug, FolderTree, Layers, ListChecks } from 'lucide-react';
import type { Health, Metrics, StorySummary } from '../../shared/types';
import { HealthBadge, StackedBar, StateLegendList } from './ui';

const HEALTH_ORDER: Health[] = ['critica', 'atencao', 'nao-executada', 'sem-testes', 'saudavel'];

/** Painel lateral da aba User Stories quando nenhuma US está selecionada (visão geral). */
export function OverviewPanel({ stories, metrics: m }: { stories: StorySummary[]; metrics: Metrics }) {
  const health = Object.fromEntries(HEALTH_ORDER.map((h) => [h, 0])) as Record<Health, number>;
  for (const s of stories) health[s.metrics.health]++;
  const suites = stories.reduce((n, s) => n + s.suites.length, 0);

  return (
    <aside className="card detail">
      <div className="detail-head">
        <div>
          <h2>Visão geral</h2>
          <p className="muted">
            {stories.length} User {stories.length === 1 ? 'Story' : 'Stories'} selecionadas
          </p>
        </div>
        <span className="icon-btn" aria-hidden="true">
          <Layers size={18} />
        </span>
      </div>

      <div className="detail-section">
        <div className="section-title">
          Progresso dos testes <span className="muted small">{m.total} Test Cases</span>
        </div>
        <StackedBar counts={m.counts} total={m.total} />
        <StateLegendList counts={m.counts} />
        {m.counts.cancelled > 0 && <p className="muted small">{m.counts.cancelled} cancelado(s), fora do cálculo</p>}
      </div>

      <div className="detail-section">
        <div className="section-title">Saúde das User Stories</div>
        <ul className="health-list">
          {HEALTH_ORDER.map((h) => (
            <li key={h}>
              <HealthBadge health={h} />
              <b>{health[h]}</b>
            </li>
          ))}
        </ul>
      </div>

      <div className="detail-section">
        <div className="section-title">Vínculos</div>
        <dl className="info-list">
          <div>
            <dt>
              <FolderTree size={15} /> Test Suites
            </dt>
            <dd>{suites}</dd>
          </div>
          <div>
            <dt>
              <ListChecks size={15} /> Test Cases
            </dt>
            <dd>{m.total}</dd>
          </div>
          <div>
            <dt>
              <Bug size={15} /> Bugs
            </dt>
            <dd>
              {m.openBugs} abertos / {m.bugs}
            </dd>
          </div>
        </dl>
      </div>
    </aside>
  );
}
