import { config } from './config';
import { HttpError, az, projUrl } from './azure';
import { bugBodyToHtml, titlePrefix } from '../shared/bugFormat';
import type { BugImage } from './bugAgent';

const API = 'api-version=7.1';

export interface CreateBugInput {
  title: string;
  body: string;
  severity: string;
  stageIntroduced: string;
  channel: string;
  origin: string;
  areaPath: string;
  iterationPath: string;
  tags: string[];
  stageFound?: string;
  defectType?: string;
  relatedIds: number[];
  parentId?: number | null;
  images: BugImage[];
  /** true = só valida no Azure DevOps, sem criar nada */
  validateOnly?: boolean;
}

interface RawNode {
  name: string;
  path: string;
  children?: RawNode[];
}

/** "\\Projeto\\Area\\Time" -> "Projeto\\Time" */
const toPath = (nodePath: string, kind: 'area' | 'iteration') => {
  const parts = nodePath.split('\\').filter(Boolean);
  if (parts[1]?.toLowerCase() === kind) parts.splice(1, 1);
  return parts.join('\\');
};

export async function listAreas(): Promise<string[]> {
  const root = await az<RawNode>(`${projUrl()}/_apis/wit/classificationnodes/Areas?$depth=10&${API}`);
  const out: string[] = [];
  const walk = (n: RawNode) => {
    out.push(toPath(n.path, 'area'));
    n.children?.forEach(walk);
  };
  walk(root);
  return out.sort((a, b) => a.localeCompare(b));
}

/** Dados básicos de work items (para listar as US no campo "User Story (pai)") */
export async function basicWorkItems(ids: number[]) {
  if (!ids.length) return [];
  const r = await az<{ value: ({ id: number; fields: Record<string, unknown> } | null)[] }>(
    `${projUrl()}/_apis/wit/workitemsbatch?${API}`,
    {
      ids: ids.slice(0, 200),
      fields: ['System.Title', 'System.WorkItemType', 'System.AreaPath', 'System.IterationPath'],
      errorPolicy: 'Omit',
    },
  );
  return r.value
    .filter((w): w is { id: number; fields: Record<string, unknown> } => !!w)
    .map((w) => ({
      id: w.id,
      title: String(w.fields['System.Title'] ?? ''),
      type: String(w.fields['System.WorkItemType'] ?? ''),
      areaPath: String(w.fields['System.AreaPath'] ?? ''),
      iterationPath: String(w.fields['System.IterationPath'] ?? ''),
    }));
}

function decodeDataUrl(dataUrl: string) {
  const m = /^data:([^;]+);base64,(.+)$/.exec(dataUrl);
  if (!m) throw new HttpError('Imagem inválida.', 400);
  return Buffer.from(m[2], 'base64');
}

const safeName = (name: string) => name.replace(/[^\w.\-]+/g, '_').slice(0, 80) || 'evidencia.png';

export async function createBug(input: CreateBugInput) {
  const title = input.title.trim();
  if (!title) throw new HttpError('Informe o título do bug.', 400);
  if (!input.body.trim()) throw new HttpError('O conteúdo do bug está vazio.', 400);
  for (const [field, label] of [
    [input.severity, 'Severidade'],
    [input.stageIntroduced, 'Ambiente (Stage Introduced)'],
    [input.areaPath, 'Area Path'],
    [input.iterationPath, 'Iteration'],
  ] as const) {
    if (!field?.trim()) throw new HttpError(`Preencha o campo obrigatório: ${label}.`, 400);
  }

  // 1) Anexos (pulados na validação, para não deixar arquivos órfãos)
  const uploaded: { url: string; name: string }[] = [];
  if (!input.validateOnly) {
    for (const img of input.images) {
      const name = safeName(img.name);
      const r = await az<{ id: string; url: string }>(
        `${projUrl()}/_apis/wit/attachments?fileName=${encodeURIComponent(name)}&${API}`,
        decodeDataUrl(img.dataUrl),
        'application/octet-stream',
      );
      uploaded.push({ url: r.url, name });
    }
  }

  const fullTitle = `${titlePrefix(input.stageIntroduced, input.channel, input.origin)} ${title}`.slice(0, 255);
  const html = bugBodyToHtml(input.body, uploaded);
  const tags = [...new Set([...input.tags.map((t) => t.trim()).filter(Boolean), ...(input.channel ? [input.channel] : [])])];

  const add = (path: string, value: unknown) => ({ op: 'add', path, value });
  const ops: unknown[] = [
    add('/fields/System.Title', fullTitle),
    add('/fields/System.Description', html),
    add('/fields/Microsoft.VSTS.Common.Severity', input.severity),
    add('/fields/Custom.StageIntroduced', input.stageIntroduced),
    add('/fields/System.AreaPath', input.areaPath),
    add('/fields/System.IterationPath', input.iterationPath),
    add('/fields/Custom.Organization', 'Accenture'),
  ];
  if (tags.length) ops.push(add('/fields/System.Tags', tags.join('; ')));
  if (input.stageFound) ops.push(add('/fields/Custom.StageFound', input.stageFound));
  if (input.defectType) ops.push(add('/fields/Custom.DefectType', input.defectType));

  const wiUrl = (id: number) => `https://dev.azure.com/${encodeURIComponent(config.org)}/_apis/wit/workItems/${id}`;
  for (const id of input.relatedIds) ops.push(add('/relations/-', { rel: 'System.LinkTypes.Related', url: wiUrl(id) }));
  if (input.parentId) ops.push(add('/relations/-', { rel: 'System.LinkTypes.Hierarchy-Reverse', url: wiUrl(input.parentId) }));
  for (const f of uploaded) ops.push(add('/relations/-', { rel: 'AttachedFile', url: f.url, attributes: { comment: 'Evidência' } }));

  const created = await az<{ id: number; fields: Record<string, unknown> }>(
    `${projUrl()}/_apis/wit/workitems/$Bug?${API}${input.validateOnly ? '&validateOnly=true' : ''}`,
    ops,
    'application/json-patch+json',
  );

  return {
    validateOnly: !!input.validateOnly,
    id: input.validateOnly ? null : created.id,
    title: fullTitle,
    url: input.validateOnly ? null : `${projUrl()}/_workitems/edit/${created.id}`,
    attachments: uploaded.length,
  };
}
