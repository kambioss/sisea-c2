// Climate trends of a zone, as in the main géoportail's Results panel
// (apps/frontend/src/data/climateStripes.ts): annual stripes observed vs
// CMIP6 models, monthly/seasonal stripes, annual evolution with the four SSPs,
// and the annual tables behind the animated map. Same files, same maths:
// public/data/zones/<ISO3>.json and public/data/annual/<var>.json are copies
// written by scripts/build_c2_indicators.py.

export type TempVariable = "tmp" | "tmx" | "tmn";
export type SpiVariable = "spi1" | "spi3" | "spi12";
export type TrendVariable = TempVariable | SpiVariable;
export type Ssp = "ssp126" | "ssp245" | "ssp370" | "ssp585";
type Series = Array<number | null>;

interface ZoneFile {
  zone: string;
  temp: { start: string; tmx: Series; tmn: Series; tmp: Series; stn: Record<TempVariable, Series> };
  spi: { start: string; spi1: Series; spi3: Series; spi12: Series };
  proj?: { start: number; hist_start?: number } & Partial<Record<TempVariable, Partial<Record<Ssp | "historical", Series>>>>;
}

export const TREND_VARIABLES: Array<{ id: TrendVariable; label: string; name: string }> = [
  { id: "tmp", label: "Tmoy", name: "Température moyenne" },
  { id: "tmx", label: "Tmax", name: "Température maximale" },
  { id: "tmn", label: "Tmin", name: "Température minimale" },
  { id: "spi1", label: "SPI-1", name: "SPI-1" },
  { id: "spi3", label: "SPI-3", name: "SPI-3" },
  { id: "spi12", label: "SPI-12", name: "SPI-12" },
];

// IPCC AR6 scenario colours (WGI Annex, visual style guide).
export const SSPS: Array<{ id: Ssp; label: string; color: string }> = [
  { id: "ssp126", label: "SSP1-2.6", color: "#173c66" },
  { id: "ssp245", label: "SSP2-4.5", color: "#f79420" },
  { id: "ssp370", label: "SSP3-7.0", color: "#e71d25" },
  { id: "ssp585", label: "SSP5-8.5", color: "#951b1e" },
];

export const MONTHS_SHORT = ["Janv.", "Févr.", "Mars", "Avr.", "Mai", "Juin", "Juil.", "Août", "Sept.", "Oct.", "Nov.", "Déc."];
export const SEASONS_SHORT = ["DJF", "MAM", "JJA", "SON"];

// Diverging ramps with a neutral midpoint: cold → warm (RdBu), dry → wet (BrBG).
export const ANOMALY_RAMP = ["#08306b", "#2171b5", "#6baed6", "#c6dbef", "#f2f2f2", "#fcbba1", "#fb6a4a", "#cb181d", "#67000d"];
export const SPI_RAMP = ["#543005", "#8c510a", "#bf812d", "#dfc27d", "#f2f2f2", "#80cdc1", "#35978f", "#01665e", "#003c30"];
export const RANGE_T = 4;
export const RANGE_SPI = 2;

export function isTemperature(variable: TrendVariable): variable is TempVariable {
  return variable === "tmp" || variable === "tmx" || variable === "tmn";
}

export function rampFor(variable: TrendVariable): { ramp: string[]; range: number } {
  return isTemperature(variable) ? { ramp: ANOMALY_RAMP, range: RANGE_T } : { ramp: SPI_RAMP, range: RANGE_SPI };
}

function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function rampColor(ramp: string[], value: number, range: number): string {
  const t = Math.min(1, Math.max(0, (value + range) / (2 * range))) * (ramp.length - 1);
  const i = Math.min(ramp.length - 2, Math.floor(t));
  const f = t - i;
  const [a, b] = [hexToRgb(ramp[i]), hexToRgb(ramp[i + 1])];
  return `rgb(${a.map((c, k) => Math.round(c + (b[k] - c) * f)).join(",")})`;
}

function average(values: Array<number | null | undefined>): number | null {
  const ok = values.filter((v): v is number => v !== null && v !== undefined && Number.isFinite(v));
  return ok.length ? ok.reduce((s, v) => s + v, 0) / ok.length : null;
}

function byYear(series: Series, first: number): Map<number, Series> {
  const out = new Map<number, Series>();
  for (let i = 0; i < series.length; i += 12) out.set(first + i / 12, series.slice(i, i + 12));
  return out;
}

const r2 = (v: number | null) => (v === null ? null : Math.round(v * 100) / 100);

