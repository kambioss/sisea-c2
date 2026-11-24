export interface EdgarDataset {
  dataset_id: string;
  name: string;
  status: string;
  description: string;
  updated_at: string;
}

export interface EmissionSeriesPayload {
  source: "EDGAR" | "Climate TRACE" | "Climate Watch";
  release: string;
  territory: string;
  years: number[];
  sectors: Array<{ id: string; label: string; color?: string; values: number[] }>;
  per_capita?: number[];
  unit: string;
}

const API_ROOT = import.meta.env.VITE_CATALOG_API || "/catalog-api/api/v1";
const GEOSERVER_WFS = import.meta.env.VITE_GEOSERVER_WFS_URL || "/geoserver/geossia/wms";

const SECTOR_LABELS: Record<string, string> = {
  agriculture: "Agriculture",
  buildings: "Bâtiments",
  "fossil_fuel_operations": "Production de combustibles",
  "manufacturing": "Combustion industrielle",
  "power": "Industrie énergétique",
  "mineral_extraction": "Extraction minière",
  "transportation": "Transport",
  "waste": "Déchets",
  "forestry_and_land_use": "Forêts et usage des terres",
  energy: "Énergie",
  industrial_processes: "Procédés industriels",
};
const SECTOR_COLORS = ["#496fae", "#be3940", "#df8b32", "#5e7fb5", "#df6b32", "#e5a532", "#8ba4cc", "#e6a083", "#6a9f81", "#8a6da8"];

type WfsFeature = { properties?: Record<string, unknown> };

const EDGAR_EXCLUDE = new Set(["total_excl_lulucf", "total_incl_lulucf", "lulucf", "bunker_fuels"]);

async function wfsFetchAll(cqlFilter: string, signal?: AbortSignal): Promise<Record<string, unknown>[]> {
  const PAGE = 10000;
  const all: Record<string, unknown>[] = [];
  for (let offset = 0; ; offset += PAGE) {
    const params = new URLSearchParams({
      service: "WFS", version: "2.0.0", request: "GetFeature",
      typeName: "geossia:country_indicator_series", outputFormat: "application/json",
      count: String(PAGE), startIndex: String(offset),
      propertyName: "iso3,year,value,sub_indicator",
      CQL_FILTER: cqlFilter,
    });
    const res = await fetch(`${GEOSERVER_WFS}?${params}`, { signal });
    if (!res.ok) break;
    const body = await res.json() as { features?: WfsFeature[] };
    const rows = (body.features ?? []).map((f) => f.properties ?? {});
    all.push(...rows);
    if (rows.length < PAGE) break;
  }
  return all;
}

async function loadEdgarGeoServerSeries(territory: string, signal?: AbortSignal): Promise<EmissionSeriesPayload | null> {
  const countryFilter = territory === "AFR" ? "" : ` AND iso3='${territory.replace(/'/g, "''")}'`;
  const allRows = await wfsFetchAll(`indicator='ghg_emissions'${countryFilter}`, signal);
  const rows = allRows.filter((r) => Number.isFinite(Number(r.year)) && Number.isFinite(Number(r.value)));
  if (!rows.length) return null;

  const years = [...new Set(rows.map((r) => Number(r.year)))].sort((a, b) => a - b);
  const sectorIds = [...new Set(rows.map((r) => String(r.sub_indicator ?? "")).filter((id) => id && !EDGAR_EXCLUDE.has(id)))].sort();
  const bySectorYear = new Map<string, number>();
  for (const r of rows) {
    const sector = String(r.sub_indicator ?? "");
    if (EDGAR_EXCLUDE.has(sector)) continue;
    const key = `${sector}|${Number(r.year)}`;
    bySectorYear.set(key, (bySectorYear.get(key) ?? 0) + Number(r.value));
  }
  const sectors = sectorIds.map((id, i) => ({
    id,
    label: SECTOR_LABELS[id] ?? id.replace(/_/g, " ").replace(/^./, (c: string) => c.toUpperCase()),
    color: SECTOR_COLORS[i % SECTOR_COLORS.length],
    values: years.map((y) => Number((bySectorYear.get(`${id}|${y}`) ?? 0).toFixed(4))),
  }));

  const popRows = await wfsFetchAll(`indicator='wdi' AND sub_indicator='population_total'${countryFilter}`, signal);
  const popByYear = new Map<number, number>();
  for (const r of popRows) {
    const y = Number(r.year), v = Number(r.value);
    if (Number.isFinite(y) && Number.isFinite(v)) popByYear.set(y, (popByYear.get(y) ?? 0) + v);
  }
  const per_capita = years.map((y) => {
    const pop = popByYear.get(y);
    const total = sectorIds.reduce((s, sec) => s + (bySectorYear.get(`${sec}|${y}`) ?? 0), 0);
    return pop ? Number((total * 1_000_000 / pop).toFixed(3)) : NaN;
  });

  return {
    source: "EDGAR",
    release: "EDGAR 2024 · GeoServer ghg_emissions",
    territory, years, sectors,
    per_capita: per_capita.some(Number.isFinite) ? per_capita : undefined,
    unit: "MtCO₂e",
  };
}

