// Indicator catalogue of Composante 2 (Climat & Alertes) and the loader of
// public/data/indicators.json, built from the main géoportail's precomputed
// climate series by scripts/build_c2_indicators.py (CRU TS 4.09, CHIRPS SPI,
// CMIP6 CCKP). Every value shown on the site comes from that file.

export type Theme = "climat" | "alertes" | "tendances";

export interface ZoneData {
  climate: { tmean_anom: number; tmax_anom: number; tmin_anom: number; tmean: number; year: number };
  trends: { warming_decade: number | null; spi12_decade: number | null; proj2050_ssp245: number | null; proj2050_ssp585: number | null };
  alerts: { spi1: number | null; spi3: number | null; spi12: number | null; spi_month: string | null; drought_level: AlertLevel };
  series: {
    tmean_anom: { start: number; values: Array<number | null> };
    spi12_year: { start: number; values: Array<number | null> };
    spi3_recent: { end: string | null; values: Array<number | null> };
    proj: Partial<Record<"ssp126" | "ssp245" | "ssp585", { start: number; values: Array<number | null> }>>;
  };
}

export interface Bundle {
  sources: Record<string, string>;
  zones: Record<string, ZoneData>;
}

export type AlertLevel = 0 | 1 | 2 | 3;

export const ALERT_LEVELS: Array<{ level: AlertLevel; label: string; short: string; color: string; range: string }> = [
  { level: 0, label: "Normal", short: "Normal", color: "#cfd8e3", range: "SPI-3 > −0,5" },
  { level: 1, label: "Vigilance", short: "Vigilance", color: "#f4c95d", range: "−1,0 < SPI-3 ≤ −0,5" },
  { level: 2, label: "Alerte", short: "Alerte", color: "#ee8a3c", range: "−1,5 < SPI-3 ≤ −1,0" },
  { level: 3, label: "Alerte maximale", short: "Maximale", color: "#d64545", range: "SPI-3 ≤ −1,5" },
];

type Scale =
  | { kind: "sequential"; breaks: number[]; colors: string[] }
  | { kind: "diverging"; breaks: number[]; colors: string[] }
  | { kind: "alert" };

export interface Indicator {
  id: string;
  theme: Theme;
  name: string;
  short: string;
  unit: string;
  source: string;
  frequency: string;
  description: string;
  howToRead: string;
  scale: Scale;
  value(zone: ZoneData): number | null;
  // Values of the slider domain on the géoportail.
  domain: [number, number];
  decimals: number;
}

// Lavender → indigo, the géoportail's signature ramp (warming magnitude).
const PURPLE = ["#ecebfb", "#cfccf4", "#aba6ea", "#8780db", "#6660c8", "#4a43a8", "#312b7d"];
// SPI: dry (brown/orange) ↔ wet (indigo), WMO classes.
const SPI_COLORS = ["#8c3b1f", "#d0703a", "#f2b880", "#eef0f4", "#a9b4ee", "#6c78d8", "#3c3f9e"];
const SPI_BREAKS = [-2, -1.5, -1, 1, 1.5, 2];

