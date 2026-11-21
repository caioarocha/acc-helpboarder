import { Route, Routes } from 'react-router';
import { api, useAsync } from './api';
import { Sidebar } from './components/Sidebar';
import { DashboardPage } from './pages/Dashboard';
import { UserStoriesPage } from './pages/UserStories';
import { ComingSoon } from './pages/ComingSoon';
import { AutomationPage } from './pages/Automation';
import { RegressionPage } from './pages/Regression';
import { BugsPage } from './pages/Bugs';

export default function App() {
  const status = useAsync(() => api.status(), 'status');

  return (
    <div className="app">
      <Sidebar status={status.data} />
      <main className="main">
        <Routes>
          <Route path="/" element={<DashboardPage status={status.data} />} />
          <Route path="/user-stories" element={<UserStoriesPage status={status.data} />} />
          <Route path="/automacao" element={<AutomationPage status={status.data} />} />
          <Route path="/regressao" element={<RegressionPage status={status.data} />} />
          <Route path="/bugs" element={<BugsPage status={status.data} />} />
          <Route path="*" element={<ComingSoon title="Página não encontrada" status={status.data} />} />
        </Routes>
      </main>
    </div>
  );
}