async function loadClimateTraceSeries(territory: string, signal?: AbortSignal): Promise<EmissionSeriesPayload | null> {
  const countryFilter = territory === "AFR" ? "" : ` AND iso3='${territory.replace(/'/g, "''")}'`;
  const params = new URLSearchParams({
    service: "WFS", version: "2.0.0", request: "GetFeature",
    typeName: "geossia:country_indicator_series", outputFormat: "application/json",
    count: "10000",
    propertyName: "iso3,year,value,sub_indicator",
    CQL_FILTER: `indicator='climatetrace_emissions'${countryFilter}`,
  });
  const response = await fetch(`${GEOSERVER_WFS}?${params}`, { signal });
  if (!response.ok) return null;
  const body = await response.json() as { features?: WfsFeature[] };
  const rows = (body.features ?? []).map((feature) => feature.properties ?? {}).filter((row) => Number.isFinite(Number(row.year)) && Number.isFinite(Number(row.value)));
  if (!rows.length) return null;

  const years = [...new Set(rows.map((row) => Number(row.year)))].sort((a, b) => a - b);
  // LULUCF can be a carbon sink (negative). It is intentionally excluded
  // from the positive stacked chart, which follows the standard
  // "total excluding LULUCF" convention used by the reference dashboard.
  const sectorIds = [...new Set(rows.map((row) => String(row.sub_indicator ?? "")).filter((id) => id && id !== "total" && id !== "forestry_and_land_use"))].sort();
  const bySectorYear = new Map<string, number>();
  for (const row of rows) {
    const year = Number(row.year), value = Number(row.value), sector = String(row.sub_indicator ?? "");
    if (sector !== "total" && sector !== "forestry_and_land_use") bySectorYear.set(`${sector}|${year}`, (bySectorYear.get(`${sector}|${year}`) ?? 0) + value);
  }
  const sectors = sectorIds.map((id, index) => ({
    id,
    label: SECTOR_LABELS[id] ?? id.replace(/_/g, " ").replace(/^./, (letter: string) => letter.toUpperCase()),
    color: SECTOR_COLORS[index % SECTOR_COLORS.length],
    values: years.map((year) => Number((bySectorYear.get(`${id}|${year}`) ?? 0).toFixed(4))),
  }));

  // The red curve uses the population series already published in the same
  // backend view. MtCO2e × 1e6 / inhabitants = tonnes CO2e per inhabitant.
  const populationParams = new URLSearchParams(params);
  populationParams.set("CQL_FILTER", `indicator='wdi' AND sub_indicator='population_total'${countryFilter}`);
  const populationResponse = await fetch(`${GEOSERVER_WFS}?${populationParams}`, { signal });
  const populationByYear = new Map<number, number>();
  if (populationResponse.ok) {
    const populationBody = await populationResponse.json() as { features?: WfsFeature[] };
    for (const feature of populationBody.features ?? []) {
      const row = feature.properties ?? {};
      const year = Number(row.year), value = Number(row.value);
      if (Number.isFinite(year) && Number.isFinite(value)) populationByYear.set(year, (populationByYear.get(year) ?? 0) + value);
    }
  }
  const per_capita = years.map((year) => {
    const population = populationByYear.get(year);
    const total = sectorIds.reduce((sum, sector) => sum + (bySectorYear.get(`${sector}|${year}`) ?? 0), 0);
    return population && total !== undefined ? Number((total * 1_000_000 / population).toFixed(3)) : NaN;
  });
  const hasPerCapita = per_capita.some(Number.isFinite);
  return { source: "Climate TRACE", release: "Inventaire mondial v6", territory, years, sectors, per_capita: hasPerCapita ? per_capita : undefined, unit: "MtCO₂e" };
}

