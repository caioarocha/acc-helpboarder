import { config } from './config';
import { computeMetrics, stateKeyOf } from '../shared/metrics';
import type { BugItem, ExecutionMode, Iteration, StorySummary, SuiteItem, TestCaseItem } from '../shared/types';

const API = 'api-version=7.1';
const CHILD = 'System.LinkTypes.Hierarchy-Forward';
const RELATED = 'System.LinkTypes.Related';

export class HttpError extends Error {
  constructor(message: string, public status = 500) {
    super(message);
  }
}

const orgUrl = () => `https://dev.azure.com/${encodeURIComponent(config.org)}`;
export const projUrl = () => `${orgUrl()}/${encodeURIComponent(config.project)}`;
const workItemUrl = (id: number) => `${projUrl()}/_workitems/edit/${id}`;

export async function az<T>(url: string, body?: unknown): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, {
      method: body === undefined ? 'GET' : 'POST',
      headers: {
        Authorization: `Basic ${Buffer.from(`:${config.pat}`).toString('base64')}`,
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      redirect: 'manual',
    });
  } catch (e) {
    throw new HttpError(
      `Não foi possível conectar ao Azure DevOps (${(e as Error).message}). Verifique a rede ou o proxy.`,
      502,
    );
  }

  // PAT inválido costuma voltar 401, ou 203/302 com a página de login em HTML.
  if (res.status === 401 || res.status === 203 || (res.status >= 300 && res.status < 400)) {
    throw new HttpError('PAT inválido ou expirado. Gere um novo token com o escopo "Work Items: Read".', 401);
  }
  if (res.status === 403) {
    throw new HttpError('O PAT não tem permissão para este recurso (precisa de "Work Items: Read").', 403);
  }
  const text = await res.text();
  if (res.status === 404) {
    throw new HttpError('Organização ou projeto não encontrado. Confira AZDO_ORG e AZDO_PROJECT no .env.', 404);
  }
  if (!res.ok) {
    let msg = text;
    try {
      msg = JSON.parse(text).message ?? text;
    } catch {
      /* mantém o texto */
    }
    throw new HttpError(`Azure DevOps respondeu ${res.status}: ${msg}`.slice(0, 500), 502);
  }
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new HttpError('Resposta inesperada do Azure DevOps (não é JSON). Verifique o PAT.', 502);
  }
}

// ---------- Work items ----------

interface RawRelation {
  rel: string;
  url: string;
}
interface RawWorkItem {
  id: number;
  fields: Record<string, unknown>;
  relations?: RawRelation[] | null;
}

function text(v: unknown): string {
  if (v == null) return '';
  if (typeof v === 'object' && 'displayName' in v) return String((v as { displayName: unknown }).displayName);
  return String(v);
}
const field = (wi: RawWorkItem, name: string) => text(wi.fields[name]);
const isType = (wi: RawWorkItem, type: string) => field(wi, 'System.WorkItemType').toLowerCase() === type.toLowerCase();
const linked = (wi: RawWorkItem, rel: string) =>
  (wi.relations ?? [])
    .filter((r) => r.rel === rel)
    .map((r) => Number(r.url.split('/').pop()))
    .filter((n) => Number.isInteger(n));

async function getWorkItems(ids: number[]): Promise<Map<number, RawWorkItem>> {
  const unique = [...new Set(ids)];
  const chunks: number[][] = [];
  for (let i = 0; i < unique.length; i += 200) chunks.push(unique.slice(i, i + 200));
  const results = await Promise.all(
    chunks.map((chunk) =>
      az<{ value: (RawWorkItem | null)[] }>(`${projUrl()}/_apis/wit/workitemsbatch?${API}`, {
        ids: chunk,
        $expand: 'Relations',
        errorPolicy: 'Omit',
      }),
    ),
  );
  const map = new Map<number, RawWorkItem>();
  for (const r of results) for (const wi of r.value) if (wi) map.set(wi.id, wi);
  return map;
}

// ---------- Campo Execution Mode ----------

let execFieldPromise: Promise<string | null> | null = null;

