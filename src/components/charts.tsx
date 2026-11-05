// Lightweight SVG charts: warming stripes, sparkline, line chart with an
// optional linear trend, and SPI bars. No chart library: the site only needs
// these four marks and they must stay crisp at any size.

import { useId, useState } from "react";
import { fmt } from "../data/indicators";

type Values = Array<number | null>;

// Hawkins palette (blue → red), anomalies clipped to ±range.
const STRIPE_COLORS = ["#08306b", "#08519c", "#2171b5", "#4292c6", "#6baed6", "#9ecae1", "#c6dbef", "#deebf7", "#fee0d2", "#fcbba1", "#fc9272", "#fb6a4a", "#ef3b2c", "#cb181d", "#a50f15", "#67000d"];

function stripeColor(value: number, range: number): string {
  const t = Math.max(0, Math.min(0.9999, (value + range) / (2 * range)));
  return STRIPE_COLORS[Math.floor(t * STRIPE_COLORS.length)];
}

export function Stripes({ values, start, height = 80, range = 1.6, label }: { values: Values; start: number; height?: number; range?: number; label?: string }) {
  const [hover, setHover] = useState<number | null>(null);
  const width = values.length;
  return (
    <div className="stripes">
      <svg viewBox={`0 0 ${width} 1`} preserveAspectRatio="none" style={{ height }} role="img" aria-label={label ?? `Bandes de réchauffement ${start}-${start + width - 1}`} onMouseLeave={() => setHover(null)}>
        {values.map((value, i) => (
          <rect key={i} x={i} y={0} width={1.02} height={1} fill={value === null ? "#e6e9ef" : stripeColor(value, range)} onMouseEnter={() => setHover(i)} />
        ))}
      </svg>
      <div className="stripes-axis">
        <span>{start}</span>
        <span className="stripes-readout">{hover !== null ? `${start + hover} · ${fmt(values[hover], 2, true)} °C` : "Survolez une année"}</span>
        <span>{start + width - 1}</span>
      </div>
    </div>
  );
}

export function Sparkline({ values, width = 120, height = 32, zero = true, color = "var(--accent)" }: { values: Values; width?: number; height?: number; zero?: boolean; color?: string }) {
  const nums = values.filter((v): v is number => v !== null);
  if (nums.length < 2) return <svg width={width} height={height} />;
  const min = Math.min(...nums, zero ? 0 : Infinity);
  const max = Math.max(...nums, zero ? 0 : -Infinity);
  const span = max - min || 1;
  const x = (i: number) => (i / (values.length - 1)) * width;
  const y = (v: number) => height - 2 - ((v - min) / span) * (height - 4);
  const path = values.map((v, i) => (v === null ? null : `${x(i).toFixed(1)},${y(v).toFixed(1)}`)).filter(Boolean).join(" L");
  const last = [...values].reverse().find((v) => v !== null) as number;
  return (
    <svg width={width} height={height} className="sparkline" aria-hidden="true">
      {zero && <line x1={0} x2={width} y1={y(0)} y2={y(0)} className="spark-zero" />}
      <path d={`M${path}`} fill="none" stroke={color} strokeWidth={1.6} strokeLinejoin="round" />
      <circle cx={x(values.lastIndexOf(last))} cy={y(last)} r={2.6} fill={color} />
    </svg>
  );
}

export interface LineSeries {
  name: string;
  color: string;
  start: number;
  values: Values;
  dashed?: boolean;
}

function linearFit(series: LineSeries, from: number) {
  const pts = series.values.map((v, i) => [series.start + i, v] as const).filter((p): p is readonly [number, number] => p[1] !== null && p[0] >= from);
  const n = pts.length;
  if (n < 5) return null;
  const mx = pts.reduce((s, p) => s + p[0], 0) / n;
  const my = pts.reduce((s, p) => s + p[1], 0) / n;
  const b = pts.reduce((s, p) => s + (p[0] - mx) * (p[1] - my), 0) / pts.reduce((s, p) => s + (p[0] - mx) ** 2, 0);
  return { x0: pts[0][0], x1: pts[n - 1][0], f: (x: number) => my + b * (x - mx), slope: b };
}

