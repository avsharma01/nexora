'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import {
  User,
  UserRole,
  CompanyData,
  ViewKey,
  ChatMessage,
  BackendStatus,
} from '../lib/types';
import {
  DEFAULT_COMPANIES,
  DEMO_USERS,
  DEMO_PASSWORD,
  ACCESS,
} from '../lib/mockData';
import { answerQuery } from '../lib/calculations';
import {
  checkBackendHealth,
  loginToBackend,
  fetchBackendAIAnalysis,
} from '../lib/api';
import { SupportedLanguage, TranslationKey, getTranslation } from '../lib/i18n';

interface AppContextType {
  user: User | null;
  companies: CompanyData[];
  currentCompany: CompanyData;
  companyIndex: number;
  currentView: ViewKey;
  scenarioGrowth: number | null;
  chatMessages: ChatMessage[];
  theme: 'light' | 'dark' | 'system';
  language: SupportedLanguage;
  backendStatus: BackendStatus;
  loginError: string;
  login: (email: string, pass: string) => Promise<boolean>;
  quickLogin: (email: string) => void;
  logout: () => void;
  setView: (view: ViewKey) => void;
  setCompanyIndex: (idx: number) => void;
  editKpi: (metric: 'rev' | 'exp', monthIndex: number, value: number) => void;
  setScenarioGrowth: (growth: number | null) => void;
  sendAiMessage: (question: string) => Promise<void>;
  toggleTheme: () => void;
  setLanguage: (lang: SupportedLanguage) => void;
  checkBackend: () => Promise<void>;
  t: (key: TranslationKey, params?: Record<string, string | number>) => string;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [companies, setCompanies] = useState<CompanyData[]>(DEFAULT_COMPANIES);
  const [companyIndex, setCompanyIndexState] = useState<number>(0);
  const [currentView, setCurrentViewState] = useState<ViewKey>('dash');
  const [scenarioGrowth, setScenarioGrowth] = useState<number | null>(null);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [loginError, setLoginError] = useState<string>('');
  const [theme, setTheme] = useState<'light' | 'dark' | 'system'>('system');
  const [language, setLanguageState] = useState<SupportedLanguage>('en');
  const [backendStatus, setBackendStatus] = useState<BackendStatus>('checking');

  // Load initial theme and language from localStorage if available
  useEffect(() => {
    const savedTheme = localStorage.getItem('nexora_theme') as 'light' | 'dark' | 'system' | null;
    if (savedTheme) {
      setTheme(savedTheme);
      applyTheme(savedTheme);
    }
    const savedLang = localStorage.getItem('nexora_lang') as SupportedLanguage | null;
    if (savedLang && ['en', 'ja', 'fr', 'hi'].includes(savedLang)) {
      setLanguageState(savedLang);
    }
  }, []);

  const applyTheme = (th: 'light' | 'dark' | 'system') => {
    if (th === 'dark') {
      document.documentElement.setAttribute('data-theme', 'dark');
    } else if (th === 'light') {
      document.documentElement.setAttribute('data-theme', 'light');
    } else {
      document.documentElement.removeAttribute('data-theme');
    }
  };

  const toggleTheme = () => {
    const nextTheme = theme === 'system' ? 'dark' : theme === 'dark' ? 'light' : 'system';
    setTheme(nextTheme);
    localStorage.setItem('nexora_theme', nextTheme);
    applyTheme(nextTheme);
  };

  const setLanguage = (lang: SupportedLanguage) => {
    setLanguageState(lang);
    localStorage.setItem('nexora_lang', lang);
  };

  const t = useCallback(
    (key: TranslationKey, params?: Record<string, string | number>): string => {
      return getTranslation(language, key, params);
    },
    [language]
  );

  // Check backend health periodically
  const checkBackend = useCallback(async () => {
    const isHealthy = await checkBackendHealth();
    setBackendStatus(isHealthy ? 'connected' : 'offline');
  }, []);

