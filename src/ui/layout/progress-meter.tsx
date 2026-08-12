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
};

export function ProgressMeter({
  id,
  label,
  max,
  value,
  valueLabel,
}: ProgressMeterProps) {
  return (
    <Progress className="gap-2" id={id} max={max} value={value}>
      <ProgressLabel>{label}</ProgressLabel>
      {valueLabel !== undefined && valueLabel !== null ? (
        <ProgressValue>{() => valueLabel}</ProgressValue>
      ) : null}
    </Progress>
  );
}