export async function loadEdgarCatalog(signal?: AbortSignal): Promise<EdgarDataset[]> {
  const response = await fetch(`${API_ROOT}/datasets?q=edgar`, { signal });
  if (!response.ok) throw new Error(`Catalogue EDGAR indisponible (${response.status})`);
  const payload = await response.json() as { items?: EdgarDataset[] };
  return payload.items ?? [];
}

export const SUBSTANCES = [
  { id: "CO2", label: "Dioxyde de carbone (CO₂)" },
  { id: "CH4", label: "Méthane (CH₄)" },
  { id: "N2O", label: "Protoxyde d'azote (N₂O)" },
  { id: "F-Gas", label: "Gaz fluorés (F-Gas)" },
  { id: "All GHG", label: "Tous les GES" },
] as const;

const CW_EXCLUDE_SECTORS = new Set(["Total excluding LULUCF", "Total including LULUCF", "Bunker Fuels", "Energy", "Land Use, Land-Use Change and Forestry"]);

const CW_SECTOR_COLORS: Record<string, string> = {
  "Agriculture": "#496fae",
  "Building": "#be3940",
  "Electricity/Heat": "#df6b32",
  "Fugitive Emissions": "#df8b32",
  "Industrial Processes": "#e5a532",
  "Manufacturing/Construction": "#5e7fb5",
  "Other Fuel Combustion": "#8ba4cc",
  "Land Use, Land-Use Change and Forestry": "#6a9f81",
};

const EDGAR_SECTOR_COLORS: Record<string, string> = {
  buildings: "#496fae", fuel_production: "#be3940",
  industrial_combustion: "#df8b32", power_industry: "#5e7fb5",
  processes: "#df6b32", agriculture: "#6a9f81", transport: "#e5a532", waste: "#8ba4cc",
};

