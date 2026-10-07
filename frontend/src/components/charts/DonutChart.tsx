import React from 'react';
import { ChartLegend } from './ChartLegend';

interface DonutChartProps {
  data: Array<[string, number]>; // [label, value]
  centerText: string;
}

const COLORS = [
  'var(--ac)',
  'var(--ac2)',
  'var(--ok)',
  'var(--wn)',
  'var(--bad)',
];

export const DonutChart: React.FC<DonutChartProps> = ({ data, centerText }) => {
  const total = data.reduce((acc, curr) => acc + curr[1], 0);
  const R = 90;
  const r = 52;
  const cx = 100;
  const cy = 100;

  const point = (angle: number, radius: number): [number, number] => [
    cx + radius * Math.cos(angle),
    cy + radius * Math.sin(angle),
  ];

  let currentAngle = -Math.PI / 2;

  const paths = data.map((item, i) => {
    const fraction = total > 0 ? item[1] / total : 0;
    const nextAngle = currentAngle + fraction * 2 * Math.PI;
    const largeArc = fraction > 0.5 ? 1 : 0;

    const [x1, y1] = point(currentAngle, R);
    const [x2, y2] = point(nextAngle, R);
    const [x3, y3] = point(nextAngle, r);
    const [x4, y4] = point(currentAngle, r);

    const pathData = `M${x1.toFixed(2)} ${y1.toFixed(2)} A${R} ${R} 0 ${largeArc} 1 ${x2.toFixed(2)} ${y2.toFixed(2)} L${x3.toFixed(2)} ${y3.toFixed(2)} A${r} ${r} 0 ${largeArc} 0 ${x4.toFixed(2)} ${y4.toFixed(2)} Z`;

    currentAngle = nextAngle;
    const color = COLORS[i % COLORS.length];

    return (
      <path
        key={i}
        d={pathData}
        fill={color}
        stroke="var(--card)"
        strokeWidth="2"
      />
    );
  });

  const legendItems: Array<[string, string]> = data.map((item, i) => {
    const pct = total > 0 ? ((item[1] / total) * 100).toFixed(0) : '0';
    return [`${item[0]} ${pct}%`, COLORS[i % COLORS.length]];
  });

  return (
    <div>
      <svg
        viewBox="0 0 200 200"
        width="100%"
        style={{ maxWidth: '220px', display: 'block', margin: 'auto' }}
        role="img"
      >
        {paths}
        <text
          x="100"
          y="98"
          fontSize="11"
          textAnchor="middle"
          fill="var(--mu)"
        >
          Last quarter
        </text>
        <text
          x="100"
          y="116"
          fontSize="14"
          fontWeight="700"
          textAnchor="middle"
          fill="var(--tx)"
        >
          {centerText}
        </text>
      </svg>
      <ChartLegend items={legendItems} />
    </div>
  );
};
