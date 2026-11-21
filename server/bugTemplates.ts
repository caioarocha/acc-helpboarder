// Modelos de bug (conjunto de campos salvos com um nome), guardados num arquivo local do projeto.
import { randomUUID } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

const FILE = resolve(process.cwd(), 'data', 'bug-templates.json');

export interface BugTemplate {
  id: string;
  name: string;
  fields: Record<string, string>;
  updatedAt: string;
}

export async function listTemplates(): Promise<BugTemplate[]> {
  try {
    const parsed = JSON.parse(await readFile(FILE, 'utf8'));
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function save(list: BugTemplate[]) {
  await mkdir(dirname(FILE), { recursive: true });
  await writeFile(FILE, JSON.stringify(list, null, 2), 'utf8');
}

/** Cria ou substitui (mesmo nome) um modelo */
export async function upsertTemplate(name: string, fields: Record<string, unknown>): Promise<BugTemplate> {
  const clean = Object.fromEntries(
    Object.entries(fields)
      .filter(([k, v]) => typeof v === 'string' && k !== 'relatedIds')
      .map(([k, v]) => [k, String(v).slice(0, 500)]),
  );
  const list = await listTemplates();
  const existing = list.find((t) => t.name.toLowerCase() === name.toLowerCase());
  const tpl: BugTemplate = {
    id: existing?.id ?? randomUUID(),
    name: name.slice(0, 120),
    fields: clean,
    updatedAt: new Date().toISOString(),
  };
  await save([...list.filter((t) => t.id !== tpl.id), tpl].sort((a, b) => a.name.localeCompare(b.name)));
  return tpl;
}

export async function deleteTemplate(id: string) {
  const list = await listTemplates();
  await save(list.filter((t) => t.id !== id));
}