  useEffect(() => {
    checkBackend();
    const interval = setInterval(checkBackend, 15000);
    return () => clearInterval(interval);
  }, [checkBackend]);

  const currentCompany = companies[companyIndex] ?? companies[0];

  const setView = (v: ViewKey) => {
    if (!user) return;
    const allowed = ACCESS[user.role];
    if (allowed.includes(v)) {
      setCurrentViewState(v);
    }
  };

  const setCompanyIndex = (idx: number) => {
    setCompanyIndexState(idx);
    setScenarioGrowth(null);
    setChatMessages([]);
  };

  const login = async (email: string, pass: string): Promise<boolean> => {
    const cleanEmail = email.trim().toLowerCase();

    // 1. Check local demo credentials
    if (DEMO_USERS[cleanEmail] && pass === DEMO_PASSWORD) {
      setUser({
        email: cleanEmail,
        role: DEMO_USERS[cleanEmail],
      });
      setLoginError('');
      setCurrentViewState('dash');
      return true;
    }

    // 2. Try FastAPI backend if connected
    if (backendStatus === 'connected') {
      try {
        const res = await loginToBackend(cleanEmail, pass);
        setUser({
          email: res.email,
          role: res.role as UserRole,
          token: res.access_token,
        });
        setLoginError('');
        setCurrentViewState('dash');
        return true;
      } catch (err: unknown) {
        const errorMsg = err instanceof Error ? err.message : t('invalidCredentials');
        setLoginError(errorMsg);
        return false;
      }
    }

    setLoginError(t('invalidCredentials'));
    return false;
  };

  const quickLogin = (email: string) => {
    const cleanEmail = email.trim().toLowerCase();
    const role = DEMO_USERS[cleanEmail] || 'admin';
    setUser({ email: cleanEmail, role });
    setLoginError('');
    setCurrentViewState('dash');
  };

  const logout = () => {
    setUser(null);
    setChatMessages([]);
    setScenarioGrowth(null);
    setLoginError('');
  };

  const editKpi = (metric: 'rev' | 'exp', monthIndex: number, value: number) => {
    const num = Math.max(0, +value || 0);
    setCompanies((prev) => {
      const next = [...prev];
      const targetCompany = { ...next[companyIndex] };
      const nextSeries = [...targetCompany[metric]];
      nextSeries[monthIndex] = num;
      targetCompany[metric] = nextSeries;
      next[companyIndex] = targetCompany;
      return next;
    });
  };

  const sendAiMessage = async (q: string) => {
    const cleanQ = q.trim();
    if (!cleanQ) return;

    // Add user message
    setChatMessages((prev) => [...prev, { r: 'u', t: cleanQ }]);

    // Attempt to call backend AI analyst if connected
    if (backendStatus === 'connected' && currentCompany.id && user?.token) {
      try {
        const backendRes = await fetchBackendAIAnalysis(
          currentCompany.id,
          cleanQ,
          user.token
        );
        if (backendRes && backendRes.answer) {
          setChatMessages((prev) => [
            ...prev,
            {
              r: 'a',
              t: backendRes.answer,
              s: `FastAPI AI Analyst · ${currentCompany.n}`,
            },
          ]);
          return;
        }
      } catch {
        // Fallback to grounded local calculations if backend fails
      }
    }

    // Local grounded engine with language support
    const { answer, source } = answerQuery(currentCompany, cleanQ, language);
    setChatMessages((prev) => [
      ...prev,
      { r: 'a', t: answer, s: source },
    ]);
  };

  return (
    <AppContext.Provider
      value={{
        user,
        companies,
        currentCompany,
        companyIndex,
        currentView,
        scenarioGrowth,
        chatMessages,
        theme,
        language,
        backendStatus,
        loginError,
        login,
        quickLogin,
        logout,
        setView,
        setCompanyIndex,
        editKpi,
        setScenarioGrowth,
        sendAiMessage,
        toggleTheme,
        setLanguage,
        checkBackend,
        t,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};
