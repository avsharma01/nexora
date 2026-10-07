import React from 'react';

interface ChartLegendProps {
  items: Array<[string, string]>; // [label, color]
}

export const ChartLegend: React.FC<ChartLegendProps> = ({ items }) => {
  return (
    <div className="leg">
      {items.map(([label, color], idx) => (
        <span key={idx}>
          <b style={{ background: color }} />
          {label}
        </span>
      ))}
    </div>
  );
};
