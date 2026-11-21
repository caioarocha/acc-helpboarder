// Dados fictícios usados enquanto o PAT não está configurado (modo demonstração).
import { computeMetrics, emptyCounts, stateKeyOf } from '../shared/metrics';
import type {
  AutomationItem,
  AutomationResponse,
  BugItem,
  Iteration,
  RegEnv,
  RegEnvData,
  RegGroup,
  RegGroupKey,
  RegHistoryPoint,
  RegItem,
  RegSuite,
  RegressionResponse,
  StorySummary,
  SuiteItem,
  TestCaseItem,
} from '../shared/types';

const TITLES = [
  'Formalização da proposta',
  'Validar biometria do cliente',
  'Editar dados da simulação',
  'Consultar extrato consolidado',
  'Contratar crédito pessoal',
  'Alterar limite do cartão',
  'Cadastro de chave Pix',
  'Emitir segunda via de boleto',
  'Simular financiamento imobiliário',
  'Autenticação com token',
  'Notificações de transações',
  'Renegociação de dívidas',
  'Abertura de conta digital',
  'Portabilidade de salário',
  'Agendamento de pagamentos',
  'Resgate de investimentos',
];
const PEOPLE = ['Maria Silva', 'João Pereira', 'Ana Souza', 'Bruno Lima', 'Carla Mendes', 'Diego Alves'];
const CHECKS = [
  'fluxo principal',
  'campos obrigatórios',
  'mensagem de erro',
  'limite de valor',
  'sessão expirada',
  'retorno da API',
  'layout em tela pequena',
  'permissão de acesso',
  'dados inválidos',
  'confirmação por e-mail',
  'histórico de alterações',
  'cancelamento pelo usuário',
  'timeout do serviço',
  'acessibilidade',
];

const CURRENT = 25;
const SPRINT_DAYS = 14;

function rng(seed: number) {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function sprintDates(n: number) {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - 5 + (n - CURRENT) * SPRINT_DAYS);
  const finish = new Date(start);
  finish.setDate(finish.getDate() + SPRINT_DAYS - 1);
  return { start, finish };
}

export function mockIterations(): Iteration[] {
  const out: Iteration[] = [];
  for (let n = CURRENT + 1; n >= CURRENT - 4; n--) {
    const { start, finish } = sprintDates(n);
    out.push({
      path: `Projeto Demo\\Sprint ${n}`,
      name: `Sprint ${n}`,
      startDate: start.toISOString(),
      finishDate: finish.toISOString(),
      isCurrent: n === CURRENT,
    });
  }
  return out;
}

const sprintOfId = (id: number) => {
  const n = Math.floor((id - 12000) / 20);
  return n >= CURRENT - 4 && n <= CURRENT + 1 ? n : CURRENT;
};

export function mockStoryIdsForIteration(path: string): number[] {
  const n = Number(/Sprint (\d+)/.exec(path)?.[1] ?? CURRENT);
  const count = 6 + (n % 4);
  return Array.from({ length: count }, (_, k) => 12000 + n * 20 + k);
}

