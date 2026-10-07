'use client';

import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { DEMO_USERS, DEMO_PASSWORD } from '../lib/mockData';
import { LanguageSelector } from './LanguageSelector';

export const LoginView: React.FC = () => {
  const { login, quickLogin, loginError, backendStatus, theme, toggleTheme, t } = useApp();
  const [email, setEmail] = useState('admin@nexora.io');
  const [password, setPassword] = useState(DEMO_PASSWORD);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    await login(email, password);
    setIsLoading(false);
  };

  return (
    <div className="login">
      <div style={{ position: 'fixed', top: 16, right: 16, display: 'flex', gap: 8, alignItems: 'center' }}>
        <LanguageSelector variant="login" />
        <div className={`status-badge ${backendStatus === 'connected' ? 'connected' : ''}`}>
          <span className="status-dot" />
          {backendStatus === 'connected' ? t('backendOnline') : t('standaloneMode')}
        </div>
        <button
          className="theme-btn"
          onClick={toggleTheme}
          title="Toggle color theme"
          type="button"
        >
          {theme === 'dark' ? '☀️' : theme === 'light' ? '🌙' : '🌓'}
        </button>
      </div>

      <form className="card" onSubmit={handleSubmit}>
        <div className="logo" style={{ padding: 0 }}>{t('appName')}</div>
        <div className="sub">{t('appSubtitle')}</div>

        <input
          id="em"
          type="email"
          placeholder={t('emailPlaceholder')}
          autoComplete="username"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />

        <input
          id="pw"
          type="password"
          placeholder={t('passwordPlaceholder')}
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />

        <div className="err">{loginError}</div>

        <button className="btn" type="submit" disabled={isLoading}>
          {isLoading ? t('signingIn') : t('signIn')}
        </button>

        <div className="sub" style={{ marginTop: 4 }}>
          {t('demoRolesPrompt')}
        </div>

        <div className="row">
          {Object.entries(DEMO_USERS).map(([userEmail, role]) => (
            <span
              key={userEmail}
              className="chip"
              onClick={() => {
                setEmail(userEmail);
                setPassword(DEMO_PASSWORD);
                quickLogin(userEmail);
              }}
              title={`Sign in immediately as ${role}`}
            >
              {role}
            </span>
          ))}
        </div>
      </form>
    </div>
  );
};