function getExecutionModeField(): Promise<string | null> {
  if (config.executionModeField) return Promise.resolve(config.executionModeField);
  execFieldPromise ??= az<{ value: { name: string; referenceName: string }[] }>(`${projUrl()}/_apis/wit/fields?${API}`)
    .then((r) => r.value.find((f) => f.name.trim().toLowerCase() === 'execution mode')?.referenceName ?? null)
    .catch((e) => {
      execFieldPromise = null;
      throw e;
    });
  return execFieldPromise;
}

function toExecutionMode(value: string): ExecutionMode {
  const v = value.toLowerCase();
  if (v.includes('auto')) return 'Automatic';
  if (v.includes('manual')) return 'Manual';
  return 'Unknown';
}

// ---------- Montagem das User Stories ----------

export async function loadStories(ids: number[]) {
  const warnings: string[] = [];
  const execField = await getExecutionModeField();
  if (!execField) {
    warnings.push('Campo "Execution Mode" não encontrado. Defina AZDO_FIELD_EXECUTION_MODE no .env.');
  }

  // 1) User Stories
  const usMap = await getWorkItems(ids);
  const stories = ids.map((id) => usMap.get(id)).filter((w): w is RawWorkItem => !!w);
  const notFound = ids.filter((id) => !usMap.has(id));

  // 2) Filhos das US (Test Suite IPC e, se houver, Test Cases diretos)
  const children = await getWorkItems(stories.flatMap((s) => linked(s, CHILD)));

  // 3) Filhos das suites (Test Cases)
  const suites = [...children.values()].filter((w) => isType(w, config.types.suite));
  const suiteChildIds = suites.flatMap((s) => linked(s, CHILD)).filter((id) => !children.has(id));
  const suiteChildren = await getWorkItems(suiteChildIds);
  const testRaw = new Map<number, RawWorkItem>();
  for (const w of [...children.values(), ...suiteChildren.values()]) {
    if (isType(w, config.types.test)) testRaw.set(w.id, w);
  }

  // 4) Bugs ligados aos Test Cases (Related ou filho)
  const bugCandidates = [...testRaw.values()].flatMap((t) => [...linked(t, RELATED), ...linked(t, CHILD)]);
  const bugRaw = await getWorkItems(bugCandidates);
  const bugs = new Map<number, BugItem>();
  for (const w of bugRaw.values()) {
    if (!isType(w, config.types.bug)) continue;
    const state = field(w, 'System.State');
    bugs.set(w.id, {
      id: w.id,
      title: field(w, 'System.Title'),
      state,
      severity: field(w, 'Microsoft.VSTS.Common.Severity') || null,
      isOpen: !config.bugClosedStates.includes(state.toLowerCase()),
      url: workItemUrl(w.id),
    });
  }

  const toTest = (w: RawWorkItem, suiteId: number | null): TestCaseItem => {
    const state = field(w, 'System.State');
    return {
      id: w.id,
      title: field(w, 'System.Title'),
      state,
      stateKey: stateKeyOf(state),
      executionMode: execField ? toExecutionMode(field(w, execField)) : 'Unknown',
      suiteId,
      assignedTo: field(w, 'System.AssignedTo') || null,
      url: workItemUrl(w.id),
      bugIds: [...linked(w, RELATED), ...linked(w, CHILD)].filter((id) => bugs.has(id)),
    };
  };

  const result: StorySummary[] = stories.map((us) => {
    const childList = linked(us, CHILD)
      .map((id) => children.get(id))
      .filter((w): w is RawWorkItem => !!w);
    const suiteList = childList.filter((w) => isType(w, config.types.suite));
    const tests: TestCaseItem[] = [];
    const seen = new Set<number>();
    for (const suite of suiteList) {
      for (const tid of linked(suite, CHILD)) {
        const t = testRaw.get(tid);
        if (t && !seen.has(tid)) {
          seen.add(tid);
          tests.push(toTest(t, suite.id));
        }
      }
    }
    for (const w of childList) {
      if (isType(w, config.types.test) && !seen.has(w.id)) {
        seen.add(w.id);
        tests.push(toTest(w, null));
      }
    }
    const storyBugs = [...new Set(tests.flatMap((t) => t.bugIds))]
      .map((id) => bugs.get(id))
      .filter((b): b is BugItem => !!b);
    const iterationPath = field(us, 'System.IterationPath');
    const suitesOut: SuiteItem[] = suiteList.map((s) => ({
      id: s.id,
      title: field(s, 'System.Title'),
      url: workItemUrl(s.id),
    }));
    return {
      id: us.id,
      title: field(us, 'System.Title'),
      state: field(us, 'System.State'),
      workItemType: field(us, 'System.WorkItemType'),
      assignedTo: field(us, 'System.AssignedTo') || null,
      iterationPath,
      sprint: iterationPath.split('\\').pop() ?? iterationPath,
      targetDate: field(us, 'Microsoft.VSTS.Scheduling.TargetDate') || null,
      url: workItemUrl(us.id),
      suites: suitesOut,
      testCases: tests,
      bugs: storyBugs,
      metrics: computeMetrics(tests, storyBugs),
    };
  });

  if (result.length && result.every((s) => s.suites.length === 0)) {
    warnings.push(
      `Nenhum work item do tipo "${config.types.suite}" foi encontrado como filho das US. Confira AZDO_TYPE_SUITE no .env.`,
    );
  }
  return { stories: result, notFound, warnings };
}

