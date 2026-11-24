import { useState } from "react";

/**
 * Carte SVG stylisée de l'Afrique de l'Ouest & Sahel.
 * Coordonnées approximatives (viewBox 0 0 1000 700) — non géographiquement
 * exactes mais reconnaissables. Chaque pays est un path coloré selon son
 * niveau d'alerte, avec tooltip au survol.
 */

export type CountryShape = {
  code: string;
  name: string;
  d: string; // SVG path
  labelX: number;
  labelY: number;
};

// Simplified country shapes for West Africa & Sahel
// (approximate, not geographically exact — for visualization purposes)
const COUNTRIES: CountryShape[] = [
  {
    code: "MR",
    name: "Mauritanie",
    d: "M 90,150 L 280,140 L 290,230 L 260,280 L 180,300 L 130,290 L 95,250 L 80,190 Z",
    labelX: 180, labelY: 220,
  },
  {
    code: "ML",
    name: "Mali",
    d: "M 290,140 L 540,135 L 555,260 L 470,280 L 380,300 L 290,280 L 290,230 Z",
    labelX: 410, labelY: 215,
  },
  {
    code: "NE",
    name: "Niger",
    d: "M 540,135 L 720,140 L 740,240 L 700,290 L 600,290 L 555,260 L 540,140 Z",
    labelX: 635, labelY: 215,
  },
  {
    code: "TD",
    name: "Tchad",
    d: "M 720,140 L 870,150 L 890,290 L 840,340 L 760,330 L 740,240 L 720,140 Z",
    labelX: 805, labelY: 235,
  },
  {
    code: "SN",
    name: "Sénégal",
    d: "M 95,250 L 180,300 L 200,340 L 175,370 L 130,365 L 100,335 L 90,290 Z",
    labelX: 145, labelY: 325,
  },
  {
    code: "GM",
    name: "Gambie",
    d: "M 145,365 L 200,365 L 200,378 L 145,378 Z",
    labelX: 172, labelY: 372,
  },
  {
    code: "GN",
    name: "Guinée",
    d: "M 175,370 L 270,365 L 285,395 L 265,425 L 215,425 L 175,400 Z",
    labelX: 230, labelY: 395,
  },
  {
    code: "SL",
    name: "Sierra Leone",
    d: "M 175,400 L 215,425 L 205,455 L 175,455 L 165,425 Z",
    labelX: 188, labelY: 435,
  },
  {
    code: "LR",
    name: "Liberia",
    d: "M 205,455 L 285,455 L 285,485 L 215,490 L 205,475 Z",
    labelX: 245, labelY: 475,
  },
  {
    code: "CI",
    name: "Côte d'Ivoire",
    d: "M 265,425 L 380,420 L 390,470 L 360,500 L 290,500 L 285,485 L 285,455 L 215,425 Z",
    labelX: 325, labelY: 460,
  },
  {
    code: "BF",
    name: "Burkina Faso",
    d: "M 380,300 L 555,300 L 545,360 L 460,370 L 380,360 L 380,300 Z",
    labelX: 465, labelY: 335,
  },
  {
    code: "GH",
    name: "Ghana",
    d: "M 390,420 L 460,420 L 460,500 L 395,500 L 390,470 Z",
    labelX: 425, labelY: 460,
  },
  {
    code: "TG",
    name: "Togo",
    d: "M 460,420 L 485,420 L 485,500 L 460,500 Z",
    labelX: 472, labelY: 460,
  },
  {
    code: "BJ",
    name: "Bénin",
    d: "M 485,420 L 530,420 L 540,490 L 485,500 Z",
    labelX: 510, labelY: 460,
  },
  {
    code: "CV",
    name: "Cap-Vert",
    d: "M 50,360 L 80,355 L 82,385 L 50,390 Z",
    labelX: 65, labelY: 372,
  },
];

const LEVEL_COLORS = {
  1: "#5fa371", // sage green — Normal
  2: "#c9a86a", // sand — Veille
  3: "#d4a24c", // ochre — Alerte
  4: "#9c2f1c", // rust — Sévère
};

const LEVEL_LABELS = {
  1: "Normal",
  2: "Veille",
  3: "Alerte",
  4: "Alerte sévère",
};