export const INDICATORS: Indicator[] = [
  {
    id: "tmean-anom",
    theme: "climat",
    name: "Anomalie de température moyenne",
    short: "Anomalie Tmoy",
    unit: "°C",
    source: "CRU TS 4.09 — University of East Anglia",
    frequency: "Annuelle (dernière année complète)",
    description: "Écart de la température moyenne annuelle de l'air à 2 m par rapport à la moyenne 1961-1990, pondérée par la surface sur les terres du pays.",
    howToRead: "Plus la teinte est foncée, plus l'année a été chaude par rapport au climat de référence.",
    scale: { kind: "sequential", breaks: [0.25, 0.5, 0.75, 1, 1.25, 1.5], colors: PURPLE },
    value: (z) => z.climate.tmean_anom,
    domain: [-0.5, 2.5],
    decimals: 2,
  },
  {
    id: "tmax-anom",
    theme: "climat",
    name: "Anomalie de température maximale",
    short: "Anomalie Tmax",
    unit: "°C",
    source: "CRU TS 4.09 — University of East Anglia",
    frequency: "Annuelle",
    description: "Écart de la moyenne annuelle des températures maximales journalières par rapport à 1961-1990. Indicateur proxy du stress thermique diurne.",
    howToRead: "Les teintes foncées signalent des journées nettement plus chaudes que la normale.",
    scale: { kind: "sequential", breaks: [0.25, 0.5, 0.75, 1, 1.25, 1.5], colors: PURPLE },
    value: (z) => z.climate.tmax_anom,
    domain: [-0.5, 2.5],
    decimals: 2,
  },
  {
    id: "tmin-anom",
    theme: "climat",
    name: "Anomalie de température minimale",
    short: "Anomalie Tmin",
    unit: "°C",
    source: "CRU TS 4.09 — University of East Anglia",
    frequency: "Annuelle",
    description: "Écart de la moyenne annuelle des températures minimales (nuits) par rapport à 1961-1990.",
    howToRead: "Des nuits plus chaudes réduisent la récupération physiologique des populations et des cultures.",
    scale: { kind: "sequential", breaks: [0.25, 0.5, 0.75, 1, 1.25, 1.5], colors: PURPLE },
    value: (z) => z.climate.tmin_anom,
    domain: [-0.5, 2.5],
    decimals: 2,
  },
  {
    id: "spi12",
    theme: "climat",
    name: "Indice de précipitations standardisé — 12 mois",
    short: "SPI-12",
    unit: "σ",
    source: "CHIRPS v2 — Climate Hazards Center, UCSB",
    frequency: "Mensuelle",
    description: "Cumul de pluie des 12 derniers mois exprimé en écarts-types par rapport à la distribution 1991-2020 (méthode OMM, loi gamma).",
    howToRead: "Valeurs négatives (brun) : déficit pluviométrique durable. Valeurs positives (indigo) : excédent.",
    scale: { kind: "diverging", breaks: SPI_BREAKS, colors: SPI_COLORS },
    value: (z) => z.alerts.spi12,
    domain: [-3, 3],
    decimals: 2,
  },
  {
    id: "drought-alert",
    theme: "alertes",
    name: "Niveau d'alerte sécheresse",
    short: "Alerte sécheresse",
    unit: "niveau",
    source: "Dérivé du SPI-3 CHIRPS — seuils OMM",
    frequency: "Mensuelle",
    description: "Niveau d'alerte précoce dérivé du SPI-3 du dernier mois disponible : vigilance, alerte ou alerte maximale selon les classes de sécheresse de l'OMM.",
    howToRead: "Jaune : vigilance ; orange : alerte ; rouge : alerte maximale. En saison sèche, de faibles cumuls peuvent amplifier le signal.",
    scale: { kind: "alert" },
    value: (z) => z.alerts.drought_level,
    domain: [0, 3],
    decimals: 0,
  },
  {
    id: "spi3",
    theme: "alertes",
    name: "Indice de précipitations standardisé — 3 mois",
    short: "SPI-3",
    unit: "σ",
    source: "CHIRPS v2 — Climate Hazards Center, UCSB",
    frequency: "Mensuelle",
    description: "Anomalie standardisée du cumul de pluie sur 3 mois, sensible aux sécheresses agricoles saisonnières.",
    howToRead: "Sous −1 : sécheresse modérée ; sous −1,5 : sévère ; sous −2 : extrême.",
    scale: { kind: "diverging", breaks: SPI_BREAKS, colors: SPI_COLORS },
    value: (z) => z.alerts.spi3,
    domain: [-3, 3],
    decimals: 2,
  },
  {
    id: "spi1",
    theme: "alertes",
    name: "Indice de précipitations standardisé — 1 mois",
    short: "SPI-1",
    unit: "σ",
    source: "CHIRPS v2 — Climate Hazards Center, UCSB",
    frequency: "Mensuelle",
    description: "Anomalie standardisée du cumul de pluie du dernier mois : signal le plus réactif, utile pour détecter un démarrage tardif de saison.",
    howToRead: "Indicateur volatil : à lire avec le SPI-3 avant de déclencher une alerte.",
    scale: { kind: "diverging", breaks: SPI_BREAKS, colors: SPI_COLORS },
    value: (z) => z.alerts.spi1,
    domain: [-3, 3],
    decimals: 2,
  },
  {
    id: "warming-trend",
    theme: "tendances",
    name: "Tendance de réchauffement 1981-2024",
    short: "Réchauffement",
    unit: "°C/déc.",
    source: "CRU TS 4.09 — régression linéaire",
    frequency: "Mise à jour annuelle",
    description: "Pente de la régression linéaire des températures moyennes annuelles depuis 1981, exprimée en degrés par décennie.",
    howToRead: "À 0,3 °C/décennie, un pays gagne environ 1,3 °C en 45 ans.",
    scale: { kind: "sequential", breaks: [0.12, 0.16, 0.2, 0.24, 0.28, 0.32], colors: PURPLE },
    value: (z) => z.trends.warming_decade,
    domain: [0, 0.5],
    decimals: 3,
  },
  {
    id: "spi12-trend",
    theme: "tendances",
    name: "Tendance pluviométrique (SPI-12)",
    short: "Tendance pluie",
    unit: "σ/déc.",
    source: "CHIRPS v2 — régression linéaire",
    frequency: "Mise à jour mensuelle",
    description: "Pente décennale de la moyenne annuelle du SPI-12 depuis 1981 : tendance à l'assèchement (négatif) ou à l'humidification (positif).",
    howToRead: "Les teintes brunes indiquent un assèchement progressif sur quatre décennies.",
    scale: { kind: "diverging", breaks: [-0.4, -0.25, -0.1, 0.1, 0.25, 0.4], colors: SPI_COLORS },
    value: (z) => z.trends.spi12_decade,
    domain: [-1, 1],
    decimals: 2,
  },
  {
    id: "proj-ssp245",
    theme: "tendances",
    name: "Réchauffement projeté 2041-2060 — SSP2-4.5",
    short: "Projection SSP2-4.5",
    unit: "°C",
    source: "CMIP6 — Banque mondiale CCKP (médiane d'ensemble)",
    frequency: "Scénario",
    description: "Changement de température moyenne annuelle projeté pour 2041-2060 par rapport à 1995-2014, scénario intermédiaire SSP2-4.5.",
    howToRead: "Le changement s'ajoute au réchauffement déjà observé depuis 1961-1990.",
    scale: { kind: "sequential", breaks: [1.1, 1.3, 1.5, 1.7, 1.9, 2.1], colors: PURPLE },
    value: (z) => z.trends.proj2050_ssp245,
    domain: [0.5, 3],
    decimals: 2,
  },
  {
    id: "proj-ssp585",
    theme: "tendances",
    name: "Réchauffement projeté 2041-2060 — SSP5-8.5",
    short: "Projection SSP5-8.5",
    unit: "°C",
    source: "CMIP6 — Banque mondiale CCKP (médiane d'ensemble)",
    frequency: "Scénario",
    description: "Changement de température projeté pour 2041-2060 par rapport à 1995-2014 dans le scénario à fortes émissions SSP5-8.5.",
    howToRead: "Borne haute plausible pour la planification de l'adaptation.",
    scale: { kind: "sequential", breaks: [1.5, 1.7, 1.9, 2.1, 2.3, 2.5], colors: PURPLE },
    value: (z) => z.trends.proj2050_ssp585,
    domain: [0.5, 3.5],
    decimals: 2,
  },
];

