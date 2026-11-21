import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { platformAuthenticatorIsAvailable } from '@simplewebauthn/browser';
import { FlaskConical, Fingerprint, Loader2, Lock, ShieldCheck } from 'lucide-react';
import { LOCK_EVENT, getAuthStatus, registerFingerprint, unlockWithFingerprint, type AuthStatus } from '../auth';

type Phase = 'checking' | 'locked' | 'unlocked' | 'offline';

/** Só mostra o Cockpit depois da verificação com Windows Hello (digital) */
export function AuthGate({ children }: { children: ReactNode }) {
  const [phase, setPhase] = useState<Phase>('checking');
  const [status, setStatus] = useState<AuthStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hello, setHello] = useState<boolean | null>(null);

  const check = useCallback(async () => {
    try {
      const s = await getAuthStatus();
      setStatus(s);
      setPhase(s.authenticated ? 'unlocked' : 'locked');
    } catch {
      setPhase('offline');
    }
  }, []);

  useEffect(() => {
    void check();
    platformAuthenticatorIsAvailable().then(setHello).catch(() => setHello(false));
    const onLock = () => {
      setError(null);
      void check();
    };
    window.addEventListener(LOCK_EVENT, onLock);
    return () => window.removeEventListener(LOCK_EVENT, onLock);
  }, [check]);

  // Bloqueia sozinho quando a sessão de 8h vence
  useEffect(() => {
    if (phase !== 'unlocked' || !status?.expiresAt) return;
    const ms = new Date(status.expiresAt).getTime() - Date.now();
    const t = setTimeout(() => void check(), Math.max(1000, ms + 500));
    return () => clearTimeout(t);
  }, [phase, status, check]);

  const act = async () => {
    setBusy(true);
    setError(null);
    try {
      if (status?.registered) await unlockWithFingerprint();
      else await registerFingerprint();
      await check();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  if (phase === 'unlocked') return <>{children}</>;

  const firstTime = status && !status.registered;

  return (
    <div className="lock-screen">
      <div className="lock-card">
        <div className="lock-logo">
          <FlaskConical size={28} strokeWidth={2.2} />
        </div>
        <h1>Cockpit</h1>
        <p className="lock-sub">QA Analytics</p>

        {phase === 'checking' ? (
          <p className="muted">
            <Loader2 size={16} className="spin" /> Verificando…
          </p>
        ) : phase === 'offline' ? (
          <>
            <p className="lock-text">Não foi possível falar com o servidor do Cockpit. Ele está rodando?</p>
            <button className="btn primary lock-btn" onClick={() => void check()}>
              Tentar de novo
            </button>
          </>
        ) : (
          <>
            <div className="lock-badge">
              <Lock size={14} /> {firstTime ? 'Proteja o seu acesso' : 'Cockpit bloqueado'}
            </div>
            <p className="lock-text">
              {firstTime
                ? 'O Cockpit usa o seu token do Azure DevOps. Cadastre a sua digital para que só você consiga abri-lo.'
                : 'Use a sua digital para desbloquear.'}
            </p>

            <button className={`lock-finger ${busy ? 'busy' : ''}`} onClick={act} disabled={busy || hello === false}>
              {busy ? <Loader2 size={44} className="spin" /> : <Fingerprint size={52} />}
            </button>
            <button className="btn primary lock-btn" onClick={act} disabled={busy || hello === false}>
              {firstTime ? 'Cadastrar minha digital' : 'Desbloquear com digital'}
            </button>

            {error && <div className="lock-error">{error}</div>}
            {hello === false && (
              <div className="lock-error">
                O Windows Hello não está disponível neste navegador. Configure a digital em Configurações do Windows &gt;
                Contas &gt; Opções de entrada.
              </div>
            )}

            <p className="lock-foot">
              <ShieldCheck size={13} /> Windows Hello: a digital não sai do seu computador. O Windows também pode oferecer
              rosto ou PIN. Fica liberado por {status?.sessionHours ?? 8}h ou até você bloquear.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
