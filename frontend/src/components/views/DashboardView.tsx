'use client';

import React from 'react';
import { useApp } from '../../context/AppContext';
import { KpiCard } from '../ui/KpiCard';
import { BarChart } from '../charts/BarChart';
import { LineChart } from '../charts/LineChart';
import { DonutChart } from '../charts/DonutChart';
import { ChartLegend } from '../charts/ChartLegend';
import { REVENUE_MIX, COST_MIX } from '../../lib/mockData';
import { TRANSLATIONS } from '../../lib/i18n';
import {
  formatCr,
  getProfits,
  getQuarterlyStats,
  sum,
} from '../../lib/calculations';

export const DashboardView: React.FC = () => {
  const { currentCompany, companyIndex, language, t } = useApp();

  const q = getQuarterlyStats(currentCompany);
  const r = currentCompany.rev;
  const e = currentCompany.exp;
  const p = getProfits(currentCompany);
  const mg = p.map((v, i) => (r[i] ? (v / r[i]) * 100 : 0));

  const quarters = [0, 3, 6, 9].map((k) => [
    sum(r.slice(k, k + 3)),
    sum(e.slice(k, k + 3)),
  ]);

  const activeDict = TRANSLATIONS[language] || TRANSLATIONS.en;
  const localizedMonths = [...activeDict.months];
  const quarterLabels = [...activeDict.quarterLabels];

  const revMix = REVENUE_MIX[companyIndex] || REVENUE_MIX[0];
  const costMix = COST_MIX[companyIndex] || COST_MIX[0];

  return (
    <>
      <div className="grid">
        <KpiCard
          label={t('revenueQ')}
          value={formatCr(q.rq)}
          change={q.rg}
          changeLabel={t('vsPrevQuarter')}
        />
        <KpiCard
          label={t('expensesQ')}
          value={formatCr(q.eq)}
          change={q.eg}
          changeLabel={t('vsPrevQuarter')}
        />
        <KpiCard
          label={t('profitQ')}
          value={formatCr(q.pq)}
          change={q.pg}
          changeLabel={t('vsPrevQuarter')}
        />
        <KpiCard
          label={t('profitMargin')}
          value={q.mg.toFixed(1) + '%'}
        />
      </div>

      <div className="grid g2" style={{ marginTop: '14px' }}>
        <div className="card">
          <h2>{t('revVsExp')}</h2>
          <BarChart a={r} b={e} labels={localizedMonths} />
          <ChartLegend
            items={[
              [t('revenueLegend'), 'var(--ac)'],
              [t('expensesLegend'), 'var(--ac2)'],
            ]}
          />
        </div>

        <div className="card">
          <h2>{t('monthlyProfit')}</h2>
          <LineChart series={[{ v: p, c: 'var(--ok)' }]} labels={localizedMonths} />
        </div>

        <div className="card">
          <h2>{t('revMixSegment')}</h2>
          <DonutChart data={revMix} centerText={formatCr(q.rq)} />
          <div className="sub" style={{ textAlign: 'center', marginTop: '6px' }}>
            {t('syntheticSegmentSplit')}
          </div>
        </div>

        <div className="card">
          <h2>{t('expenseBreakdown')}</h2>
          <DonutChart data={costMix} centerText={formatCr(q.eq)} />
          <div className="sub" style={{ textAlign: 'center', marginTop: '6px' }}>
            {t('syntheticCostSplit')}
          </div>
        </div>

        <div className="card">
          <h2>{t('profitMarginTrend')}</h2>
          <LineChart series={[{ v: mg, c: 'var(--wn)' }]} labels={localizedMonths} />
        </div>

        <div className="card">
          <h2>{t('quarterlyRevVsExp')}</h2>
          <BarChart
            a={quarters.map((x) => x[0])}
            b={quarters.map((x) => x[1])}
            labels={quarterLabels}
          />
          <ChartLegend
            items={[
              [t('revenueLegend'), 'var(--ac)'],
              [t('expensesLegend'), 'var(--ac2)'],
            ]}
          />
        </div>
      </div>
    </>
  );
};
