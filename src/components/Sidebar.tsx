import { NavLink } from 'react-router';
import { BookOpen, Bot, Bug, FlaskConical, LayoutDashboard, Lock, RefreshCcw } from 'lucide-react';
import type { ConnectionStatus } from '../../shared/types';
import { lockNow } from '../auth';

const NAV = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, ready: true },
  { to: '/user-stories', label: 'User Stories', icon: BookOpen, ready: true },
  { to: '/automacao', label: 'Automação', icon: Bot, ready: true },
  { to: '/regressao', label: 'Regressão', icon: RefreshCcw, ready: true },
  { to: '/bugs', label: 'Bugs', icon: Bug, ready: true },
];

export function Sidebar({ status }: { status: ConnectionStatus | null }) {
  const tone = !status ? 'neutral' : status.mode === 'mock' ? 'warn' : status.connected ? 'ok' : 'bad';
  const label = !status
    ? 'Verificando…'
    : status.mode === 'mock'
      ? 'Modo demonstração'
      : status.connected
        ? 'Conectado'
        : 'Erro de conexão';

  return (
    <aside className="sidebar">
      <div className="brand">
        <div className="brand-logo">
          <FlaskConical size={22} strokeWidth={2.2} />
        </div>
        <div>
          <div className="brand-name">Cockpit</div>
          <div className="brand-sub">QA Analytics</div>
        </div>
      </div>

      <nav className="nav">
        {NAV.map(({ to, label, icon: Icon, ready }) => (
          <NavLink key={to} to={to} end={to === '/'}>
            <Icon size={18} />
            <span>{label}</span>
            {!ready && <span className="soon">em breve</span>}
          </NavLink>
        ))}
      </nav>

      <div className="sidebar-foot">
        <div className="muted small">Integrado ao</div>
        <div className="foot-title">Azure DevOps</div>
        {status?.project && <div className="muted small ellipsis">{status.organization} / {status.project}</div>}
        <div className={`status-line tone-${tone}`} title={status?.error ?? undefined}>
          <span className="dot" />
          {label}
        </div>
        <button type="button" className="lock-now" onClick={() => void lockNow()} title="Bloquear o Cockpit agora">
          <Lock size={14} /> Bloquear
        </button>
      </div>
    </aside>
  );
}
