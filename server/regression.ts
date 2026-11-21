import { az, projUrl } from './azure';
import { GROUP_LABEL, REG_GOAL, REG_QG_QUERIES, REG_QUERIES, REG_SUITE_QUERIES } from './regressionConfig';
import { saveSnapshot } from './regressionHistory';
import { emptyCounts, stateKeyOf } from '../shared/metrics';
import type {
  RegEnv,
  RegEnvData,
  RegGroup,
  RegGroupKey,
  RegItem,
  RegQualityGate,
  RegSuite,
  RegressionResponse,
} from '../shared/types';

const API = 'api-version=7.1';

type Raw = { id: number; fields: Record<string, unknown> };

async function runQuery(id: string): Promise<number[]> {
  const r = await az<{ workItems?: { id: number }[]; workItemRelations?: { target?: { id: number } }[] }>(
    `${projUrl()}/_apis/wit/wiql/${encodeURIComponent(id)}?${API}`,
  );
  const ids = r.workItems?.map((w) => w.id) ?? r.workItemRelations?.map((x) => x.target?.id ?? 0).filter(Boolean) ?? [];
  return [...new Set(ids)];
}

async function queryName(id: string): Promise<string | null> {
  try {
    return (await az<{ name: string }>(`${projUrl()}/_apis/wit/queries/${encodeURIComponent(id)}?${API}`)).name;
  } catch {
    return null;
  }
}

async function fetchItems(ids: number[], fields?: string[]): Promise<Map<number, Raw>> {
  const chunks: number[][] = [];
  for (let i = 0; i < ids.length; i += 200) chunks.push(ids.slice(i, i + 200));
  const res = await Promise.all(
    chunks.map((c) =>
      az<{ value: (Raw | null)[] }>(`${projUrl()}/_apis/wit/workitemsbatch?${API}`, {
        ids: c,
        ...(fields ? { fields } : {}),
        errorPolicy: 'Omit',
      }),
    ),
  );
  const map = new Map<number, Raw>();
  for (const r of res) for (const w of r.value) if (w) map.set(w.id, w);
  return map;
}

const str = (f: Record<string, unknown>, k: string) => (f[k] == null ? '' : String(f[k]));
const num = (f: Record<string, unknown>, k: string) => (typeof f[k] === 'number' ? (f[k] as number) : Number(f[k]) || 0);

const TC_FIELDS = ['System.Title', 'System.State', 'Microsoft.VSTS.Common.StateChangeDate'];

function buildGroup(key: RegGroupKey, queryId: string, name: string | null, ids: number[], items: Map<number, Raw>): RegGroup {
  const counts = emptyCounts();
  const list: RegItem[] = [];
  for (const id of ids) {
    const w = items.get(id);
    if (!w) continue;
    const state = str(w.fields, 'System.State');
    const stateKey = stateKeyOf(state);
    counts[stateKey]++;
    list.push({
      id,
      title: str(w.fields, 'System.Title'),
      state,
      stateKey,
      url: `${projUrl()}/_workitems/edit/${id}`,
      stateChangeDate: str(w.fields, 'Microsoft.VSTS.Common.StateChangeDate') || null,
    });
  }
  const total = list.length;
  return {
    key,
    label: GROUP_LABEL[key],
    queryName: name,
    queryUrl: `${projUrl()}/_queries/query/${queryId}/`,
    total,
    passed: counts.passed,
    rate: total ? counts.passed / total : null,
    counts,
    items: key === 'consolidado' ? [] : list,
  };
}

