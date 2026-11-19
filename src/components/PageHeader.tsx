import type { ReactNode } from 'react';
import type { ConnectionStatus } from '../../shared/types';

export function PageHeader({
  title,
  subtitle,
  status,
  syncedAt,
}: {
  title: string;
  subtitle: ReactNode;
  status: ConnectionStatus | null;
  syncedAt?: string | null;
}) {
  const tone = !status ? 'neutral' : status.mode === 'mock' ? 'warn' : status.connected ? 'ok' : 'bad';
  const label = !status
    ? 'Verificando…'
    : status.mode === 'mock'
      ? 'Modo demonstração'
      : status.connected
        ? 'Conectado'
        : 'Erro de conexão';
  const tip =
    status?.mode === 'mock'
      ? 'Dados fictícios. Preencha AZDO_ORG, AZDO_PROJECT e AZDO_PAT no arquivo .env para usar dados reais.'
      : (status?.error ?? undefined);

  return (
    <header className="page-header">
      <div>
        <h1>{title}</h1>
        <p className="muted">{subtitle}</p>
      </div>
      <div className="header-right">
        {syncedAt && (
          <span className="muted small">
            Sincronizado às {new Date(syncedAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
          </span>
        )}
        <div className={`conn-chip tone-${tone}`} title={tip}>
          <AzureMark />
          <span className="dot" />
          {label}
        </div>
      </div>
    </header>
  );
}

function AzureMark() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
      <path fill="currentColor" d="M22 6.5v10.8l-4.4 3.6-6.9-2.5v2.5L6.8 15.8l11.3.9V7.1L22 6.5ZM18.3 7 11.9 3v2.6L6 7.4 4.3 9.6v5l2.5 1.1V9.3L18.3 7Z" />
    </svg>
  );
}
