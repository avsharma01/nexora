'use client';

import React from 'react';
import { useApp } from '../../context/AppContext';
import { KpiCard } from '../ui/KpiCard';
import { LineChart } from '../charts/LineChart';
import { ChartLegend } from '../charts/ChartLegend';
import { TRANSLATIONS } from '../../lib/i18n';
import {
  formatCr,
  linearRegression,
  predict,
  calculateMape,
  sum,
} from '../../lib/calculations';

export const ForecastView: React.FC = () => {
  const { currentCompany, language, t } = useApp();

  const r = currentCompany.rev;
  const m = linearRegression(r);

  const activeDict = TRANSLATIONS[language] || TRANSLATIONS.en;
  const localizedMonths = [...activeDict.months];
  const localizedForecastMonths = [...activeDict.forecastMonths];

  const f = localizedForecastMonths.map((_, i) => predict(m, 12 + i));
  const mp = calculateMape(r);

  const combinedLabels = [...localizedMonths, ...localizedForecastMonths];
  const actualSeries: (number | null)[] = [...r, ...Array(6).fill(null)];
  const forecastSeries: (number | null)[] = [
    ...Array(11).fill(null),
    r[11] ?? null,
    ...f,
  ];

  return (
    <>
      <div className="grid">
        <KpiCard label={t('model')} value={t('linearTrend')} />
        <KpiCard
          label={t('nextMonthRevenue')}
          value={formatCr(f[0] || 0)}
        />
        <KpiCard
          label={t('projected6Mo')}
          value={formatCr(sum(f))}
        />
        <KpiCard
          label={t('backtestMape')}
          value={mp.toFixed(1) + '%'}
        />
      </div>

      <div className="card" style={{ marginTop: '14px' }}>
        <h2>{t('revenueForecast6Mo')}</h2>
        <LineChart
          series={[
            { v: actualSeries, c: 'var(--ac)' },
            { v: forecastSeries, c: 'var(--wn)', d: 1 },
          ]}
          labels={combinedLabels}
        />
        <ChartLegend
          items={[
            [t('actualLegend'), 'var(--ac)'],
            [t('forecastLegend'), 'var(--wn)'],
          ]}
        />
        <div className="sub" style={{ marginTop: '8px' }}>
          {t('forecastFootnote')}
        </div>
      </div>

      <div className="card" style={{ marginTop: '14px' }}>
        <div className="scroll">
          <table>
            <thead>
              <tr>
                <th>{t('monthCol')}</th>
                {localizedForecastMonths.map((mth, idx) => (
                  <th key={idx}>{mth}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>{t('forecastLegend')}</td>
                {f.map((val, idx) => (
                  <td key={idx}>{val.toFixed(1)}</td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
};
