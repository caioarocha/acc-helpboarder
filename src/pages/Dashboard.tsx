import type { ConnectionStatus } from '../../shared/types';
import { PageHeader } from '../components/PageHeader';
import { OverviewSection } from '../components/Overview';

export function DashboardPage({ status }: { status: ConnectionStatus | null }) {
  const projectName = status?.project ?? (status?.mode === 'mock' ? 'Projeto Demo' : 'projeto');
  return (
    <>
      <PageHeader title="Dashboard" subtitle={`Visão geral da qualidade do ${projectName}`} status={status} />
      <OverviewSection />
    </>
  );
}
