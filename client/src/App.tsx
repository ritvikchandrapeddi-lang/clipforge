import React, { useState } from 'react';
import { Sidebar, PageId } from './components/Sidebar';
import { Header } from './components/Header';
import { OverviewPage } from './pages/OverviewPage';
import { UploadCenterPage } from './pages/UploadCenterPage';
import { ProcessingPipelinePage } from './pages/ProcessingPipelinePage';
import { VideoLibraryPage } from './pages/VideoLibraryPage';
import { VideoPlayerPage } from './pages/VideoPlayerPage';
import { WorkerManagementPage } from './pages/WorkerManagementPage';
import { QueueManagementPage } from './pages/QueueManagementPage';
import { DeadLetterPage } from './pages/DeadLetterPage';
import { DepartmentPage } from './pages/DepartmentPage';
import { LoadTestingPage } from './pages/LoadTestingPage';
import { ObservatoryPage } from './pages/ObservatoryPage';
import { SocketProvider } from './context/SocketContext';

export const AppContent: React.FC = () => {
  const [currentPage, setCurrentPage] = useState<PageId>('overview');

  const renderCurrentPage = () => {
    switch (currentPage) {
      case 'overview':
        return <OverviewPage onNavigate={setCurrentPage} />;
      case 'upload':
        return <UploadCenterPage onNavigate={setCurrentPage} />;
      case 'pipeline':
        return <ProcessingPipelinePage onNavigate={setCurrentPage} />;
      case 'library':
        return <VideoLibraryPage onNavigate={setCurrentPage} />;
      case 'player':
        return <VideoPlayerPage onNavigate={setCurrentPage} />;
      case 'workers':
        return <WorkerManagementPage onNavigate={setCurrentPage} />;
      case 'queues':
        return <QueueManagementPage onNavigate={setCurrentPage} />;
      case 'deadletter':
        return <DeadLetterPage onNavigate={setCurrentPage} />;
      case 'departments':
        return <DepartmentPage onNavigate={setCurrentPage} />;
      case 'loadtest':
        return <LoadTestingPage onNavigate={setCurrentPage} />;
      case 'observatory':
        return <ObservatoryPage onNavigate={setCurrentPage} />;
      default:
        return <OverviewPage onNavigate={setCurrentPage} />;
    }
  };

  return (
    <div className="min-h-screen bg-[#0B0F17] flex">
      {/* Persistent Sidebar */}
      <Sidebar currentPage={currentPage} onSelectPage={setCurrentPage} />

      {/* Main Content Area */}
      <div className="flex-1 ml-64 flex flex-col min-h-screen">
        <Header currentPage={currentPage} onNavigate={setCurrentPage} />
        <main className="flex-1 p-6 md:p-8 max-w-7xl w-full mx-auto">
          {renderCurrentPage()}
        </main>
      </div>
    </div>
  );
};

export const App: React.FC = () => {
  return (
    <SocketProvider>
      <AppContent />
    </SocketProvider>
  );
};

export default App;
