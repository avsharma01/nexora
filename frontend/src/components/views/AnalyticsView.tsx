'use client';

import React from 'react';
import { useApp } from '../../context/AppContext';
import { KpiCard } from '../ui/KpiCard';
import { LineChart } from '../charts/LineChart';
import { BarChart } from '../charts/BarChart';
import { ChartLegend } from '../charts/ChartLegend';
import { TRANSLATIONS } from '../../lib/i18n';
import {
  formatPct,
  getProfits,
  getQuarterlyStats,
} from '../../lib/calculations';

export const AnalyticsView: React.FC = () => {
  const { currentCompany, language, t } = useApp();

  const r = currentCompany.rev;
  const q = getQuarterlyStats(currentCompany);
  const profits = getProfits(currentCompany);

  const activeDict = TRANSLATIONS[language] || TRANSLATIONS.en;
  const localizedMonths = [...activeDict.months];

  const mom = r.map((v, i) => (i > 0 && r[i - 1] ? ((v / r[i - 1] - 1) * 100) : null));
  const maxRev = Math.max(...r);
  const best = r.indexOf(maxRev);
  const yoy = r[0] ? ((r[r.length - 1] / r[0] - 1) * 100) : 0;

  const comparisonRows = [
    { name: t('revenueLegend'), prev: q.rp, last: q.rq },
    { name: t('expensesLegend'), prev: q.ep, last: q.eq },
    { name: t('profitLegend'), prev: q.pp, last: q.pq },
  ];

  return (
    <>
      <div className="grid">
        <KpiCard
          label={t('growth12Mo')}
          value={formatPct(yoy)}
        />
        <KpiCard
          label={t('qoqRevenue')}
          value={formatPct(q.rg)}
        />
        <KpiCard
          label={t('qoqProfit')}
          value={formatPct(q.pg)}
        />
        <KpiCard
          label={t('bestMonth')}
          value={`${localizedMonths[best]} · ${maxRev}`}
        />
      </div>

      <div className="grid g2" style={{ marginTop: '14px' }}>
        <div className="card">
          <h2>{t('revProfitTrend')}</h2>
          <LineChart
            series={[
              { v: r, c: 'var(--ac)' },
              { v: profits, c: 'var(--ok)' },
            ]}
            labels={localizedMonths}
          />
          <ChartLegend
            items={[
              [t('revenueLegend'), 'var(--ac)'],
              [t('profitLegend'), 'var(--ok)'],
            ]}
          />
        </div>

        <div className="card">
          <h2>{t('periodComparison')}</h2>
          <table>
            <thead>
              <tr>
                <th>{t('metricCol')}</th>
                <th>{t('prevQCol')}</th>
                <th>{t('lastQCol')}</th>
                <th>{t('changeCol')}</th>
              </tr>
            </thead>
            <tbody>
              {comparisonRows.map((row) => {
                const changePct = row.prev !== 0 ? ((row.last / row.prev - 1) * 100) : 0;
                const isUp = row.last >= row.prev;

                return (
                  <tr key={row.name}>
                    <td>{row.name}</td>
                    <td>{row.prev}</td>
                    <td>{row.last}</td>
                    <td className={isUp ? 'up' : 'dn'}>
                      {formatPct(changePct)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          <h2 style={{ marginTop: '16px' }}>{t('momRevenueGrowth')}</h2>
          <div className="scroll">
            <BarChart
              a={mom.map((v) => Math.max(v || 0, 0))}
              b={mom.map((v) => Math.max(-(v || 0), 0))}
              labels={localizedMonths}
              h={150}
            />
          </div>
          <ChartLegend
            items={[
              [t('positiveGrowth'), 'var(--ac)'],
              [t('negativeGrowth'), 'var(--ac2)'],
            ]}
          />
        </div>
      </div>
    </>
  );
};
