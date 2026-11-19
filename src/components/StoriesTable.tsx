import type { StorySummary } from '../../shared/types';
import { ApprovalBar, HealthBadge, IdLink } from './ui';

export function StoriesTable({
  stories,
  selectedId,
  onSelect,
  showSprint = false,
}: {
  stories: StorySummary[];
  selectedId?: number | null;
  onSelect: (id: number) => void;
  showSprint?: boolean;
}) {
  return (
    <div className="table-wrap">
      <table className="table">
        <thead>
          <tr>
            <th>ID</th>
            <th>User Story</th>
            {showSprint && <th>Status</th>}
            <th className="num">Testes</th>
            <th>Aprovação</th>
            <th className="num" title="Bugs abertos">Bugs</th>
            <th>Saúde</th>
          </tr>
        </thead>
        <tbody>
          {stories.map((s) => (
            <tr key={s.id} className={s.id === selectedId ? 'selected' : ''} onClick={() => onSelect(s.id)}>
              <td>
                <IdLink id={s.id} url={s.url} />
              </td>
              <td className="title-cell" title={s.title}>
                {s.title}
              </td>
              {showSprint && <td className="muted small nowrap">{s.state}</td>}
              <td className="num">{s.metrics.total}</td>
              <td>
                <ApprovalBar rate={s.metrics.approvalRate} />
              </td>
              <td className="num">{s.metrics.openBugs}</td>
              <td>
                <HealthBadge health={s.metrics.health} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