async function loadEnv(env: RegEnv): Promise<RegEnvData> {
  const queries = REG_QUERIES[env];
  const keys = Object.keys(queries) as RegGroupKey[];

  const [idLists, names] = await Promise.all([
    Promise.all(keys.map((k) => runQuery(queries[k]))),
    Promise.all(keys.map((k) => queryName(queries[k]))),
  ]);
  const items = await fetchItems([...new Set(idLists.flat())], TC_FIELDS);

  const groups = Object.fromEntries(
    keys.map((k, i) => [k, buildGroup(k, queries[k], names[i], idLists[i], items)]),
  ) as Record<RegGroupKey, RegGroup>;

  // Suites
  const suiteDefs = REG_SUITE_QUERIES.filter((s) => s.env === env);
  const suiteIdLists = await Promise.all(suiteDefs.map((s) => runQuery(s.id)));
  const suiteRaw = await fetchItems([...new Set(suiteIdLists.flat())]);
  const suites: RegSuite[] = [];
  suiteDefs.forEach((def, i) => {
    for (const id of suiteIdLists[i]) {
      const w = suiteRaw.get(id);
      if (!w) continue;
      const f = w.fields;
      const state = str(f, 'System.State');
      suites.push({
        id,
        title: str(f, 'System.Title'),
        state,
        stateKey: stateKeyOf(state),
        url: `${projUrl()}/_workitems/edit/${id}`,
        channel: def.channel,
        testsPassed: num(f, 'Custom.TestsPassed'),
        testsFailed: num(f, 'Custom.TestsFailed'),
        start: str(f, 'Custom.StartExecution') || null,
        end: str(f, 'Custom.EndExecution') || null,
        jobStatus: str(f, 'Custom.JobExecutionStatus') || null,
        onlyFailed: str(f, 'Custom.Onlyprocessfailed').toLowerCase() === 'yes',
      });
    }
  });

  const dates = [
    ...Object.values(groups).flatMap((g) => g.items.map((i) => i.stateChangeDate)),
    ...suites.map((s) => s.end),
  ].filter((d): d is string => !!d);
  const qualityGate = await loadQualityGate(env);
  return { groups, suites, qualityGate, lastExecution: dates.sort().at(-1) ?? null };
}

/** Suites da esteira (query em árvore): só as raízes entram na soma, como na pipeline da GMUD */
async function loadQualityGate(env: RegEnv): Promise<RegQualityGate | null> {
  const queryId = REG_QG_QUERIES[env];
  if (!queryId) return null;
  const [r, name] = await Promise.all([
    az<{ workItems?: { id: number }[]; workItemRelations?: { source: { id: number } | null; target: { id: number } }[] }>(
      `${projUrl()}/_apis/wit/wiql/${encodeURIComponent(queryId)}?${API}`,
    ),
    queryName(queryId),
  ]);
  const ids = [
    ...new Set(
      r.workItems?.map((w) => w.id) ?? r.workItemRelations?.filter((x) => !x.source).map((x) => x.target.id) ?? [],
    ),
  ];
  const raw = await fetchItems(ids, [
    'System.Title',
    'System.State',
    'System.Tags',
    'Custom.TestsPassed',
    'Custom.TestsFailed',
    'Custom.StartExecution',
    'Custom.EndExecution',
    'Custom.JobExecutionStatus',
    'Custom.Onlyprocessfailed',
  ]);
  const suites: RegSuite[] = [];
  for (const id of ids) {
    const w = raw.get(id);
    if (!w) continue;
    const f = w.fields;
    const state = str(f, 'System.State');
    const tags = str(f, 'System.Tags').toLowerCase();
    suites.push({
      id,
      title: str(f, 'System.Title'),
      state,
      stateKey: stateKeyOf(state),
      url: `${projUrl()}/_workitems/edit/${id}`,
      channel: /agenc|agênc/.test(tags) ? 'Agencias' : 'CORBAN',
      testsPassed: num(f, 'Custom.TestsPassed'),
      testsFailed: num(f, 'Custom.TestsFailed'),
      start: str(f, 'Custom.StartExecution') || null,
      end: str(f, 'Custom.EndExecution') || null,
      jobStatus: str(f, 'Custom.JobExecutionStatus') || null,
      onlyFailed: str(f, 'Custom.Onlyprocessfailed').toLowerCase() === 'yes',
    });
  }
  const testsPassed = suites.reduce((n, s) => n + s.testsPassed, 0);
  const testsFailed = suites.reduce((n, s) => n + s.testsFailed, 0);
  return {
    queryName: name,
    queryUrl: `${projUrl()}/_queries/query/${queryId}/`,
    testsPassed,
    testsFailed,
    rate: testsPassed + testsFailed ? testsPassed / (testsPassed + testsFailed) : null,
    suites,
  };
}

export async function loadRegression(): Promise<RegressionResponse> {
  const [HML, HFX] = await Promise.all([loadEnv('HML'), loadEnv('HFX')]);
  const environments = { HML, HFX };
  const history = await saveSnapshot(environments);
  return {
    source: 'azure',
    syncedAt: new Date().toISOString(),
    goal: REG_GOAL,
    environments,
    history,
  };
}