// CMIP6 historical run then the SSP, seasonal (DJF, MAM, JJA, SON), as
// anomalies against the models' own 1961-1990 mean (IPCC Interactive Atlas).
function modelSeasons(proj: ZoneFile["proj"], variable: TempVariable, ssp: Ssp): Map<number, Series> {
  const hist = proj?.[variable]?.historical;
  const future = proj?.[variable]?.[ssp];
  if (!proj?.hist_start || !hist || !future) return new Map();
  const changes = new Map<number, Series>();
  const add = (series: Series, first: number) => {
    for (let i = 0; i + 4 <= series.length; i += 4) changes.set(first + i / 4, series.slice(i, i + 4));
  };
  add(hist, proj.hist_start);
  add(future, proj.start);
  const base = [0, 1, 2, 3].map((s) => average(Array.from({ length: 30 }, (_, k) => changes.get(1961 + k)?.[s])));
  return new Map([...changes].map(([y, v]) => [y, v.map((x, s) => (x === null || base[s] === null ? null : r2(x - base[s]!)))]));
}

export interface TrendData {
  variable: TrendVariable;
  name: string;
  unit: string;
  // Year axis of every chart (observed, then models up to 2100 for temperature).
  years: number[];
  lastObs: number;
  observed: Series; // annual, aligned on `years`
  monthly: Map<number, Series>; // year -> 12 monthly anomalies (or SPI)
  models: Array<{ id: Ssp; label: string; color: string; annual: Series; seasons: Map<number, Series> }>;
  stats: Array<{ label: string; value: string; note: string }>;
  note: string;
}

const zoneCache = new Map<string, Promise<ZoneFile | null>>();

function loadZone(code: string): Promise<ZoneFile | null> {
  if (!zoneCache.has(code)) {
    // A level-1 region ("AGO.1_1") is read from its country's pack.
    const region = code.includes(".");
    const url = region ? `/data/zones/regions/${code.split(".")[0]}.json` : `/data/zones/${code}.json`;
    zoneCache.set(code, fetch(url)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => (region ? ((data as Record<string, ZoneFile> | null)?.[code] ?? null) : (data as ZoneFile | null)))
      .catch(() => null));
  }
  return zoneCache.get(code)!;
}

function signed(value: number | null, unit: string, digits = 1): string {
  if (value === null) return "—";
  const text = Math.abs(value).toLocaleString("fr-FR", { minimumFractionDigits: digits, maximumFractionDigits: digits });
  return `${value > 0 ? "+" : value < 0 ? "−" : ""}${text}${unit ? ` ${unit}` : ""}`;
}

