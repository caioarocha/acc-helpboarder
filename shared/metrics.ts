import type { BugItem, Health, Metrics, StateCounts, StateKey, TestCaseItem } from './types';

/**
 * Regras de saúde da US. Ajuste aqui para mudar os critérios.
 * - sem-testes:    nenhum Test Case (fora os Cancelled)
 * - nao-executada: nenhum teste executado ainda (só Ready / In Progress)
 * - critica:       Failed + Blocked >= 30% dos testes, ou 3+ bugs abertos
 * - saudavel:      aprovação >= 90%, sem Failed/Blocked e sem bugs abertos
 * - atencao:       qualquer outro caso
 */
export const HEALTH_RULES = {
  criticalFailRatio: 0.3,
  criticalOpenBugs: 3,
  healthyMinApproval: 0.9,
};

export function stateKeyOf(state: string): StateKey {
  switch (state.trim().toLowerCase()) {
    case 'passed':
      return 'passed';
    case 'failed':
      return 'failed';
    case 'blocked':
      return 'blocked';
    case 'in progress':
      return 'inProgress';
    case 'ready':
      return 'ready';
    case 'new':
      return 'new';
    case 'cancelled':
    case 'canceled':
      return 'cancelled';
    default:
      return 'other';
  }
}

export const emptyCounts = (): StateCounts => ({
  passed: 0,
  failed: 0,
  blocked: 0,
  inProgress: 0,
  ready: 0,
  new: 0,
  cancelled: 0,
  other: 0,
});

export function healthOf(total: number, executed: number, counts: StateCounts, openBugs: number): Health {
  if (total === 0) return 'sem-testes';
  if (executed === 0 && openBugs === 0) return 'nao-executada';
  const failRatio = (counts.failed + counts.blocked) / total;
  if (failRatio >= HEALTH_RULES.criticalFailRatio || openBugs >= HEALTH_RULES.criticalOpenBugs) return 'critica';
  const approval = counts.passed / total;
  if (approval >= HEALTH_RULES.healthyMinApproval && counts.failed === 0 && counts.blocked === 0 && openBugs === 0) {
    return 'saudavel';
  }
  return 'atencao';
}

export function computeMetrics(tests: TestCaseItem[], bugs: BugItem[]): Metrics {
  const counts = emptyCounts();
  let automated = 0;
  let manual = 0;
  let unknownMode = 0;
  for (const t of tests) {
    counts[t.stateKey]++;
    if (t.stateKey === 'cancelled') continue;
    if (t.executionMode === 'Automatic') automated++;
    else if (t.executionMode === 'Manual') manual++;
    else unknownMode++;
  }
  const total = tests.length - counts.cancelled;
  const executed = counts.passed + counts.failed + counts.blocked;
  const openBugs = bugs.filter((b) => b.isOpen).length;
  return {
    total,
    counts,
    executed,
    approvalRate: total ? counts.passed / total : null,
    executionRate: total ? executed / total : null,
    automated,
    manual,
    unknownMode,
    bugs: bugs.length,
    openBugs,
    health: healthOf(total, executed, counts, openBugs),
  };
}

export function uniqueById<T extends { id: number }>(items: T[]): T[] {
  const map = new Map<number, T>();
  for (const it of items) map.set(it.id, it);
  return [...map.values()];
}
