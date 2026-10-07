import React from 'react';

interface BarChartProps {
  a: number[];
  b: number[];
  labels: string[];
  h?: number;
  colorA?: string;
  colorB?: string;
}

export const BarChart: React.FC<BarChartProps> = ({
  a,
  b,
  labels,
  h = 240,
  colorA = 'var(--ac)',
  colorB = 'var(--ac2)',
}) => {
  const W = 640;
  const P = 30;
  const n = labels.length;

  const maxVal = Math.max(...a, ...b, 1);
  const hi = maxVal * 1.1;
  const bw = n > 0 ? (W - P) / n : 10;
  const Y = (v: number) => h - 24 - (v / hi) * (h - 40);

  return (
    <svg viewBox={`0 0 ${W} ${h}`} width="100%" role="img" style={{ display: 'block' }}>
      {labels.map((l, i) => {
        const x = P + i * bw;
        const valA = a[i] ?? 0;
        const valB = b[i] ?? 0;
        const yA = Y(valA);
        const yB = Y(valB);
        const heightA = Math.max(0, h - 24 - yA);
        const heightB = Math.max(0, h - 24 - yB);

        return (
          <React.Fragment key={i}>
            <rect
              x={x + 4}
              y={yA}
              width={Math.max(1, bw / 2 - 5)}
              height={heightA}
              fill={colorA}
              rx={2}
            />
            <rect
              x={x + bw / 2}
              y={yB}
              width={Math.max(1, bw / 2 - 5)}
              height={heightB}
              fill={colorB}
              rx={2}
            />
            <text
              x={x + bw / 2}
              y={h - 6}
              fontSize="10"
              textAnchor="middle"
              fill="var(--mu)"
            >
              {l}
            </text>
          </React.Fragment>
        );
      })}
    </svg>
  );
};