function mockStory(id: number): StorySummary {
  const r = rng(id * 7919);
  const n = sprintOfId(id);
  const title = TITLES[id % TITLES.length];
  const count = r() < 0.08 ? 0 : 3 + Math.floor(r() * 11);
  const passP = 0.5 + r() * 0.5;
  const progress = n < CURRENT ? 1 : 0.75;

  const suites: SuiteItem[] = [{ id: 50000 + (id - 12000) * 2, title: `Test Suite IPC - ${title}`, url: '' }];
  if (count > 8) suites.push({ id: suites[0].id + 1, title: `Test Suite IPC - ${title} (regressão)`, url: '' });

  const tests: TestCaseItem[] = [];
  const bugs: BugItem[] = [];
  for (let i = 0; i < count; i++) {
    let state: string;
    if (n > CURRENT) state = 'Ready';
    else if (r() > progress) state = r() < 0.5 ? 'Ready' : 'In Progress';
    else {
      const x = r();
      state = x < passP ? 'Passed' : x < passP + (1 - passP) * 0.65 ? 'Failed' : 'Blocked';
    }
    if (r() < 0.04) state = 'Cancelled';

    const tcId = 30000 + (id - 12000) * 20 + i;
    const bugIds: number[] = [];
    if (state === 'Failed' && r() < 0.7) {
      const bugId = 80000 + (id - 12000) * 20 + i;
      bugIds.push(bugId);
      bugs.push({
        id: bugId,
        title: `Falha em ${CHECKS[i % CHECKS.length]} - ${title}`,
        state: r() < 0.8 ? 'Active' : 'Resolved',
        severity: ['1 - Critical', '2 - High', '3 - Medium', '4 - Low'][Math.floor(r() * 4)],
        isOpen: false,
        url: '',
      });
      bugs[bugs.length - 1].isOpen = bugs[bugs.length - 1].state === 'Active';
    }
    tests.push({
      id: tcId,
      title: `Validar ${CHECKS[i % CHECKS.length]}`,
      state,
      stateKey: stateKeyOf(state),
      executionMode: r() < 0.68 ? 'Automatic' : 'Manual',
      suiteId: suites[i > 7 && suites[1] ? 1 : 0].id,
      assignedTo: PEOPLE[(id + i) % PEOPLE.length],
      url: '',
      bugIds,
    });
  }

  const { finish } = sprintDates(n);
  return {
    id,
    title,
    state: n < CURRENT ? 'Closed' : n > CURRENT ? 'New' : r() < 0.6 ? 'Active' : 'Resolved',
    workItemType: 'User Story',
    assignedTo: PEOPLE[id % PEOPLE.length],
    iterationPath: `Projeto Demo\\Sprint ${n}`,
    sprint: `Sprint ${n}`,
    targetDate: finish.toISOString(),
    url: '',
    suites: count ? suites : [],
    testCases: tests,
    bugs,
    metrics: computeMetrics(tests, bugs),
  };
}

const FUNCTIONALITIES = [
  '01 - Pré-Análise',
  '02 - Simulação',
  '03 - Proposta',
  '04 - Formalização',
  '08 - Painel',
  '09 - Pagamentos',
  '11 - Login e Gestão de Acessos',
];

export function mockAutomation(): AutomationResponse {
  const r = rng(42);
  const items: AutomationItem[] = [];
  for (let i = 0; i < 140; i++) {
    const building = r() < 0.06;
    const x = r();
    const state = building ? 'Blocked' : x < 0.42 ? 'Passed' : x < 0.8 ? 'Ready' : 'Failed';
    const id = 2600000 + i * 37;
    items.push({
      id,
      title: `${['PAG', 'PRO', 'FOR', 'SIM'][i % 4]} - Validar ${CHECKS[i % CHECKS.length]} - ${TITLES[i % TITLES.length]}`,
      state,
      stateKey: stateKeyOf(state),
      url: '',
      channels: [r() < 0.8 ? 'CORBAN' : 'Agencias'],
      build: building ? 'em-construcao' : 'construido',
      functionality: FUNCTIONALITIES[Math.floor(r() * FUNCTIONALITIES.length)],
      score: [64, 48, 36, 27, 24, null][Math.floor(r() * 6)],
      feature: `${TITLES[i % TITLES.length].replace(/\s+/g, '')}.feature`,
      scenarioTag: `@ct_${id}`,
      environments: ['HML'],
      regression: r() < 0.65,
      stateChangeDate: new Date(Date.now() - Math.floor(r() * 30) * 864e5).toISOString(),
      createdDate: new Date(Date.now() - Math.floor(Math.pow(r(), 0.7) * 600) * 864e5).toISOString(),
    });
  }
  return {
    source: 'mock',
    syncedAt: new Date().toISOString(),
    queryName: 'Query de demonstração',
    queryUrl: null,
    items,
    warnings: [],
  };
}

function mockRegGroup(key: RegGroupKey, label: string, n: number, passP: number, readyP: number, seed: number): RegGroup {
  const r = rng(seed);
  const counts = emptyCounts();
  const items: RegItem[] = [];
  for (let i = 0; i < n; i++) {
    const x = r();
    const state = x < readyP ? 'Ready' : x < readyP + (1 - readyP) * passP ? 'Passed' : r() < 0.85 ? 'Failed' : 'Blocked';
    const stateKey = stateKeyOf(state);
    counts[stateKey]++;
    items.push({
      id: 2500000 + seed * 1000 + i,
      title: `${['PAG', 'PRO', 'FOR', 'PRE'][i % 4]} - Validar ${CHECKS[i % CHECKS.length]} - ${TITLES[(i + seed) % TITLES.length]}`,
      state,
      stateKey,
      url: '',
      stateChangeDate: new Date(Date.now() - (seed % 5) * 864e5).toISOString(),
    });
  }
  return {
    key,
    label,
    queryName: `Query demo - ${label}`,
    queryUrl: null,
    total: n,
    passed: counts.passed,
    rate: n ? counts.passed / n : null,
    counts,
    items,
  };
}

