import { Bug, Calendar, ExternalLink, FolderTree, ListChecks, Timer, User } from 'lucide-react';
import type { StorySummary } from '../../shared/types';
import { fmtDate } from '../theme';
import { HealthBadge, IdLink, StackedBar, StateBadge, StateLegendList } from './ui';

export function StoryDetail({ story }: { story: StorySummary }) {
  const m = story.metrics;
  const suiteName = (id: number | null) => story.suites.find((s) => s.id === id)?.title ?? 'Sem suite';

  return (
    <aside className="card detail">
      <div className="detail-head">
        <div>
          <h2>US #{story.id}</h2>
          <p className="muted">{story.title}</p>
        </div>
        {story.url && (
          <a className="icon-btn" href={story.url} target="_blank" rel="noreferrer" title="Abrir no Azure DevOps">
            <ExternalLink size={18} />
          </a>
        )}
      </div>

      <div className="detail-pills">
        <div className="mini">
          <span className="mini-label">Status da US</span>
          <span className="pill">{story.state || '—'}</span>
        </div>
        <div className="mini">
          <span className="mini-label">Saúde da US</span>
          <HealthBadge health={m.health} />
        </div>
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
        <div className="section-title">Vínculos</div>
        <details className="link-group">
          <summary>
            <FolderTree size={16} /> Test Suites <span className="muted">{story.suites.length}</span>
          </summary>
          <ul>
            {story.suites.map((s) => (
              <li key={s.id}>
                <IdLink id={s.id} url={s.url} /> <span className="ellipsis">{s.title}</span>
              </li>
            ))}
            {!story.suites.length && <li className="muted">Nenhuma suite vinculada</li>}
          </ul>
        </details>
        <details className="link-group">
          <summary>
            <ListChecks size={16} /> Test Cases <span className="muted">{story.testCases.length}</span>
          </summary>
          <ul>
            {story.testCases.map((t) => (
              <li key={t.id} title={suiteName(t.suiteId)}>
                <IdLink id={t.id} url={t.url} />
                <span className="ellipsis">{t.title}</span>
                <StateBadge state={t.state} stateKey={t.stateKey} />
              </li>
            ))}
            {!story.testCases.length && <li className="muted">Nenhum Test Case</li>}
          </ul>
        </details>
        <details className="link-group">
          <summary>
            <Bug size={16} /> Bugs{' '}
            <span className="muted">
              {m.openBugs} abertos / {m.bugs}
            </span>
          </summary>
          <ul>
            {story.bugs.map((b) => (
              <li key={b.id}>
                <IdLink id={b.id} url={b.url} />
                <span className="ellipsis">{b.title}</span>
                <span className={`badge small tone-${b.isOpen ? 'bad' : 'neutral'}`}>{b.state}</span>
              </li>
            ))}
            {!story.bugs.length && <li className="muted">Nenhum bug vinculado</li>}
          </ul>
        </details>
      </div>

      <div className="detail-section">
        <div className="section-title">Informações adicionais</div>
        <dl className="info-list">
          <div>
            <dt>
              <User size={15} /> Responsável
            </dt>
            <dd>{story.assignedTo ?? '—'}</dd>
          </div>
          <div>
            <dt>
              <Timer size={15} /> Sprint
            </dt>
            <dd>{story.sprint || '—'}</dd>
          </div>
          <div>
            <dt>
              <Calendar size={15} /> Data prevista
            </dt>
            <dd>{fmtDate(story.targetDate)}</dd>
          </div>
        </dl>
        {story.url && (
          <a className="link-out" href={story.url} target="_blank" rel="noreferrer">
            <ExternalLink size={15} /> Abrir no Azure DevOps
          </a>
        )}
      </div>
    </aside>
  );
}
