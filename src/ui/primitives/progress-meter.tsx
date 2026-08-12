import type { ReactNode } from "react";

export type ProgressMeterProps = {
  id: string;
  label: ReactNode;
  max: number;
  value: number;
  valueLabel?: ReactNode;
};

export function ProgressMeter({
  id,
  label,
  max,
  value,
  valueLabel,
}: ProgressMeterProps) {
  return (
    <div className="u-stack u-stack--sm">
      <div className="action-row">
        <label htmlFor={id}>{label}</label>
        {valueLabel !== undefined && valueLabel !== null ? (
          <span className="action-row__meta">{valueLabel}</span>
        ) : null}
      </div>
      <progress className="meter" id={id} max={max} value={value}>
        {value} of {max}
      </progress>
    </div>
  );
}