export function WestAfricaMap({
  alerts,
  selected,
  onSelect,
}: {
  alerts: { code: string; name: string; spi3: number; level: number; since: string }[];
  selected?: string;
  onSelect?: (code: string) => void;
}) {
  const [hovered, setHovered] = useState<string | null>(null);

  const alertByCode = new Map(alerts.map((a) => [a.code, a]));

  return (
    <div className="wa-map-wrap">
      <svg viewBox="0 0 950 540" className="wa-map" preserveAspectRatio="xMidYMid meet">
        <defs>
          <radialGradient id="sea-grad" cx="50%" cy="50%" r="70%">
            <stop offset="0%" stopColor="#1f3a26" stopOpacity="0.06" />
            <stop offset="100%" stopColor="#1f3a26" stopOpacity="0.18" />
          </radialGradient>
          <filter id="country-shadow" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="1.5" stdDeviation="1.5" floodColor="#1a201a" floodOpacity="0.25" />
          </filter>
        </defs>

        {/* Sea background */}
        <rect width="950" height="540" fill="url(#sea-grad)" />

        {/* Grid lines (latitude/longitude suggestion) */}
        <g stroke="rgba(31, 58, 38, 0.06)" strokeWidth="0.5">
          {[100, 200, 300, 400, 500].map((y) => (
            <line key={y} x1="0" y1={y} x2="950" y2={y} />
          ))}
          {[100, 200, 300, 400, 500, 600, 700, 800].map((x) => (
            <line key={x} x1={x} y1="0" x2={x} y2="540" />
          ))}
        </g>

        {/* Countries */}
        {COUNTRIES.map((c) => {
          const alert = alertByCode.get(c.code);
          const level = alert?.level ?? 1;
          const color = LEVEL_COLORS[level as 1 | 2 | 3 | 4];
          const isSelected = selected === c.code;
          const isHovered = hovered === c.code;
          // Show full name only for priority countries (level >= 3) and large countries
          const showName = level >= 3 || ["ML", "NE", "TD", "BF"].includes(c.code);

          return (
            <g
              key={c.code}
              className={`wa-country ${isSelected ? "selected" : ""} ${isHovered ? "hovered" : ""}`}
              onMouseEnter={() => setHovered(c.code)}
              onMouseLeave={() => setHovered(null)}
              onClick={() => onSelect?.(c.code)}
              style={{ cursor: onSelect ? "pointer" : "default" }}
            >
              <path
                d={c.d}
                fill={color}
                stroke="#1f3a26"
                strokeWidth={isSelected ? 2.5 : 1}
                filter="url(#country-shadow)"
                opacity={isHovered || isSelected ? 1 : 0.88}
              />
              <text
                x={c.labelX}
                y={c.labelY}
                textAnchor="middle"
                fontFamily="JetBrains Mono, monospace"
                fontSize="13"
                fontWeight="700"
                fill={level >= 3 ? "#fff" : "#1a201a"}
                style={{ pointerEvents: "none" }}
              >
                {c.code}
              </text>
              {showName && (
                <text
                  x={c.labelX}
                  y={c.labelY + 14}
                  textAnchor="middle"
                  fontFamily="Inter, sans-serif"
                  fontSize="9"
                  fontWeight="500"
                  fill={level >= 3 ? "rgba(255,255,255,0.85)" : "rgba(26,32,26,0.6)"}
                  style={{ pointerEvents: "none" }}
                >
                  {c.name.length > 12 ? c.name.slice(0, 11) + "…" : c.name}
                </text>
              )}
            </g>
          );
        })}

        {/* Hovered country tooltip */}
        {hovered && (() => {
          const c = COUNTRIES.find((c) => c.code === hovered)!;
          const alert = alertByCode.get(hovered);
          if (!alert) return null;
          const level = alert.level;
          const color = LEVEL_COLORS[level as 1 | 2 | 3 | 4];
          return (
            <g style={{ pointerEvents: "none" }}>
              <rect
                x={c.labelX - 70}
                y={c.labelY - 65}
                width="140"
                height="48"
                fill="#1f3a26"
                opacity="0.95"
                rx="4"
              />
              <text x={c.labelX} y={c.labelY - 48} textAnchor="middle" fontFamily="Inter" fontWeight="600" fontSize="12" fill="#fff">
                {c.name}
              </text>
              <circle cx={c.labelX - 50} cy={c.labelY - 30} r="4" fill={color} />
              <text x={c.labelX - 38} y={c.labelY - 26} fontFamily="JetBrains Mono" fontSize="11" fill="#e8efe8">
                SPI-3 : {alert.spi3.toFixed(2)}
              </text>
              <text x={c.labelX + 22} y={c.labelY - 26} fontFamily="JetBrains Mono" fontSize="10" fill={color}>
                {LEVEL_LABELS[level as 1 | 2 | 3 | 4]}
              </text>
            </g>
          );
        })()}
      </svg>

      {/* Legend */}
      <div className="wa-legend">
        {([1, 2, 3, 4] as const).map((lvl) => (
          <div key={lvl} className="wa-legend-item">
            <i style={{ background: LEVEL_COLORS[lvl] }} />
            <span>
              <strong>{LEVEL_LABELS[lvl]}</strong>
              <small>Niveau {lvl}</small>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export { LEVEL_COLORS, LEVEL_LABELS, COUNTRIES as WA_COUNTRIES };
