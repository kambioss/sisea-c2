// Form controls of the géoportail panel: segmented buttons, dual-thumb range
// slider, removable chips, and the inline help tooltip.

import { useState } from "react";
import { Icon } from "../components/Icon";
import { fmt } from "../data/indicators";

export function Segmented<T extends string>({ value, options, onChange, size = "md" }: { value: T; options: Array<{ id: T; label: string }>; onChange(id: T): void; size?: "sm" | "md" }) {
  return (
    <div className={`segmented ${size}`} role="radiogroup">
      {options.map((option) => (
        <button key={option.id} role="radio" aria-checked={value === option.id} className={value === option.id ? "on" : ""} onClick={() => onChange(option.id)}>
          {option.label}
        </button>
      ))}
    </div>
  );
}

export function RangeSlider({ domain, value, step, decimals, onChange }: { domain: [number, number]; value: [number, number]; step: number; decimals: number; onChange(v: [number, number]): void }) {
  const [lo, hi] = value;
  const pct = (v: number) => ((v - domain[0]) / (domain[1] - domain[0])) * 100;
  return (
    <div className="range">
      <div className="range-track">
        <div className="range-fill" style={{ left: `${pct(lo)}%`, right: `${100 - pct(hi)}%` }} />
      </div>
      <input type="range" min={domain[0]} max={domain[1]} step={step} value={lo} aria-label="Valeur minimale" onChange={(e) => onChange([Math.min(Number(e.target.value), hi), hi])} />
      <input type="range" min={domain[0]} max={domain[1]} step={step} value={hi} aria-label="Valeur maximale" onChange={(e) => onChange([lo, Math.max(Number(e.target.value), lo)])} />
      <div className="range-labels">
        <span style={{ left: `${pct(lo)}%` }}>{fmt(lo, decimals)}</span>
        <span style={{ left: `${pct(hi)}%` }}>{fmt(hi, decimals)}</span>
      </div>
    </div>
  );
}

export function Chip({ label, onRemove }: { label: string; onRemove(): void }) {
  return (
    <span className="chip">
      {label}
      <button onClick={onRemove} aria-label={`Retirer ${label}`}>
        <Icon name="close" size={12} />
      </button>
    </span>
  );
}

export function Help({ text }: { text: string }) {
  const [open, setOpen] = useState(false);
  return (
    <span className="help" onMouseEnter={() => setOpen(true)} onMouseLeave={() => setOpen(false)} onFocus={() => setOpen(true)} onBlur={() => setOpen(false)} tabIndex={0} aria-label={text}>
      <Icon name="help" size={14} />
      {open && <span className="help-tip" role="tooltip">{text}</span>}
    </span>
  );
}
