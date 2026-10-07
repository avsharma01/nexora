'use client';

import React from 'react';
import { useApp } from '../../context/AppContext';
import { TRANSLATIONS } from '../../lib/i18n';
import { getProfits } from '../../lib/calculations';

export const CompanyKpiView: React.FC = () => {
  const { user, currentCompany, editKpi, language, t } = useApp();
  const isAdmin = user?.role === 'admin';
  const profits = getProfits(currentCompany);

  const activeDict = TRANSLATIONS[language] || TRANSLATIONS.en;
  const localizedMonths = activeDict.months;

  return (
    <>
      <div className="card" style={{ marginBottom: '14px' }}>
        <h2>{t('companyProfile')}</h2>
        <div className="grid">
          <div>
            <div className="sub">{t('companyName')}</div>
            <strong>{currentCompany.n}</strong>
          </div>
          <div>
            <div className="sub">{t('sector')}</div>
            <strong>{currentCompany.s}</strong>
          </div>
          <div>
            <div className="sub">{t('hq')}</div>
            <strong>{currentCompany.hq}</strong>
          </div>
          <div>
            <div className="sub">{t('founded')}</div>
            <strong>{currentCompany.f}</strong>
          </div>
          <div>
            <div className="sub">{t('employees')}</div>
            <strong>{currentCompany.e}</strong>
          </div>
        </div>
      </div>

      <div className="card">
        <h2>
          {t('kpiFinancials')}{' '}
          {isAdmin ? (
            <span className="sub" style={{ fontWeight: 'normal' }}>
              {t('adminEditNote')}
            </span>
          ) : (
            <span className="sub" style={{ fontWeight: 'normal' }}>
              {t('readOnlyNote', { role: user?.role || '' })}
            </span>
          )}
        </h2>

        <div className="scroll">
          <table>
            <thead>
              <tr>
                <th>{t('monthCol')}</th>
                <th>{t('revenueCol')}</th>
                <th>{t('expensesCol')}</th>
                <th>{t('profitCol')}</th>
                <th>{t('marginCol')}</th>
              </tr>
            </thead>
            <tbody>
              {localizedMonths.map((m, i) => {
                const revVal = currentCompany.rev[i] ?? 0;
                const expVal = currentCompany.exp[i] ?? 0;
                const profitVal = profits[i] ?? 0;
                const marginVal = revVal !== 0 ? ((profitVal / revVal) * 100).toFixed(1) : '0.0';

                return (
                  <tr key={m + i}>
                    <td>{m}</td>
                    <td>
                      {isAdmin ? (
                        <input
                          type="number"
                          value={revVal}
                          onChange={(e) => editKpi('rev', i, Number(e.target.value))}
                          aria-label={`${m} revenue`}
                        />
                      ) : (
                        revVal
                      )}
                    </td>
                    <td>
                      {isAdmin ? (
                        <input
                          type="number"
                          value={expVal}
                          onChange={(e) => editKpi('exp', i, Number(e.target.value))}
                          aria-label={`${m} expenses`}
                        />
                      ) : (
                        expVal
                      )}
                    </td>
                    <td className={profitVal >= 0 ? 'up' : 'dn'}>
                      {profitVal}
                    </td>
                    <td>{marginVal}%</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
};
