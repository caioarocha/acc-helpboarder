import { Construction } from 'lucide-react';
import type { ConnectionStatus } from '../../shared/types';
import { PageHeader } from '../components/PageHeader';

export function ComingSoon({ title, status }: { title: string; status: ConnectionStatus | null }) {
  return (
    <>
      <PageHeader title={title} subtitle="Esta área será construída nos próximos passos" status={status} />
      <div className="card empty-state">
        <Construction size={36} />
        <h3>Em construção</h3>
        <p className="muted">Vamos montar esta aba depois de fechar o Dashboard e User Stories.</p>
      </div>
    </>
  );
}
