// Cliente do bloqueio por digital (Windows Hello / WebAuthn)
import { startAuthentication, startRegistration } from '@simplewebauthn/browser';

export const LOCK_EVENT = 'cockpit:locked';

export interface AuthStatus {
  registered: boolean;
  authenticated: boolean;
  expiresAt: string | null;
  sessionHours: number;
}

async function post<T>(url: string, body?: unknown): Promise<T> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(data?.error ?? `Erro ${res.status}`);
  return data as T;
}

export async function getAuthStatus(): Promise<AuthStatus> {
  const res = await fetch('/api/auth/status');
  if (!res.ok) throw new Error('Não foi possível falar com o servidor do Cockpit.');
  return res.json();
}

/** Mensagens claras para os erros comuns do Windows Hello */
function friendly(e: unknown) {
  const err = e as Error & { name?: string };
  if (err?.name === 'NotAllowedError') return 'Verificação cancelada ou não concluída. Tente de novo.';
  if (err?.name === 'InvalidStateError') return 'Este computador já está cadastrado.';
  if (err?.name === 'SecurityError') return 'Abra o Cockpit por http://localhost para usar a digital.';
  return err?.message ?? 'Não foi possível verificar.';
}

export async function registerFingerprint() {
  try {
    const { options, userId } = await post<{ options: Parameters<typeof startRegistration>[0]['optionsJSON']; userId: string }>(
      '/api/auth/register/options',
    );
    const response = await startRegistration({ optionsJSON: options });
    return await post<{ ok: boolean; expiresAt: string }>('/api/auth/register/verify', { response, userId });
  } catch (e) {
    throw new Error(friendly(e));
  }
}

export async function unlockWithFingerprint() {
  try {
    const options = await post<Parameters<typeof startAuthentication>[0]['optionsJSON']>('/api/auth/login/options');
    const response = await startAuthentication({ optionsJSON: options });
    return await post<{ ok: boolean; expiresAt: string }>('/api/auth/login/verify', response);
  } catch (e) {
    throw new Error(friendly(e));
  }
}

export async function lockNow() {
  await fetch('/api/auth/logout', { method: 'POST' }).catch(() => {});
  window.dispatchEvent(new Event(LOCK_EVENT));
}

/** Se qualquer chamada da API voltar "bloqueado" (sessão expirou), mostra a tela de bloqueio */
export function installLockInterceptor() {
  const original = window.fetch.bind(window);
  window.fetch = async (input, init) => {
    const res = await original(input, init);
    if (res.status === 401) {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
      if (url.includes('/api/') && !url.includes('/api/auth/')) window.dispatchEvent(new Event(LOCK_EVENT));
    }
    return res;
  };
}
