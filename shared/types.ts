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

// ---------- Automação ----------

export type Channel = 'CORBAN' | 'Agencias';
export type BuildStatus = 'construido' | 'em-construcao' | 'sem-tag';

export interface AutomationItem {
  id: number;
  title: string;
  state: string;
  stateKey: StateKey;
  url: string;
  channels: Channel[];
  build: BuildStatus;
  functionality: string;
  score: number | null;
  feature: string | null;
  scenarioTag: string | null;
  environments: string[];
  regression: boolean;
  stateChangeDate: string | null;
  createdDate: string | null;
}

export interface AutomationResponse {
  source: 'azure' | 'mock';
  syncedAt: string;
  queryName: string | null;
  queryUrl: string | null;
  items: AutomationItem[];
  warnings: string[];
}

// ---------- Regressão ----------

export type RegEnv = 'HML' | 'HFX';
export type RegGroupKey = 'corban' | 'agencias' | 'consolidado' | 'manualCorban' | 'manualAgencias';

export interface RegItem {
  id: number;
  title: string;
  state: string;
  stateKey: StateKey;
  url: string;
  stateChangeDate: string | null;
}

export interface RegGroup {
  key: RegGroupKey;
  label: string;
  queryName: string | null;
  queryUrl: string | null;
  total: number;
  passed: number;
  /** passed / total (0..1) */
  rate: number | null;
  counts: StateCounts;
  /** Vazio no consolidado (só contagens) */
  items: RegItem[];
}

export interface RegSuite {
  id: number;
  title: string;
  state: string;
  stateKey: StateKey;
  url: string;
  channel: Channel;
  testsPassed: number;
  testsFailed: number;
  start: string | null;
  end: string | null;
  jobStatus: string | null;
  onlyFailed: boolean;
}

/** Quality Gate da pipeline da GMUD: soma de Tests Passed / Tests Failed das suites da esteira */
export interface RegQualityGate {
  queryName: string | null;
  queryUrl: string | null;
  testsPassed: number;
  testsFailed: number;
  /** passed / (passed + failed) */
  rate: number | null;
  suites: RegSuite[];
}

export interface RegEnvData {
  groups: Record<RegGroupKey, RegGroup>;
  suites: RegSuite[];
  qualityGate: RegQualityGate | null;
  lastExecution: string | null;
}

export interface RegHistoryPoint {
  date: string;
  env: RegEnv;
  corban: number | null;
  agencias: number | null;
  consolidado: number | null;
  qualityGate?: number | null;
}

export interface RegressionResponse {
  source: 'azure' | 'mock';
  syncedAt: string;
  goal: number;
  environments: Record<RegEnv, RegEnvData>;
  history: RegHistoryPoint[];
}

export interface ConnectionStatus {
  mode: 'azure' | 'mock';
  connected: boolean;
  organization: string | null;
  project: string | null;
  error: string | null;
}