async function loadEdgarCountrySeries(territory: string, gas: string, signal?: AbortSignal): Promise<EmissionSeriesPayload | null> {
  const countryFilter = territory === "AFR" ? "" : ` AND iso3='${territory.replace(/'/g, "''")}'`;
  const params = new URLSearchParams({
    service: "WFS", version: "2.0.0", request: "GetFeature",
    typeName: "geossia:edgar_country_emission_series", outputFormat: "application/json",
    propertyName: "iso3,sector_id,sector_name,year,value_kt,release", count: "100000",
    CQL_FILTER: `gas='${gas.replace(/'/g, "''")}'${countryFilter}`,
  });
  const response = await fetch(`${GEOSERVER_WFS}?${params}`, { signal });
  if (!response.ok) return null;
  const body = await response.json() as { features?: WfsFeature[] };
  const rows = (body.features ?? []).map((feature) => feature.properties ?? {});
  if (!rows.length) return null;
  const years = [...new Set(rows.map((row) => Number(row.year)).filter(Number.isFinite))].sort((a, b) => a - b);
  const sectorNames = new Map<string, string>();
  const values = new Map<string, number>();
  for (const row of rows) {
    const sector = String(row.sector_id ?? ""), year = Number(row.year), value = Number(row.value_kt);
    if (!sector || !Number.isFinite(year) || !Number.isFinite(value)) continue;
    sectorNames.set(sector, String(row.sector_name ?? sector));
    values.set(`${sector}|${year}`, (values.get(`${sector}|${year}`) ?? 0) + value);
  }
  const order = ["agriculture", "buildings", "fuel_production", "industrial_combustion", "power_industry", "processes", "transport", "waste"];
  const sectors = order.filter((id) => sectorNames.has(id)).map((id) => ({ id, label: sectorNames.get(id)!, color: EDGAR_SECTOR_COLORS[id], values: years.map((year) => Number((values.get(`${id}|${year}`) ?? 0).toFixed(4))) }));

  const populationParams = new URLSearchParams({ service: "WFS", version: "2.0.0", request: "GetFeature", typeName: "geossia:country_indicator_series", outputFormat: "application/json", propertyName: "iso3,year,value", count: "10000", CQL_FILTER: `indicator='wdi' AND sub_indicator='population_total'${countryFilter}` });
  const populationResponse = await fetch(`${GEOSERVER_WFS}?${populationParams}`, { signal });
  const populationByYear = new Map<number, number>();
  if (populationResponse.ok) {
    const populationBody = await populationResponse.json() as { features?: WfsFeature[] };
    for (const feature of populationBody.features ?? []) {
      const row = feature.properties ?? {}, year = Number(row.year), value = Number(row.value);
      if (Number.isFinite(year) && Number.isFinite(value)) populationByYear.set(year, (populationByYear.get(year) ?? 0) + value);
    }
  }
  const per_capita = years.map((year, index) => {
    const population = populationByYear.get(year);
    const totalKt = sectors.reduce((sum, sector) => sum + sector.values[index], 0);
    return population ? Number((totalKt * 1000 / population).toFixed(4)) : NaN;
  });
  const unit = gas === "CO2" ? "kt CO₂" : gas === "CH4" ? "kt CH₄" : gas === "N2O" ? "kt N₂O" : "kt CO₂e";
  return { source: "EDGAR", release: `EDGAR_2026_GHG · ${gas}`, territory, years, sectors, per_capita: per_capita.some(Number.isFinite) ? per_capita : undefined, unit };
}

interface CwEmission { year: number; value: number | null }
interface CwRow { sector: string; gas: string; emissions: CwEmission[] }