export async function loadTrend(code: string, variable: TrendVariable): Promise<TrendData | null> {
  const data = await loadZone(code);
  if (!data) return null;
  const name = TREND_VARIABLES.find((v) => v.id === variable)!.name;

  if (!isTemperature(variable)) {
    const first = Number(data.spi.start.slice(0, 4));
    const series = data.spi[variable];
    const monthly = byYear(series, first);
    const lastIndex = series.reduce<number>((last, v, i) => (v !== null ? i : last), -1);
    if (lastIndex < 0) return null;
    const lastObs = first + Math.floor(lastIndex / 12);
    const years = [...monthly.keys()].filter((y) => y <= lastObs);
    const observed = years.map((y) => r2(average(monthly.get(y) ?? [])));
    const last12 = series.slice(Math.max(0, lastIndex - 11), lastIndex + 1);
    const ranked = years.map((y, i) => ({ y, v: observed[i] })).filter((x): x is { y: number; v: number } => x.v !== null).sort((a, b) => a.v - b.v);
    const stats = [
      { label: `${name} du dernier mois`, value: signed(series[lastIndex], "", 2), note: `${MONTHS_SHORT[lastIndex % 12]} ${lastObs} · CHIRPS, référence 1991-2020` },
      { label: "Mois secs sur 12", value: `${last12.filter((v) => v !== null && v <= -1).length} / ${last12.filter((v) => v !== null).length}`, note: "SPI ≤ −1 sur les 12 derniers mois évaluables" },
      ...(ranked.length ? [{ label: "Année la plus sèche", value: String(ranked[0].y), note: `${name} moyen ${signed(ranked[0].v, "", 2)}` }] : []),
      ...(ranked.length ? [{ label: "Année la plus humide", value: String(ranked[ranked.length - 1].y), note: `${name} moyen ${signed(ranked[ranked.length - 1].v, "", 2)}` }] : []),
    ];
    return {
      variable, name, unit: "", years, lastObs, observed, monthly, models: [], stats,
      note: `${name} de la pluie moyenne de la zone (CHIRPS v2, méthode OMM, loi gamma ajustée sur 1991-2020) ; vide les mois de saison sèche où l'indice n'est pas défini.`,
    };
  }

  const first = Number(data.temp.start.slice(0, 4));
  const raw = byYear(data.temp[variable], first);
  const obsYears = [...raw.keys()].filter((y) => average(raw.get(y)!) !== null);
  const lastObs = Math.max(...obsYears);
  const base = average(Array.from({ length: 30 }, (_, k) => average(raw.get(1961 + k) ?? [])))!;
  const monthBase = Array.from({ length: 12 }, (_, m) => average(Array.from({ length: 30 }, (_, k) => raw.get(1961 + k)?.[m])));
  const monthly = new Map([...raw].map(([y, months]) => [y, months.map((v, m) => (v === null || monthBase[m] === null ? null : r2(v - monthBase[m]!)))]));
  const grids = SSPS.map((ssp) => ({ ...ssp, seasons: modelSeasons(data.proj, variable, ssp.id) })).filter((p) => p.seasons.size);
  const lastModel = grids.length ? Math.max(...grids[0].seasons.keys()) : lastObs;
  const years = Array.from({ length: Math.max(lastObs, lastModel) - first + 1 }, (_, k) => first + k);
  const observed = years.map((y) => (y <= lastObs ? r2((average(raw.get(y) ?? []) ?? NaN) - base) : null)).map((v) => (v === null || Number.isNaN(v) ? null : v));
  const models = grids.map((p) => ({
    ...p,
    annual: years.map((y) => {
      const s = p.seasons.get(y);
      return s && s.every((v) => v !== null) ? r2(average(s)) : null;
    }),
  }));
  const recent = average(observed.filter((_, i) => years[i] > lastObs - 10 && years[i] <= lastObs));
  const stats = [{ label: `${name}, ${lastObs - 9}-${lastObs}`, value: signed(recent, "°C"), note: `vs 1961-1990 (${base.toLocaleString("fr-FR", { maximumFractionDigits: 1 })} °C) · CRU TS 4.09` }];
  for (const p of models.filter((x) => x.id === "ssp245" || x.id === "ssp585")) {
    const end = average(p.annual.filter((_, i) => years[i] >= 2081 && years[i] <= 2100));
    stats.push({ label: `2081-2100, ${p.label}`, value: signed(end, "°C"), note: "vs 1961-1990 des modèles, médiane CMIP6" });
  }
  const coverage = average(data.temp.stn[variable].slice(-10));
  if (coverage !== null && coverage < 0.6) {
    stats.push({ label: "Couverture en stations", value: `${Math.round(coverage * 100)} %`, note: "Ailleurs CRU revient à la normale : bandes atténuées" });
  }
  return {
    variable, name, unit: "°C", years, lastObs, observed, monthly, models, stats,
    note: `CRU TS 4.09 (0,5°) moyenné sur la zone, ${first}-${lastObs} ; modèles CMIP6 (médiane d'ensemble, Banque mondiale CCKP), historique puis scénarios SSP, par saison, en écart à leur propre moyenne 1961-1990 : une série distincte de l'observé, comme dans l'Atlas interactif du GIEC.`,
  };
}

// ---------------------------------------------------------- animated map

export interface AnnualTable {
  var: TrendVariable;
  first: number;
  last_obs: number;
  proj_last?: number;
  zones: Record<string, Partial<Record<"obs" | Ssp, Series>>>;
}

const annualCache = new Map<TrendVariable, Promise<AnnualTable | null>>();

export function loadAnnual(variable: TrendVariable): Promise<AnnualTable | null> {
  if (!annualCache.has(variable)) {
    annualCache.set(variable, fetch(`/data/annual/${variable}.json`).then((r) => (r.ok ? (r.json() as Promise<AnnualTable>) : null)).catch(() => null));
  }
  return annualCache.get(variable)!;
}

export function annualValue(table: AnnualTable, code: string, year: number, ssp: Ssp): number | null {
  const zone = table.zones[code];
  if (!zone) return null;
  if (year <= table.last_obs) return zone.obs?.[year - table.first] ?? null;
  return zone[ssp]?.[year - table.last_obs - 1] ?? null;
}

export function annualLastYear(table: AnnualTable): number {
  return table.proj_last ?? table.last_obs;
}

export function formatAnnual(variable: TrendVariable, value: number | null): string {
  return isTemperature(variable) ? `${signed(value, "°C")} vs 1961-1990` : `SPI ${signed(value, "", 2)}`;
}
