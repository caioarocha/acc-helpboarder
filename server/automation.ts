import { config } from './config';
import { HttpError, az, projUrl } from './azure';
import { stateKeyOf } from '../shared/metrics';
import type { AutomationItem, AutomationResponse, BuildStatus, Channel } from '../shared/types';

const API = 'api-version=7.1';

const FIELDS = [
  'System.Id',
  'System.Title',
  'System.State',
  'System.Tags',
  'Custom.Score',
  'Custom.Functionality2',
  'Custom.Featurenameincypress',
  'Custom.ScenarioTAG',
  'Microsoft.VSTS.Common.StateChangeDate',
  'System.CreatedDate',
];

/** Remove acentos e caixa para comparar tags */
export const norm = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim()
    .toLowerCase();

/** "03- Formalização" -> "03 - Formalização"; valor genérico vira "Não definida" */
export function normalizeFunctionality(value: string) {
  const v = value.trim().replace(/^(\d+)\s*-\s*/, '$1 - ');
  if (!v || norm(v) === 'functionality') return 'Não definida';
  return v;
}

export function classifyTags(rawTags: string) {
  const a = config.automation;
  const tags = rawTags
    .split(';')
    .map((t) => norm(t))
    .filter(Boolean);
  const has = (t: string) => tags.includes(norm(t));
  const channels: Channel[] = [];
  if (has(a.tagCorban)) channels.push('CORBAN');
  if (has(a.tagAgencias)) channels.push('Agencias');
  const build: BuildStatus = has(a.tagBuilt) ? 'construido' : has(a.tagBuilding) ? 'em-construcao' : 'sem-tag';
  const environments = ['HML', 'HFX'].filter((e) => has(e));
  const regression = tags.includes('regressao');
  return { channels, build, environments, regression };
}

export async function loadAutomation(): Promise<AutomationResponse> {
  const queryId = config.automation.queryId;
  if (!queryId) {
    throw new HttpError('Configure AZDO_AUTOMATION_QUERY_ID no .env com o ID da query de automação.', 400);
  }

  const [result, info] = await Promise.all([
    az<{ workItems?: { id: number }[]; workItemRelations?: { target?: { id: number } }[] }>(
      `${projUrl()}/_apis/wit/wiql/${encodeURIComponent(queryId)}?${API}`,
    ),
    az<{ name: string }>(`${projUrl()}/_apis/wit/queries/${encodeURIComponent(queryId)}?${API}`).catch(() => null),
  ]);

  const ids = [
    ...new Set(
      result.workItems?.map((w) => w.id) ??
        result.workItemRelations?.map((r) => r.target?.id).filter((id): id is number => !!id) ??
        [],
    ),
  ];

  const chunks: number[][] = [];
  for (let i = 0; i < ids.length; i += 200) chunks.push(ids.slice(i, i + 200));
  const batches = await Promise.all(
    chunks.map((chunk) =>
      az<{ value: ({ id: number; fields: Record<string, unknown> } | null)[] }>(
        `${projUrl()}/_apis/wit/workitemsbatch?${API}`,
        { ids: chunk, fields: FIELDS, errorPolicy: 'Omit' },
      ),
    ),
  );

  const items: AutomationItem[] = [];
  for (const b of batches) {
    for (const w of b.value) {
      if (!w) continue;
      const f = w.fields;
      const s = (k: string) => (f[k] == null ? '' : String(f[k]));
      const state = s('System.State');
      const score = f['Custom.Score'];
      items.push({
        id: w.id,
        title: s('System.Title'),
        state,
        stateKey: stateKeyOf(state),
        url: `${projUrl()}/_workitems/edit/${w.id}`,
        ...classifyTags(s('System.Tags')),
        functionality: normalizeFunctionality(s('Custom.Functionality2')),
        score: typeof score === 'number' ? score : score ? Number(score) || null : null,
        feature: s('Custom.Featurenameincypress') || null,
        scenarioTag: s('Custom.ScenarioTAG') || null,
        stateChangeDate: s('Microsoft.VSTS.Common.StateChangeDate') || null,
        createdDate: s('System.CreatedDate') || null,
      });
    }
  }

  const warnings: string[] = [];
  const noTag = items.filter((i) => i.build === 'sem-tag').length;
  if (noTag) {
    warnings.push(
      `${noTag} cenário(s) sem a tag "${config.automation.tagBuilt}" ou "${config.automation.tagBuilding}".`,
    );
  }

  return {
    source: 'azure',
    syncedAt: new Date().toISOString(),
    queryName: info?.name ?? null,
    queryUrl: `${projUrl()}/_queries/query/${queryId}/`,
    items,
    warnings,
  };
}
