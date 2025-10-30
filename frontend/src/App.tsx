import Header from '@/components/ui/Header';
import Sidebar from '@/components/ui/Sidebar';
import ChatPanel from '@/components/ui/ChatPanel';
import * as React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import HistoryPage from '@/components/ui/HistoryPage.tsx';
import AnalyticsPage from '@/components/ui/AnalyticsPage.tsx';

function App() {
  const [sidebarCollapsed, setSidebarCollapsed] = React.useState(false);

  return (
    <Router>
      <div className="flex flex-col h-screen w-screen">
        <Header collapsed={sidebarCollapsed} />
        <div className="flex flex-1 overflow-hidden bg-background">
          <Sidebar
            collapsed={sidebarCollapsed}
            onToggleCollapsed={setSidebarCollapsed}
          />
          <main className="flex-1 flex flex-col items-center justify-center">
            <Routes>
              <Route path="/analytics" element={<AnalyticsPage />} />
              <Route path="/history" element={<HistoryPage />} />
              <Route path="/" element={<ChatPanel />} />
            </Routes>
          </main>
        </div>
      </div>
    </Router>
  );
}

export default App;