export function LineChart({ series, height = 260, width = 720, unit = "°C", trendFrom, yLabel }: { series: LineSeries[]; height?: number; width?: number; unit?: string; trendFrom?: number; yLabel?: string }) {
  const clip = useId();
  const [hoverYear, setHoverYear] = useState<number | null>(null);
  const pad = { l: 44, r: 16, t: 14, b: 28 };
  const years = series.flatMap((s) => [s.start, s.start + s.values.length - 1]);
  const x0 = Math.min(...years);
  const x1 = Math.max(...years);
  const nums = series.flatMap((s) => s.values.filter((v): v is number => v !== null));
  const lo = Math.floor(Math.min(0, ...nums) * 2) / 2;
  const hi = Math.ceil(Math.max(0, ...nums) * 2) / 2;
  const x = (year: number) => pad.l + ((year - x0) / (x1 - x0 || 1)) * (width - pad.l - pad.r);
  const y = (v: number) => pad.t + (1 - (v - lo) / (hi - lo || 1)) * (height - pad.t - pad.b);
  const step = hi - lo > 4 ? 1 : 0.5;
  const ticks: number[] = [];
  for (let v = lo; v <= hi + 1e-9; v += step) ticks.push(Math.round(v * 10) / 10);
  const decade = Math.ceil(x0 / 20) * 20;
  const xticks: number[] = [];
  for (let yr = decade; yr <= x1; yr += 20) xticks.push(yr);
  const trend = trendFrom !== undefined && series[0] ? linearFit(series[0], trendFrom) : null;

  const onMove = (event: React.MouseEvent<SVGSVGElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const px = ((event.clientX - rect.left) / rect.width) * width;
    const year = Math.round(x0 + ((px - pad.l) / (width - pad.l - pad.r)) * (x1 - x0));
    setHoverYear(year >= x0 && year <= x1 ? year : null);
  };

  return (
    <div className="linechart">
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={series.map((s) => s.name).join(", ")} onMouseMove={onMove} onMouseLeave={() => setHoverYear(null)}>
        <defs>
          <clipPath id={clip}>
            <rect x={pad.l} y={pad.t} width={width - pad.l - pad.r} height={height - pad.t - pad.b} />
          </clipPath>
        </defs>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={pad.l} x2={width - pad.r} y1={y(t)} y2={y(t)} className={t === 0 ? "grid zero" : "grid"} />
            <text x={pad.l - 8} y={y(t) + 4} className="tick" textAnchor="end">{fmt(t, step < 1 ? 1 : 0, true)}</text>
          </g>
        ))}
        {xticks.map((t) => (
          <text key={t} x={x(t)} y={height - 8} className="tick" textAnchor="middle">{t}</text>
        ))}
        {yLabel && <text x={pad.l} y={10} className="tick">{yLabel}</text>}
        <g clipPath={`url(#${clip})`}>
          {series.map((s) => {
            const d = s.values.map((v, i) => (v === null ? null : `${x(s.start + i).toFixed(1)},${y(v).toFixed(1)}`)).filter(Boolean).join(" L");
            return <path key={s.name} d={`M${d}`} fill="none" stroke={s.color} strokeWidth={2} strokeDasharray={s.dashed ? "5 4" : undefined} strokeLinejoin="round" />;
          })}
          {trend && <line x1={x(trend.x0)} x2={x(trend.x1)} y1={y(trend.f(trend.x0))} y2={y(trend.f(trend.x1))} stroke="var(--ink)" strokeWidth={1.5} strokeDasharray="2 3" />}
        </g>
        {hoverYear !== null && (
          <g>
            <line x1={x(hoverYear)} x2={x(hoverYear)} y1={pad.t} y2={height - pad.b} className="crosshair" />
            {series.map((s) => {
              const v = s.values[hoverYear - s.start];
              return v === null || v === undefined ? null : <circle key={s.name} cx={x(hoverYear)} cy={y(v)} r={3.5} fill={s.color} stroke="var(--surface)" strokeWidth={1.5} />;
            })}
          </g>
        )}
      </svg>
      <div className="chart-foot">
        <div className="chart-legend">
          {series.map((s) => (
            <span key={s.name}><i style={{ background: s.color }} />{s.name}</span>
          ))}
          {trend && <span><i className="dash" />Tendance {trendFrom}+ : {fmt(trend.slope * 10, 2, true)} {unit}/décennie</span>}
        </div>
        <div className="chart-readout">
          {hoverYear !== null
            ? `${hoverYear} · ${series.map((s) => `${s.name} ${fmt(s.values[hoverYear - s.start] ?? null, 2, true)}`).join(" · ")}`
            : " "}
        </div>
      </div>
    </div>
  );
}

export function SpiBars({ values, endMonth, height = 120 }: { values: Values; endMonth: string | null; height?: number }) {
  const [hover, setHover] = useState<number | null>(null);
  const width = 720;
  const max = 3;
  const bw = width / values.length;
  const mid = height / 2;
  const monthOf = (i: number) => {
    if (!endMonth) return "";
    const [yy, mm] = endMonth.split("-").map(Number);
    const d = new Date(yy, mm - 1 - (values.length - 1 - i), 1);
    return d.toLocaleDateString("fr-FR", { month: "short", year: "numeric" });
  };
  return (
    <div className="spibars">
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="SPI-3 des 36 derniers mois" onMouseLeave={() => setHover(null)}>
        {[-2, -1, 1, 2].map((t) => (
          <line key={t} x1={0} x2={width} y1={mid - (t / max) * mid} y2={mid - (t / max) * mid} className="grid" />
        ))}
        <line x1={0} x2={width} y1={mid} y2={mid} className="grid zero" />
        {values.map((v, i) => {
          if (v === null) return <rect key={i} x={i * bw + 2} y={mid - 1} width={bw - 4} height={2} fill="var(--line)" onMouseEnter={() => setHover(i)} />;
          const h = (Math.min(Math.abs(v), max) / max) * mid;
          const color = v <= -1.5 ? "#d64545" : v <= -1 ? "#ee8a3c" : v <= -0.5 ? "#f4c95d" : v >= 1 ? "#5b5bd6" : "#aab3c5";
          return <rect key={i} x={i * bw + 2} y={v >= 0 ? mid - h : mid} width={bw - 4} height={Math.max(h, 1)} rx={2} fill={color} opacity={hover === null || hover === i ? 1 : 0.45} onMouseEnter={() => setHover(i)} />;
        })}
      </svg>
      <div className="stripes-axis">
        <span>{monthOf(0)}</span>
        <span className="stripes-readout">{hover !== null ? `${monthOf(hover)} · SPI-3 ${fmt(values[hover], 2, true)}` : "Survolez un mois"}</span>
        <span>{monthOf(values.length - 1)}</span>
      </div>
    </div>
  );
}
