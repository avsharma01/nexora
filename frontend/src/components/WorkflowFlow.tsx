'use client';

import React from 'react';
import { useApp } from '../context/AppContext';
import { VIEWS, ACCESS } from '../lib/mockData';

export const WorkflowFlow: React.FC = () => {
  const { user, currentView, setView, t } = useApp();
  if (!user) return null;

  const allowedViews = ACCESS[user.role] || [];

  return (
    <div className="flow">
      {VIEWS.map((view, idx) => {
        const isActive = currentView === view.key;
        const isAllowed = allowedViews.includes(view.key);
        const label = t(view.key);

        return (
          <React.Fragment key={view.key}>
            <span
              className={isActive ? 'on' : ''}
              onClick={() => isAllowed && setView(view.key)}
              style={{
                cursor: isAllowed ? 'pointer' : 'not-allowed',
                opacity: isAllowed ? 1 : 0.5,
              }}
              title={isAllowed ? `Go to ${label}` : t('notAvailableRole')}
            >
              {label}
            </span>
            {idx < VIEWS.length - 1 && <span className="flow-arrow">→</span>}
          </React.Fragment>
        );
      })}
    </div>
  );
};
