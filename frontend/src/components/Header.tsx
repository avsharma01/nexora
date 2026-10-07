'use client';

import React from 'react';
import { useApp } from '../context/AppContext';
import { LanguageSelector } from './LanguageSelector';

export const Header: React.FC = () => {
  const { currentView, currentCompany, companyIndex, setCompanyIndex, companies, t } = useApp();

  return (
    <div className="top">
      <div>
        <h1>{t(currentView)}</h1>
        <div className="sub">
          {currentCompany.n} · {t('currencyUnit')}
        </div>
      </div>

      <div className="row">
        <LanguageSelector variant="header" />
        <select
          value={companyIndex}
          onChange={(e) => setCompanyIndex(Number(e.target.value))}
          aria-label="Select company"
        >
          {companies.map((co, idx) => (
            <option key={co.n + idx} value={idx}>
              {co.n}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
};
