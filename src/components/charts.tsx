/**
 * Mini SVG chart library — pas de dépendance externe.
 * Les couleurs viennent du design system (CSS vars → valeurs en dur ici).
 */

const C = {
  clay: "#c75b39",
  ochre: "#d4a24c",
  rust: "#9c2f1c",
  sage: "#6b8a5a",
  jade: "#3a6b5e",
  sand: "#c9a86a",
  ink: "#1f2a22",
  ink2: "#3d4a3e",
  muted: "#6f6650",
  line: "#d8cdb5",
};

/* ---------- Sparkline ---------- */
export function Sparkline({
  data,
  color = C.clay,
  width = 110,
  height = 28,
  area = true,
}: {
  data: number[];
  color?: string;
  width?: number;
  height?: number;
  area?: boolean;
}) {
  if (!data.length) return null;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const pad = 2;
  const step = (width - pad * 2) / (data.length - 1 || 1);
  const pts = data.map((v, i) => {
    const x = pad + i * step;
    const y = pad + (height - pad * 2) * (1 - (v - min) / range);
    return [x, y] as const;
  });
  const path = pts.map((p, i) => `${i === 0 ? "M" : "L"} ${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(" ");
  const areaPath = `${path} L ${pts[pts.length - 1][0]} ${height} L ${pts[0][0]} ${height} Z`;
  const id = `sg-${Math.random().toString(36).slice(2, 9)}`;
  return (
    <svg className="spark" width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.4" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      {area && <path className="area" d={areaPath} fill={`url(#${id})`} />}
      <path d={path} fill="none" stroke={color} strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

/* ---------- Line chart (multi-series, used on trends page) ---------- */
export function LineChart({
  series,
  width = 600,
  height = 240,
  yMin,
  yMax,
  xLabels,
}: {
  series: { name: string; color: string; dashed?: boolean; data: number[] }[];
  width?: number;
  height?: number;
  yMin?: number;
  yMax?: number;
  xLabels?: string[];
}) {
  const all = series.flatMap((s) => s.data);
  const min = yMin ?? Math.min(...all);
  const max = yMax ?? Math.max(...all);
  const range = max - min || 1;
  const padL = 40;
  const padR = 12;
  const padT = 12;
  const padB = 24;
  const innerW = width - padL - padR;
  const innerH = height - padT - padB;
  const n = series[0]?.data.length ?? 0;
  const step = innerW / (n - 1 || 1);

  const ticks = 4;
  const yTicks = Array.from({ length: ticks + 1 }, (_, i) => min + (range * i) / ticks);

  return (
    <svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="xMidYMid meet">
      {/* Grid */}
      {yTicks.map((t, i) => {
        const y = padT + innerH * (1 - (t - min) / range);
        return (
          <g key={i}>
            <line x1={padL} y1={y} x2={width - padR} y2={y} stroke={C.line} strokeWidth="0.5" />
            <text x={padL - 6} y={y + 3} textAnchor="end" fontSize="9" fontFamily="JetBrains Mono" fill={C.muted}>
              {t.toFixed(1)}
            </text>
          </g>
        );
      })}
      {/* Zero line */}
      {min < 0 && max > 0 && (
        <line
          x1={padL}
          y1={padT + innerH * (1 - (0 - min) / range)}
          x2={width - padR}
          y2={padT + innerH * (1 - (0 - min) / range)}
          stroke={C.muted}
          strokeWidth="0.8"
          strokeDasharray="2 3"
        />
      )}
      {/* Series */}
      {series.map((s, si) => {
        const pts = s.data.map((v, i) => {
          const x = padL + i * step;
          const y = padT + innerH * (1 - (v - min) / range);
          return [x, y] as const;
        });
        const d = pts.map((p, i) => `${i === 0 ? "M" : "L"} ${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(" ");
        return (
          <g key={si}>
            <path
              d={d}
              fill="none"
              stroke={s.color}
              strokeWidth="2.5"
              strokeLinejoin="round"
              strokeLinecap="round"
              strokeDasharray={s.dashed ? "5 4" : undefined}
            />
            {/* Points on each value */}
            {pts.map((p, i) => (
              <circle
                key={i}
                cx={p[0]}
                cy={p[1]}
                r={i === pts.length - 1 ? 5 : 3.5}
                fill={s.color}
                stroke="#fff"
                strokeWidth="1.5"
              />
            ))}
          </g>
        );
      })}
      {/* X axis labels */}
      {(xLabels ?? []).map((lbl, i) => {
        const x = padL + (i * innerW) / ((xLabels?.length ?? 1) - 1 || 1);
        return (
          <text key={i} x={x} y={height - 6} textAnchor="middle" fontSize="9" fontFamily="JetBrains Mono" fill={C.muted}>
            {lbl}
          </text>
        );
      })}
    </svg>
  );
}

/* ---------- Bar chart (SPI bars, used on alerts / trends pages) ---------- */
export function BarChart({
  data,
  width = 600,
  height = 180,
  baseline = 0,
  colorNeg = C.rust,
  colorPos = C.sage,
  xLabels,
}: {
  data: number[];
  width?: number;
  height?: number;
  baseline?: number;
  colorNeg?: string;
  colorPos?: string;
  xLabels?: string[];
}) {
  const min = Math.min(...data, baseline);
  const max = Math.max(...data, baseline);
  const range = max - min || 1;
  const padL = 30;
  const padR = 12;
  const padT = 12;
  const padB = 24;
  const innerW = width - padL - padR;
  const innerH = height - padT - padB;
  const bw = innerW / data.length;
  const zeroY = padT + innerH * (1 - (baseline - min) / range);

  return (
    <svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="xMidYMid meet">
      <line x1={padL} y1={zeroY} x2={width - padR} y2={zeroY} stroke={C.muted} strokeWidth="0.8" />
      {data.map((v, i) => {
        const x = padL + i * bw + bw * 0.15;
        const w = bw * 0.7;
        const y = padT + innerH * (1 - (v - min) / range);
        const barH = Math.abs(zeroY - y);
        const yPos = v >= baseline ? y : zeroY;
        return (
          <rect
            key={i}
            x={x}
            y={yPos}
            width={w}
            height={barH}
            fill={v >= baseline ? colorPos : colorNeg}
            opacity={0.85}
          />
        );
      })}
      {(xLabels ?? []).map((lbl, i) => {
        const x = padL + i * bw + bw / 2;
        return (
          <text key={i} x={x} y={height - 6} textAnchor="middle" fontSize="9" fontFamily="JetBrains Mono" fill={C.muted}>
            {lbl}
          </text>
        );
      })}
    </svg>
  );
}

/* ---------- Climate stripes (Ed Hawkins style) ---------- */
export function ClimateStripes({
  data,
  width = 600,
  height = 56,
}: {
  data: number[]; // anomalies, °C
  width?: number;
  height?: number;
}) {
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = Math.max(Math.abs(min), Math.abs(max)) || 1;
  // Diverging palette: cold → blue/teal, hot → rust/red
  const colorFor = (v: number) => {
    const t = v / range; // -1..1
    if (t >= 0) {
      // 0 → sand, 1 → rust
      const lerp = (a: number[], b: number[], t: number) =>
        a.map((ai, i) => Math.round(ai + (b[i] - ai) * t));
      const rgb = lerp([201, 168, 106], [156, 47, 28], t);
      return `rgb(${rgb[0]}, ${rgb[1]}, ${rgb[2]})`;
    } else {
      const lerp = (a: number[], b: number[], t: number) =>
        a.map((ai, i) => Math.round(ai + (b[i] - ai) * t));
      const rgb = lerp([201, 168, 106], [58, 107, 94], -t);
      return `rgb(${rgb[0]}, ${rgb[1]}, ${rgb[2]})`;
    }
  };
  const bw = width / data.length;
  return (
    <svg className="stripes-svg" width="100%" height={height} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none">
      {data.map((v, i) => (
        <rect key={i} x={i * bw} y={0} width={bw + 0.5} height={height} fill={colorFor(v)} />
      ))}
    </svg>
  );
}
