export type ExecutionMode = 'Automatic' | 'Manual' | 'Unknown';

export type StateKey = 'passed' | 'failed' | 'blocked' | 'inProgress' | 'ready' | 'new' | 'cancelled' | 'other';
export type StateCounts = Record<StateKey, number>;

export type Health = 'saudavel' | 'atencao' | 'critica' | 'nao-executada' | 'sem-testes';

export interface TestCaseItem {
  id: number;
  title: string;
  state: string;
  stateKey: StateKey;
  executionMode: ExecutionMode;
  suiteId: number | null;
  assignedTo: string | null;
  url: string;
  bugIds: number[];
}

export interface BugItem {
  id: number;
  title: string;
  state: string;
  severity: string | null;
  isOpen: boolean;
  url: string;
}

export interface SuiteItem {
  id: number;
  title: string;
  url: string;
}

export interface Metrics {
  /** Test Cases considerados (sem os Cancelled) */
  total: number;
  counts: StateCounts;
  /** Passed + Failed + Blocked */
  executed: number;
  /** Passed / total */
  approvalRate: number | null;
  /** executed / total */
  executionRate: number | null;
  automated: number;
  manual: number;
  unknownMode: number;
  bugs: number;
  openBugs: number;
  health: Health;
}

export interface StorySummary {
  id: number;
  title: string;
  state: string;
  workItemType: string;
  assignedTo: string | null;
  iterationPath: string;
  sprint: string;
  targetDate: string | null;
  url: string;
  suites: SuiteItem[];
  testCases: TestCaseItem[];
  bugs: BugItem[];
  metrics: Metrics;
}

export interface StoriesResponse {
  source: 'azure' | 'mock';
  syncedAt: string;
  stories: StorySummary[];
  totals: Metrics & { stories: number };
  notFound: number[];
  warnings: string[];
}

export interface Iteration {
  path: string;
  name: string;
  startDate: string | null;
  finishDate: string | null;
  isCurrent: boolean;
}

export interface ConnectionStatus {
  mode: 'azure' | 'mock';
  connected: boolean;
  organization: string | null;
  project: string | null;
  error: string | null;
}