// ---------- Sprints ----------

interface RawNode {
  name: string;
  path: string;
  attributes?: { startDate?: string; finishDate?: string };
  children?: RawNode[];
}

/** "\\Projeto\\Iteration\\Sprint 1" -> "Projeto\\Sprint 1" */
function toIterationPath(nodePath: string) {
  const parts = nodePath.split('\\').filter(Boolean);
  if (parts[1]?.toLowerCase() === 'iteration') parts.splice(1, 1);
  return parts.join('\\');
}

export async function getIterations(): Promise<Iteration[]> {
  const root = await az<RawNode>(`${projUrl()}/_apis/wit/classificationnodes/Iterations?$depth=10&${API}`);
  const now = Date.now();
  const out: Iteration[] = [];
  const walk = (node: RawNode, isRoot: boolean) => {
    if (!isRoot) {
      const start = node.attributes?.startDate ?? null;
      const finish = node.attributes?.finishDate ?? null;
      const finishEnd = finish ? new Date(finish).getTime() + 24 * 3600 * 1000 : 0;
      out.push({
        path: toIterationPath(node.path),
        name: node.name,
        startDate: start,
        finishDate: finish,
        isCurrent: !!start && !!finish && new Date(start).getTime() <= now && now < finishEnd,
      });
    }
    node.children?.forEach((c) => walk(c, false));
  };
  walk(root, true);
  return out.sort((a, b) => {
    if (a.startDate && b.startDate) return b.startDate.localeCompare(a.startDate);
    if (a.startDate) return -1;
    if (b.startDate) return 1;
    return a.path.localeCompare(b.path);
  });
}

export async function storyIdsInIteration(iterationPath: string): Promise<number[]> {
  const esc = (s: string) => s.replace(/'/g, "''");
  let query =
    `SELECT [System.Id] FROM WorkItems WHERE [System.TeamProject] = @project` +
    ` AND [System.WorkItemType] = '${esc(config.types.story)}'` +
    ` AND [System.IterationPath] UNDER '${esc(iterationPath)}'` +
    ` AND [System.State] <> 'Removed'`;
  if (config.areaPath) query += ` AND [System.AreaPath] UNDER '${esc(config.areaPath)}'`;
  query += ' ORDER BY [System.Id]';
  const r = await az<{ workItems: { id: number }[] }>(`${projUrl()}/_apis/wit/wiql?${API}&$top=500`, { query });
  return r.workItems.map((w) => w.id);
}

export async function checkConnection() {
  await az(`${orgUrl()}/_apis/projects/${encodeURIComponent(config.project)}?${API}`);
}
