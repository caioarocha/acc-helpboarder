// Preferências que precisam sobreviver a reinícios (ex.: IDs das US acompanhadas),
// guardadas num arquivo local do projeto.
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

const FILE = resolve(process.cwd(), 'data', 'prefs.json');

export interface Prefs {
  usIds: number[];
}

export async function readPrefs(): Promise<Prefs> {
  try {
    const parsed = JSON.parse(await readFile(FILE, 'utf8'));
    return { usIds: Array.isArray(parsed?.usIds) ? parsed.usIds.filter((n: unknown) => Number.isInteger(n)) : [] };
  } catch {
    return { usIds: [] };
  }
}

export async function savePrefs(patch: Partial<Prefs>): Promise<Prefs> {
  const next = { ...(await readPrefs()), ...patch };
  await mkdir(dirname(FILE), { recursive: true });
  await writeFile(FILE, JSON.stringify(next, null, 2), 'utf8');
  return next;
}
