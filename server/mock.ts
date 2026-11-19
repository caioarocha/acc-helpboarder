// Dados fictícios usados enquanto o PAT não está configurado (modo demonstração).
import { computeMetrics, stateKeyOf } from '../shared/metrics';
import type { BugItem, Iteration, StorySummary, SuiteItem, TestCaseItem } from '../shared/types';

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

export function mockLoadStories(ids: number[]) {
  return { stories: ids.map(mockStory), notFound: [] as number[], warnings: [] as string[] };
}
