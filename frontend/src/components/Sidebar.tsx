'use client';

import React from 'react';
import { useApp } from '../context/AppContext';
import { VIEWS, ACCESS } from '../lib/mockData';
import { LanguageSelector } from './LanguageSelector';

export const Sidebar: React.FC = () => {
  const { user, currentView, setView, logout, backendStatus, theme, toggleTheme, t } = useApp();

  if (!user) return null;

  const allowedViews = ACCESS[user.role] || [];

  return (
    <aside>
      <div className="logo">
        <span>{t('appName')}</span>
        <button
          className="theme-btn"
          onClick={toggleTheme}
          title={`Current theme: ${theme}. Click to switch.`}
          style={{ padding: '2px 6px', fontSize: '11px' }}
        >
          {theme === 'dark' ? '☀️' : theme === 'light' ? '🌙' : '🌓'}
        </button>
      </div>

      {VIEWS.map((view, idx) => {
        const isAllowed = allowedViews.includes(view.key);
        const isActive = currentView === view.key;
        const localizedLabel = t(view.key);

        return (
          <button
            key={view.key}
            className={`nav ${isActive ? 'on' : ''} ${!isAllowed ? 'lock' : ''}`}
            onClick={() => isAllowed && setView(view.key)}
            title={!isAllowed ? t('notAvailableRole') : undefined}
            type="button"
          >
            <i>{idx + 1}</i>
            <span>{localizedLabel}</span>
          </button>
        );
      })}

      <div style={{ flex: 1 }} />

      <div style={{ padding: '8px 4px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <div style={{ display: 'flex', justifyContent: 'center' }}>
          <LanguageSelector variant="sidebar" />
        </div>

        <div
          className={`status-badge ${backendStatus === 'connected' ? 'connected' : ''}`}
          style={{ width: '100%', justifyContent: 'center' }}
          title={backendStatus === 'connected' ? 'Connected to FastAPI Backend (port 8000)' : 'Standalone mock engine active'}
        >
          <span className="status-dot" />
          <span>{backendStatus === 'connected' ? t('apiConnected') : t('localEngine')}</span>
        </div>

        <div className="sub" style={{ lineHeight: 1.4 }}>
          <div style={{ textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
            {user.email}
          </div>
          <div>
            {t('role')}: <b style={{ textTransform: 'capitalize' }}>{user.role}</b>
          </div>
        </div>
      </div>

      <button className="nav" onClick={logout} type="button">
        <i>⎋</i>
        <span>{t('signOut')}</span>
      </button>
    </aside>
  );
};
