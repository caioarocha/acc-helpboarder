// Histórico do % do regressivo: o Azure DevOps só informa o estado atual,
// então salvamos uma foto por dia e por ambiente num arquivo local.
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import type { RegEnv, RegEnvData, RegHistoryPoint } from '../shared/types';

const FILE = resolve(process.cwd(), 'data', 'regression-history.json');

export async function readHistory(): Promise<RegHistoryPoint[]> {
  try {
    const parsed = JSON.parse(await readFile(FILE, 'utf8'));
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/** Data local (AAAA-MM-DD) para agrupar as fotos por dia */
const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

/** Grava (ou substitui) a foto de hoje de cada ambiente e devolve o histórico completo */
export async function saveSnapshot(envs: Record<RegEnv, RegEnvData>): Promise<RegHistoryPoint[]> {
  const date = today();
  const history = (await readHistory()).filter((p) => p.date !== date);
  for (const env of Object.keys(envs) as RegEnv[]) {
    const g = envs[env].groups;
    history.push({
      date,
      env,
      corban: g.corban.rate,
      agencias: g.agencias.rate,
      consolidado: g.consolidado.rate,
      qualityGate: envs[env].qualityGate?.rate ?? null,
    });
  }
  history.sort((a, b) => a.date.localeCompare(b.date) || a.env.localeCompare(b.env));
  try {
    await mkdir(dirname(FILE), { recursive: true });
    await writeFile(FILE, JSON.stringify(history, null, 2), 'utf8');
  } catch (e) {
    console.error('Não foi possível salvar o histórico da regressão:', e);
  }
  return history;
}