function mockRegEnv(env: RegEnv): RegEnvData {
  const hml = env === 'HML';
  const corban = mockRegGroup('corban', 'CORBAN', 120, hml ? 0.72 : 0.97, 0, hml ? 11 : 21);
  const agencias = mockRegGroup('agencias', 'Agências', 30, hml ? 0.8 : 1, hml ? 0.9 : 0, hml ? 12 : 22);
  const counts = emptyCounts();
  for (const k of Object.keys(counts) as (keyof typeof counts)[]) counts[k] = corban.counts[k] + agencias.counts[k];
  const total = corban.total + agencias.total;
  const consolidado: RegGroup = {
    key: 'consolidado',
    label: 'Consolidado',
    queryName: 'Query demo - Consolidado',
    queryUrl: null,
    total,
    passed: counts.passed,
    rate: counts.passed / total,
    counts,
    items: [],
  };
  const r = rng(hml ? 7 : 8);
  const suites: RegSuite[] = Array.from({ length: hml ? 18 : 12 }, (_, i) => {
    const failed = r() < 0.45 ? 1 + Math.floor(r() * 3) : 0;
    const start = new Date(Date.now() - (i % 4) * 864e5 - 3600e3);
    return {
      id: 1970000 + i,
      title: `${['PRE', 'SIM', 'PRO', 'FOR', 'PAG'][i % 5]} - ${TITLES[i % TITLES.length]}`,
      state: failed ? 'Failed' : 'Passed',
      stateKey: failed ? 'failed' : 'passed',
      url: '',
      channel: i % 6 === 5 ? 'Agencias' : 'CORBAN',
      testsPassed: 2 + Math.floor(r() * 8),
      testsFailed: failed,
      start: start.toISOString(),
      end: new Date(start.getTime() + (3 + Math.floor(r() * 12)) * 60e3).toISOString(),
      jobStatus: 'Succeeded',
      onlyFailed: r() < 0.3,
    };
  });
  const qgPassed = suites.reduce((n, s) => n + s.testsPassed, 0);
  const qgFailed = suites.reduce((n, s) => n + s.testsFailed, 0);
  return {
    qualityGate: {
      queryName: `Query Esteira - ${env} (demo)`,
      queryUrl: null,
      testsPassed: qgPassed,
      testsFailed: qgFailed,
      rate: qgPassed / (qgPassed + qgFailed || 1),
      suites,
    },
    groups: {
      corban,
      agencias,
      consolidado,
      manualCorban: mockRegGroup('manualCorban', 'Manual · CORBAN', 8, 0.75, 0, hml ? 13 : 23),
      manualAgencias: mockRegGroup('manualAgencias', 'Manual · Agências', 4, 0.5, 0, hml ? 14 : 24),
    },
    suites,
    lastExecution: new Date().toISOString(),
  };
}

export function mockRegression(): RegressionResponse {
  const environments = { HML: mockRegEnv('HML'), HFX: mockRegEnv('HFX') };
  const history: RegHistoryPoint[] = [];
  for (let d = 13; d >= 0; d--) {
    const date = new Date(Date.now() - d * 864e5).toISOString().slice(0, 10);
    for (const env of ['HML', 'HFX'] as RegEnv[]) {
      const g = environments[env].groups;
      const drift = (d / 13) * 0.18;
      history.push({
        date,
        env,
        corban: Math.max(0, (g.corban.rate ?? 0) - drift),
        agencias: Math.max(0, (g.agencias.rate ?? 0) - drift * 0.6),
        consolidado: Math.max(0, (g.consolidado.rate ?? 0) - drift * 0.9),
      });
    }
  }
  return { source: 'mock', syncedAt: new Date().toISOString(), goal: 0.85, environments, history };
}

export function mockLoadStories(ids: number[]) {
  return { stories: ids.map(mockStory), notFound: [] as number[], warnings: [] as string[] };
}
