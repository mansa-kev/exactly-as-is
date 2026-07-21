import React from 'react';

export interface RangeOption {
  label: string;
  value: number; // days
}

export const DEFAULT_RANGES: RangeOption[] = [
  { label: '30 days', value: 30 },
  { label: '90 days', value: 90 },
  { label: '6 months', value: 180 },
  { label: '12 months', value: 365 },
];

interface Props {
  value: number;
  onChange: (v: number) => void;
  options?: RangeOption[];
  className?: string;
}

export function DateRangePicker({ value, onChange, options = DEFAULT_RANGES, className = '' }: Props) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(Number(e.target.value))}
      className={`px-3 py-2 rounded-lg bg-muted text-xs border border-border outline-none focus:ring-2 focus:ring-primary/20 ${className}`}
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>{o.label}</option>
      ))}
    </select>
  );
}

export default DateRangePicker;
