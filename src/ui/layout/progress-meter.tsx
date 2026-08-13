"use client";

import type { ReactNode } from "react";

import {
  Progress,
  ProgressLabel,
  ProgressValue,
} from "@/components/ui/progress";

export type ProgressMeterProps = {
  id: string;
  label: ReactNode;
  max: number;
  value: number;
  valueLabel?: ReactNode;
  /**
   * Plain-text counterpart of `valueLabel`. `ProgressValue` is `aria-hidden`, so
   * without this the progressbar announces the default formatted percentage
   * instead of the human sentence beside it.
   */
  valueText?: string;
};

export function ProgressMeter({
  id,
  label,
  max,
  value,
  valueLabel,
  valueText,
}: ProgressMeterProps) {
  // Base UI only registers the label id in a layout effect, so the root has no
  // accessible name in server HTML. Naming it from a known id fixes that.
  const labelId = `${id}-label`;

  return (
    <Progress
      aria-labelledby={labelId}
      className="gap-2"
      getAriaValueText={valueText === undefined ? undefined : () => valueText}
      id={id}
      max={max}
      value={value}
    >
      <ProgressLabel id={labelId}>{label}</ProgressLabel>
      {valueLabel !== undefined && valueLabel !== null ? (
        <ProgressValue>{() => valueLabel}</ProgressValue>
      ) : null}
    </Progress>
  );
}