export async function loadClimateWatchSeries(
  territory: string,
  substance: string,
  signal?: AbortSignal,
): Promise<EmissionSeriesPayload | null> {
  const iso3 = territory === "AFR" ? "" : territory;
  const params = new URLSearchParams();
  if (iso3) params.set("regions", iso3);
  params.set("gas", substance);
  const url = `https://www.climatewatchdata.org/api/v1/data/historical_emissions?${params}`;
  const response = await fetch(url, { signal, headers: { Accept: "application/json" } });
  if (!response.ok) return null;
  const body = await response.json() as { data?: CwRow[] };
  const rows = (body.data ?? []).filter(
    (r) => r.gas === substance && !CW_EXCLUDE_SECTORS.has(r.sector),
  );
  if (!rows.length) return null;

  const yearsSet = new Set<number>();
  for (const r of rows) for (const e of r.emissions) if (e.value != null) yearsSet.add(e.year);
  const years = [...yearsSet].sort((a, b) => a - b);
  const yearIdx = new Map(years.map((y, i) => [y, i]));

  const sectorMap = new Map<string, number[]>();
  for (const r of rows) {
    if (sectorMap.has(r.sector)) continue;
    const vals = new Array(years.length).fill(0) as number[];
    for (const e of r.emissions) {
      const idx = yearIdx.get(e.year);
      if (idx !== undefined && e.value != null) vals[idx] = e.value;
    }
    sectorMap.set(r.sector, vals);
  }

  // Trim leading years where every sector is zero
  let firstNonZero = 0;
  for (let i = 0; i < years.length; i++) {
    const hasData = [...sectorMap.values()].some((vals) => vals[i] > 0);
    if (hasData) { firstNonZero = i; break; }
  }
  const trimmedYears = years.slice(firstNonZero);

  const sectors = [...sectorMap.entries()].map(([label], i) => ({
    id: label,
    label,
    color: CW_SECTOR_COLORS[label] ?? SECTOR_COLORS[i % SECTOR_COLORS.length],
    values: sectorMap.get(label)!.slice(firstNonZero),
  }));

  const populationParams = new URLSearchParams({
    service: "WFS", version: "2.0.0", request: "GetFeature",
    typeName: "geossia:country_indicator_series", outputFormat: "application/json",
    propertyName: "iso3,year,value", count: "10000",
    CQL_FILTER: `indicator='wdi' AND sub_indicator='population_total'${territory === "AFR" ? "" : ` AND iso3='${territory.replace(/'/g, "''")}'`}`,
  });
  const populationResponse = await fetch(`${GEOSERVER_WFS}?${populationParams}`, { signal });
  const populationByYear = new Map<number, number>();
  if (populationResponse.ok) {
    const populationBody = await populationResponse.json() as { features?: WfsFeature[] };
    for (const feature of populationBody.features ?? []) {
      const row = feature.properties ?? {}, year = Number(row.year), value = Number(row.value);
      if (Number.isFinite(year) && Number.isFinite(value)) populationByYear.set(year, (populationByYear.get(year) ?? 0) + value);
    }
  }
  const per_capita = trimmedYears.map((year, index) => {
    const population = populationByYear.get(year);
    const totalMt = sectors.reduce((sum, sector) => sum + (sector.values[index] ?? 0), 0);
    return population ? Number((totalMt * 1_000_000 / population).toFixed(4)) : NaN;
  });

  return {
    source: "Climate Watch",
    release: `Climate Watch · ${substance}`,
    territory,
    years: trimmedYears,
    sectors,
    per_capita: per_capita.some(Number.isFinite) ? per_capita : undefined,
    unit: substance === "CO2" ? "MtCO₂" : "MtCO₂e",
  };
}

const emissionsCache = new Map<string, { ts: number; data: EmissionSeriesPayload | null }>();
const CACHE_TTL = 5 * 60 * 1000;

export async function loadEmissionSeries(territory: string, substance = "All GHG", signal?: AbortSignal): Promise<EmissionSeriesPayload | null> {
  const cacheKey = `${territory}|${substance}`;
  const cached = emissionsCache.get(cacheKey);
  if (cached && Date.now() - cached.ts < CACHE_TTL) return cached.data;

  const sources: Array<Promise<EmissionSeriesPayload | null>> = [
    loadEdgarCountrySeries(territory, substance, signal).catch(() => null),
    loadClimateWatchSeries(territory, substance, signal).catch(() => null),
  ];
  if (substance === "All GHG") {
    sources.push(loadEdgarGeoServerSeries(territory, signal).catch(() => null));
    sources.push(loadClimateTraceSeries(territory, signal).catch(() => null));
  }
  const results = await Promise.allSettled(sources);
  const resolved = results.map((r) => r.status === "fulfilled" ? r.value : null);

  const result = resolved[0] ?? resolved[2] ?? resolved[1] ?? resolved[3] ?? null;
  if (result) { emissionsCache.set(cacheKey, { ts: Date.now(), data: result }); return result; }

  const params = new URLSearchParams({ territory, substance: "CO2", group_by: "sector" });
  const response = await fetch(`${API_ROOT}/emissions/series?${params}`, { signal });
  if (response.status === 404 || response.status === 501) { emissionsCache.set(cacheKey, { ts: Date.now(), data: null }); return null; }
  if (!response.ok) throw new Error(`Séries EDGAR indisponibles (${response.status})`);
  const data = await response.json() as EmissionSeriesPayload;
  emissionsCache.set(cacheKey, { ts: Date.now(), data }); return data;
}
