import React from 'react';

export interface LineSeries {
  v: (number | null)[];
  c: string; // color
  d?: boolean | number; // dashed
}

interface LineChartProps {
  series: LineSeries[];
  labels: string[];
  h?: number;
}

export const LineChart: React.FC<LineChartProps> = ({ series, labels, h = 240 }) => {
  const W = 640;
  const P = 34;

  const validValues = series
    .flatMap((s) => s.v.filter((v): v is number => v !== null && v !== undefined && !isNaN(v)));

  const lo = validValues.length > 0 ? Math.min(...validValues) * 0.9 : 0;
  const hi = validValues.length > 0 ? Math.max(...validValues) * 1.05 : 100;
  const range = hi - lo === 0 ? 1 : hi - lo;
  const n = labels.length;

  const X = (i: number) => P + (n > 1 ? (i * (W - P - 10)) / (n - 1) : 0);
  const Y = (v: number) => h - 24 - ((v - lo) / range) * (h - 40);

  // Generate 4 grid lines
  const gridLines = [0, 1, 2, 3].map((k) => {
    const v = lo + (range * k) / 3;
    const y = Y(v);
    return { v, y };
  });

  return (
    <svg viewBox={`0 0 ${W} ${h}`} width="100%" role="img" style={{ display: 'block' }}>
      {/* Grid lines & Y-axis labels */}
      {gridLines.map((gl, k) => (
        <React.Fragment key={k}>
          <line
            x1={P}
            x2={W - 10}
            y1={gl.y}
            y2={gl.y}
            stroke="var(--bd)"
            strokeWidth="1"
          />
          <text x={2} y={gl.y + 4} fontSize="10" fill="var(--mu)">
            {gl.v.toFixed(0)}
          </text>
        </React.Fragment>
      ))}

      {/* X-axis labels */}
      {labels.map((l, i) => {
        if (i % 2 === 0 || n < 8) {
          return (
            <text
              key={i}
              x={X(i)}
              y={h - 6}
              fontSize="10"
              textAnchor="middle"
              fill="var(--mu)"
            >
              {l}
            </text>
          );
        }
        return null;
      })}

      {/* Series paths */}
      {series.map((s, sIdx) => {
        let d = '';
        let pen = false;

        s.v.forEach((v, i) => {
          if (v === null || v === undefined || isNaN(v)) {
            pen = false;
            return;
          }
          d += (pen ? ' L' : ' M') + X(i).toFixed(1) + ' ' + Y(v).toFixed(1);
          pen = true;
        });

        return (
          <path
            key={sIdx}
            d={d}
            fill="none"
            stroke={s.c}
            strokeWidth="2.4"
            strokeDasharray={s.d ? '6 4' : undefined}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        );
      })}
    </svg>
  );
};
