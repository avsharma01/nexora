import React from 'react';
import { formatPct } from '../../lib/calculations';

interface KpiCardProps {
  label: string;
  value: string;
  subtext?: string;
  change?: number | null;
  changeLabel?: string;
  isUp?: boolean;
}

export const KpiCard: React.FC<KpiCardProps> = ({
  label,
  value,
  subtext,
  change,
  changeLabel = 'vs prev. quarter',
  isUp,
}) => {
  const isPositive = isUp !== undefined ? isUp : change !== undefined && change !== null ? change >= 0 : true;

  return (
    <div className="card kpi">
      <div className="l">{label}</div>
      {subtext && <div className="sub">{subtext}</div>}
      <div className="v">{value}</div>
      {change !== undefined && change !== null && (
        <div className={isPositive ? 'up' : 'dn'}>
          {formatPct(change)} {changeLabel}
        </div>
      )}
    </div>
  );
};
