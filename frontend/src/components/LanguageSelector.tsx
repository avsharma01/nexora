'use client';

import React from 'react';
import { useApp } from '../context/AppContext';
import { LANGUAGES, SupportedLanguage } from '../lib/i18n';

interface LanguageSelectorProps {
  variant?: 'header' | 'sidebar' | 'login';
}

export const LanguageSelector: React.FC<LanguageSelectorProps> = ({ variant = 'header' }) => {
  const { language, setLanguage } = useApp();

  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '4px',
        position: 'relative',
      }}
    >
      <select
        value={language}
        onChange={(e) => setLanguage(e.target.value as SupportedLanguage)}
        aria-label="Select language"
        style={{
          background: 'var(--card)',
          border: '1px solid var(--bd)',
          borderRadius: '8px',
          padding: variant === 'sidebar' ? '4px 6px' : '6px 8px',
          fontSize: variant === 'sidebar' ? '12px' : '13px',
          color: 'var(--tx)',
          cursor: 'pointer',
          outline: 'none',
        }}
      >
        {LANGUAGES.map((lang) => (
          <option key={lang.code} value={lang.code}>
            {lang.flag} {lang.name}
          </option>
        ))}
      </select>
    </div>
  );
};
