'use client';

import React from 'react';
import { useApp } from '../../context/AppContext';
import { LineChart } from '../charts/LineChart';
import { ChartLegend } from '../charts/ChartLegend';
import { TRANSLATIONS } from '../../lib/i18n';
import {
  getBaselineGrowth,
  computeScenario,
  sum,
  formatCr,
  formatPct,
} from '../../lib/calculations';

export const WhatIfView: React.FC = () => {
  const { currentCompany, scenarioGrowth, setScenarioGrowth, language, t } = useApp();

  const baseline = getBaselineGrowth(currentCompany);
  const activeGrowth = scenarioGrowth !== null ? scenarioGrowth : Number(baseline.toFixed(1));

  const bs = computeScenario(currentCompany, baseline);
  const sc = computeScenario(currentCompany, activeGrowth);

  const tb = sum(bs.rev);
  const ts = sum(sc.rev);
  const pb = sum(bs.prof);
  const ps = sum(sc.prof);

  const activeDict = TRANSLATIONS[language] || TRANSLATIONS.en;
  const localizedForecastMonths = [...activeDict.forecastMonths];

  const kpis: Array<[string, number, number]> = [
    [t('rev6Mo'), tb, ts],
    [t('prof6Mo'), pb, ps],
  ];

  return (
    <>
      <div className="card">
        <h2>{t('assumptionGrowth')}</h2>
        <div className="row">
          <input
            type="range"
            min="-3"
            max="8"
            step="0.1"
            value={activeGrowth}
            onChange={(e) => setScenarioGrowth(Number(e.target.value))}
            style={{ flex: 1, minWidth: '200px' }}
            aria-label="Monthly revenue growth percentage"
          />
          <strong style={{ minWidth: '95px' }}>
            {t('perMonth', { val: activeGrowth.toFixed(1) })}
          </strong>
          <button
            className="btn ghost"
            onClick={() => setScenarioGrowth(null)}
            type="button"
          >
            {t('resetBaseline')}
          </button>
        </div>
        <div className="sub" style={{ marginTop: '6px' }}>
          {t('baselineNote', { val: baseline.toFixed(1) })}
        </div>
      </div>

      <div className="grid" style={{ marginTop: '14px' }}>
        {kpis.map(([label, baseVal, scenVal], idx) => {
          const changePct = baseVal !== 0 ? ((scenVal / baseVal - 1) * 100) : 0;
          const isUp = scenVal >= baseVal;

          return (
            <div key={idx} className="card kpi">
              <div className="l">{label}</div>
              <div className="sub">{t('baselinePrefix', { val: formatCr(baseVal) })}</div>
              <div className="v">{formatCr(scenVal)}</div>
              <div className={isUp ? 'up' : 'dn'}>
                {formatPct(changePct)} {t('vsBaseline')}
              </div>
            </div>
          );
        })}
      </div>

      <div className="card" style={{ marginTop: '14px' }}>
        <h2>{t('baselineVsScenario')}</h2>
        <LineChart
          series={[
            { v: bs.rev, c: 'var(--ac)' },
            { v: sc.rev, c: 'var(--wn)', d: 1 },
          ]}
          labels={localizedForecastMonths}
        />
        <ChartLegend
          items={[
            [t('baselineLegend'), 'var(--ac)'],
            [t('scenarioLegend'), 'var(--wn)'],
          ]}
        />

        <div className="scroll" style={{ marginTop: '10px' }}>
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
                <td>{t('baselineRevRow')}</td>
                {bs.rev.map((v, idx) => (
                  <td key={idx}>{v.toFixed(1)}</td>
                ))}
              </tr>
              <tr>
                <td>{t('scenarioRevRow')}</td>
                {sc.rev.map((v, idx) => (
                  <td key={idx}>{v.toFixed(1)}</td>
                ))}
              </tr>
              <tr>
                <td>{t('scenarioProfitRow')}</td>
                {sc.prof.map((v, idx) => (
                  <td key={idx}>{v.toFixed(1)}</td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
};