export const THEMES: Array<{ id: Theme; label: string; tagline: string }> = [
  { id: "climat", label: "Climat", tagline: "Températures et pluies observées" },
  { id: "alertes", label: "Alertes", tagline: "Sécheresse et signaux précoces" },
  { id: "tendances", label: "Tendances", tagline: "Évolutions et projections" },
];

export function indicatorById(id: string | null | undefined): Indicator {
  return INDICATORS.find((indicator) => indicator.id === id) ?? INDICATORS[0];
}

export function colorFor(indicator: Indicator, value: number | null): string {
  if (value === null || Number.isNaN(value)) return "#e6e9ef";
  const scale = indicator.scale;
  if (scale.kind === "alert") return ALERT_LEVELS[value as AlertLevel]?.color ?? "#e6e9ef";
  const index = scale.breaks.findIndex((limit) => value < limit);
  return scale.colors[index === -1 ? scale.colors.length - 1 : index];
}

export function legendFor(indicator: Indicator): Array<{ color: string; label: string }> {
  const scale = indicator.scale;
  if (scale.kind === "alert") return ALERT_LEVELS.map((level) => ({ color: level.color, label: level.label }));
  const f = (n: number) => fmt(n, Math.min(indicator.decimals, 2));
  return scale.colors.map((color, i) => {
    if (i === 0) return { color, label: `< ${f(scale.breaks[0])}` };
    if (i === scale.colors.length - 1) return { color, label: `≥ ${f(scale.breaks[i - 1])}` };
    return { color, label: `${f(scale.breaks[i - 1])} – ${f(scale.breaks[i])}` };
  });
}

export function fmt(value: number | null | undefined, decimals = 2, signed = false): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  const text = value.toLocaleString("fr-FR", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
  return signed && value > 0 ? `+${text}` : text;
}

export function formatValue(indicator: Indicator, value: number | null): string {
  if (indicator.scale.kind === "alert") return value === null ? "—" : ALERT_LEVELS[value as AlertLevel].label;
  const signed = indicator.unit !== "niveau";
  return `${fmt(value, Math.min(indicator.decimals, 2), signed)} ${indicator.unit}`;
}

export function monthLabel(iso: string | null): string {
  if (!iso) return "—";
  const [year, month] = iso.split("-").map(Number);
  return new Date(year, month - 1, 1).toLocaleDateString("fr-FR", { month: "long", year: "numeric" });
}

// Level-1 regions (public/data/indicators-regions.json): same indicators,
// with only the annual stripes and the recent SPI-3 as series.
export interface RegionZone extends ZoneData {
  name: string;
  iso3: string;
  bbox: [number, number, number, number] | null;
}

let regionPromise: Promise<Record<string, RegionZone>> | null = null;

export function loadRegionBundle(): Promise<Record<string, RegionZone>> {
  regionPromise ??= fetch("/data/indicators-regions.json").then((response) => {
    if (!response.ok) throw new Error(`indicators-regions.json: HTTP ${response.status}`);
    return (response.json() as Promise<{ zones: Record<string, RegionZone> }>).then((data) => data.zones);
  });
  return regionPromise;
}

let bundlePromise: Promise<Bundle> | null = null;

export function loadBundle(): Promise<Bundle> {
  bundlePromise ??= fetch("/data/indicators.json").then((response) => {
    if (!response.ok) throw new Error(`indicators.json: HTTP ${response.status}`);
    return response.json() as Promise<Bundle>;
  });
  return bundlePromise;
}
