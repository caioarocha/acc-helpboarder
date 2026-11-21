// IDs das US acompanhadas: salvos no servidor (data/prefs.json) para sobreviver a reinícios,
// com uma cópia no navegador para a tela abrir na hora.
import { useEffect, useState } from 'react';

const LOCAL_KEY = 'cockpit.us-ids';
/** Chave antiga (antes do nome Cockpit): lida só para não perder a lista */
const LEGACY_KEY = 'helpboarder.us-ids';

function readLocal(): number[] {
  try {
    return parseList(localStorage.getItem(LOCAL_KEY) || localStorage.getItem(LEGACY_KEY) || '');
  } catch {
    return [];
  }
}

function writeLocal(ids: number[]) {
  try {
    localStorage.setItem(LOCAL_KEY, ids.join(','));
  } catch {
    /* ignora */
  }
}

const parseList = (s: string) =>
  s
    .split(',')
    .map(Number)
    .filter((n) => Number.isInteger(n) && n > 0);

/** Salva a lista no servidor e no navegador */
export async function saveUsIds(ids: number[]) {
  writeLocal(ids);
  try {
    await fetch('/api/prefs', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ usIds: ids }),
    });
  } catch {
    /* sem servidor: fica só a cópia local */
  }
}

/**
 * Lista salva de US. `ready` fica true depois de consultar o servidor
 * (o servidor tem prioridade sobre a cópia do navegador).
 */
export function useSavedUsIds() {
  const [ids, setIds] = useState<number[]>(readLocal);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let alive = true;
    fetch('/api/prefs')
      .then((r) => (r.ok ? r.json() : null))
      .then((p: { usIds?: number[] } | null) => {
        if (!alive) return;
        const server = p?.usIds ?? [];
        if (server.length) {
          setIds(server);
          writeLocal(server);
        } else {
          // Primeira vez: leva para o servidor o que já estava no navegador
          const local = readLocal();
          if (local.length) void saveUsIds(local);
        }
      })
      .catch(() => {})
      .finally(() => alive && setReady(true));
    return () => {
      alive = false;
    };
  }, []);

  return { ids, ready };
}
