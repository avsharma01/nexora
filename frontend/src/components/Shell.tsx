'use client';

import React from 'react';
import { useApp } from '../context/AppContext';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { WorkflowFlow } from './WorkflowFlow';
import { LoginView } from './LoginView';
import { DashboardView } from './views/DashboardView';
import { CompanyKpiView } from './views/CompanyKpiView';
import { AnalyticsView } from './views/AnalyticsView';
import { ForecastView } from './views/ForecastView';
import { AiAnalystView } from './views/AiAnalystView';
import { WhatIfView } from './views/WhatIfView';

export const Shell: React.FC = () => {
  const { user, currentView } = useApp();

  if (!user) {
    return <LoginView />;
  }

  const renderActiveView = () => {
    switch (currentView) {
      case 'dash':
        return <DashboardView />;
      case 'kpi':
        return <CompanyKpiView />;
      case 'ana':
        return <AnalyticsView />;
      case 'fc':
        return <ForecastView />;
      case 'ai':
        return <AiAnalystView />;
      case 'wi':
        return <WhatIfView />;
      default:
        return <DashboardView />;
    }
  };

  return (
    <div className="shell">
      <Sidebar />
      <main>
        <Header />
        <WorkflowFlow />
        {renderActiveView()}
      </main>
    </div>
  );
};
