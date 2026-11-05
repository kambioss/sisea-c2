// Climate-trend marks of the géoportail drawer: annual stripes with one row
// per source (observed, CMIP6 models), and the seasonal grid (12 observed
// months, 4 model seasons) — the IPCC Interactive Atlas reading, drawn as SVG.

import { useState } from "react";
import { MONTHS_SHORT, SEASONS_SHORT, rampColor } from "../data/climateTrends";

type Series = Array<number | null>;

function signed(v: number, unit: string): string {
  const t = Math.abs(v).toLocaleString("fr-FR", { minimumFractionDigits: unit ? 1 : 2, maximumFractionDigits: unit ? 2 : 2 });
  return `${v > 0 ? "+" : v < 0 ? "−" : ""}${t}${unit ? ` ${unit}` : ""}`;
}

function YearAxis({ years, x, y, step = 20 }: { years: number[]; x: (i: number) => number; y: number; step?: number }) {
  return (
    <g>
      {years.map((yr, i) => (yr % step === 0 ? <text key={yr} x={x(i) + 0.5} y={y} className="tc-tick" textAnchor="middle">{yr}</text> : null))}
    </g>
  );
}

export function RampLegend({ ramp, range, unit }: { ramp: string[]; range: number; unit: string }) {
  return (
    <div className="ramp-legend">
      <span>{signed(-range, unit)}</span>
      <i style={{ background: `linear-gradient(90deg, ${ramp.join(",")})` }} />
      <span>{signed(range, unit)}</span>
    </div>
  );
}

export function StripeRows({ years, rows, ramp, range, unit, lastObs }: { years: number[]; rows: Array<{ label: string; values: Series }>; ramp: string[]; range: number; unit: string; lastObs: number }) {
  const [hover, setHover] = useState<{ i: number; row: number } | null>(null);
  const W = 1000;
  const labelW = 74;
  const rowH = rows.length > 1 ? 46 : 70;
  const H = rows.length * (rowH + 6) + 18;
  const cw = (W - labelW - 18) / years.length;
  const x = (i: number) => labelW + i * cw;
  const obsEnd = years.indexOf(lastObs);
  const hv = hover ? rows[hover.row].values[hover.i] : null;
  return (
    <div className="tc-chart">
      <svg viewBox={`0 0 ${W} ${H}`} onMouseLeave={() => setHover(null)} role="img" aria-label="Bandes annuelles">
        {rows.map((row, r) => (
          <g key={row.label} transform={`translate(0 ${r * (rowH + 6)})`}>
            <text x={0} y={rowH / 2 + 4} className="tc-row-label">{row.label}</text>
            {row.values.map((v, i) => (
              <rect key={i} x={x(i)} y={0} width={cw + 0.4} height={rowH} fill={v === null ? "transparent" : rampColor(ramp, v, range)} onMouseEnter={() => setHover({ i, row: r })} />
            ))}
          </g>
        ))}
        {obsEnd >= 0 && obsEnd < years.length - 1 && <line x1={x(obsEnd + 1)} x2={x(obsEnd + 1)} y1={-2} y2={H - 16} className="tc-now" />}
        {hover && <rect x={x(hover.i)} y={hover.row * (rowH + 6)} width={Math.max(cw, 2)} height={rowH} className="tc-hover" />}
        <YearAxis years={years} x={x} y={H - 2} />
      </svg>
      <div className="tc-readout">
        {hover && hv !== null && hv !== undefined
          ? <><strong>{years[hover.i]}</strong> · {rows[hover.row].label} · {signed(hv, unit)}</>
          : <span className="muted">Survolez une bande pour lire l'année</span>}
      </div>
    </div>
  );
}

export function SeasonalGrid({ years, monthly, seasons, ramp, range, unit, lastObs }: { years: number[]; monthly: Map<number, Series>; seasons?: Map<number, Series>; ramp: string[]; range: number; unit: string; lastObs: number }) {
  const [hover, setHover] = useState<{ i: number; row: number; model: boolean } | null>(null);
  const W = 1000;
  const labelW = 48;
  const cellH = 14;
  const gap = seasons ? 14 : 0;
  const H = 12 * cellH + (seasons ? gap + 4 * cellH : 0) + 18;
  const cw = (W - labelW - 18) / years.length;
  const x = (i: number) => labelW + i * cw;
  const modelTop = 12 * cellH + gap;
  let value: number | null = null;
  if (hover) value = (hover.model ? seasons?.get(years[hover.i])?.[hover.row] : hover.i <= years.indexOf(lastObs) ? monthly.get(years[hover.i])?.[hover.row] : null) ?? null;
  return (
    <div className="tc-chart">
      <svg viewBox={`0 0 ${W} ${H}`} onMouseLeave={() => setHover(null)} role="img" aria-label="Bandes saisonnières">
        {MONTHS_SHORT.map((m, row) => (
          <g key={m}>
            <text x={0} y={row * cellH + cellH - 3} className="tc-row-label small">{m}</text>
            {years.map((yr, i) => {
              const v = yr <= lastObs ? monthly.get(yr)?.[row] ?? null : null;
              return v === null ? null : <rect key={yr} x={x(i)} y={row * cellH} width={cw + 0.4} height={cellH + 0.3} fill={rampColor(ramp, v, range)} onMouseEnter={() => setHover({ i, row, model: false })} />;
            })}
          </g>
        ))}
        {seasons && SEASONS_SHORT.map((s, row) => (
          <g key={s}>
            <text x={0} y={modelTop + row * cellH + cellH - 3} className="tc-row-label small">{s}</text>
            {years.map((yr, i) => {
              const v = seasons.get(yr)?.[row] ?? null;
              return v === null ? null : <rect key={yr} x={x(i)} y={modelTop + row * cellH} width={cw + 0.4} height={cellH + 0.3} fill={rampColor(ramp, v, range)} onMouseEnter={() => setHover({ i, row, model: true })} />;
            })}
          </g>
        ))}
        {hover && <rect x={x(hover.i)} y={hover.model ? modelTop + hover.row * cellH : hover.row * cellH} width={Math.max(cw, 2)} height={cellH} className="tc-hover" />}
        <YearAxis years={years} x={x} y={H - 2} />
      </svg>
      <div className="tc-readout">
        {hover && value !== null
          ? <><strong>{hover.model ? `${SEASONS_SHORT[hover.row]} ${years[hover.i]}` : `${MONTHS_SHORT[hover.row]} ${years[hover.i]}`}</strong> · {hover.model ? "modèles CMIP6" : "observé"} · {signed(value, unit)}</>
          : <span className="muted">{seasons ? "Haut : 12 mois observés (CRU). Bas : 4 saisons des modèles CMIP6." : "Une ligne par mois, une colonne par année."}</span>}
      </div>
    </div>
  );
}
