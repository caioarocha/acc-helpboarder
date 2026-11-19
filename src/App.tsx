import { Route, Routes } from 'react-router';
import { api, useAsync } from './api';
import { Sidebar } from './components/Sidebar';
import { DashboardPage } from './pages/Dashboard';
import { UserStoriesPage } from './pages/UserStories';
import { ComingSoon } from './pages/ComingSoon';

export default function App() {
  const status = useAsync(() => api.status(), 'status');

  return (
    <div className="app">
      <Sidebar status={status.data} />
      <main className="main">
        <Routes>
          <Route path="/" element={<DashboardPage status={status.data} />} />
          <Route path="/user-stories" element={<UserStoriesPage status={status.data} />} />
          <Route path="/automacao" element={<ComingSoon title="Automação" status={status.data} />} />
          <Route path="/regressao" element={<ComingSoon title="Regressão" status={status.data} />} />
          <Route path="/bugs" element={<ComingSoon title="Bugs" status={status.data} />} />
          <Route path="*" element={<ComingSoon title="Página não encontrada" status={status.data} />} />
        </Routes>
      </main>
    </div>
  );
}
