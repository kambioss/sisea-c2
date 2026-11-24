import { useEffect, useState } from "react";

export interface RasterPeriod { id: string; label: string; layerName: string; referenceTime: string }
export interface RasterClimateLayer {
  id: string;
  datasetId: string;
  group: "Précipitations" | "Sécheresse météorologique" | "Sécheresse agricole" | "Émissions";
  name: string;
  unit: string;
  description: string;
  source: string;
  style?: string;
  periods: RasterPeriod[];
}

interface CoreAsset { asset_id: string; storage_uri: string; format?: string; metadata?: { geoserver_layer?: string } }
interface CoreVersion { version_id?: string; reference_time?: string | null; assets?: CoreAsset[] }
interface CoreDataset { versions?: CoreVersion[] }
type Cadence = "dekad" | "day" | "month" | "year";
interface Definition extends Omit<RasterClimateLayer, "periods"> { pattern?: RegExp; since?: string; cadence?: Cadence }

const DEFINITIONS: Definition[] = [
  { id: "raster-chirps-dekad", datasetId: "chirps", group: "Précipitations", name: "Pluie décadaire CHIRPS", unit: "mm/10 jours", source: "CHIRPS v3 — Climate Hazards Center / WFP", description: "Cumul raster de pluie pour les jours 1–10, 11–20 ou 21–fin du mois.", since: "2025-01-01", cadence: "dekad", style: "legend_chirps_default_precip" },
  { id: "raster-chirps-monthly", datasetId: "chirps-precipitation-monthly", group: "Précipitations", name: "Précipitations mensuelles CHIRPS", unit: "mm/mois", source: "CHIRPS — Climate Hazards Center", description: "Cumul mensuel de précipitations à 0,05°.", since: "2025-01-01", cadence: "month", style: "legend_chirps_precipitation_monthly_default_precip" },
  { id: "raster-spi1", datasetId: "chirps-spi-1month", group: "Sécheresse météorologique", name: "SPI-1", unit: "indice", source: "CHIRPS / OMM", description: "Sécheresse météorologique sur un mois.", since: "2025-01-01", cadence: "month" },
  { id: "raster-spi3", datasetId: "spi-3-month", group: "Sécheresse météorologique", name: "SPI-3", unit: "indice", source: "CHIRPS / OMM", description: "Sécheresse météorologique sur trois mois.", since: "2025-01-01", cadence: "month" },
  { id: "raster-spi12", datasetId: "spi-12-month", group: "Sécheresse météorologique", name: "SPI-12", unit: "indice", source: "CHIRPS / OMM", description: "Sécheresse météorologique sur douze mois.", since: "2025-01-01", cadence: "month" },
  { id: "raster-gefs-5d", datasetId: "chirps3_gefs_05d", group: "Précipitations", name: "Prévision CHIRPS-GEFS — 5 jours", unit: "mm", source: "CHIRPS3-GEFS", description: "Cumul de pluie prévu à 5 jours, corrigé et downscalé à 0,05°.", pattern: /gaul2024_cog/i, style: "legend_chirps3_gefs_05d_default_precip_5d" },
  { id: "raster-gefs-10d", datasetId: "chirps3_gefs_10d", group: "Précipitations", name: "Prévision CHIRPS-GEFS — 10 jours", unit: "mm", source: "CHIRPS3-GEFS", description: "Cumul de pluie prévu à 10 jours, corrigé et downscalé à 0,05°.", pattern: /gaul2024_cog/i, style: "legend_chirps3_gefs_10d_default_precip_10d" },
  { id: "raster-gefs-15d", datasetId: "chirps3_gefs_15d", group: "Précipitations", name: "Prévision CHIRPS-GEFS — 15 jours", unit: "mm", source: "CHIRPS3-GEFS", description: "Cumul de pluie prévu à 15 jours, corrigé et downscalé à 0,05°.", pattern: /gaul2024_cog/i, style: "legend_chirps3_gefs_15d_default_precip_15d" },
  { id: "raster-spi-forecast-5d", datasetId: "spi_forecast_5d", group: "Sécheresse météorologique", name: "SPI prévisionnel — 5 jours", unit: "indice", source: "CHIRPS3 + CHIRPS3-GEFS", description: "SPI glissant de six pentades, fenêtre finissant à la pentade en cours.", pattern: /gaul2024_cog/i, style: "legend_spi_forecast_5d_default_spi_5d_forecast" },
  { id: "raster-spi-forecast-10d", datasetId: "spi_forecast_10d", group: "Sécheresse météorologique", name: "SPI prévisionnel — 10 jours", unit: "indice", source: "CHIRPS3 + CHIRPS3-GEFS", description: "SPI glissant de six pentades avec une pentade prévisionnelle.", pattern: /gaul2024_cog/i, style: "legend_spi_forecast_10d_default_spi_10d_forecast" },
  { id: "raster-spi-forecast-15d", datasetId: "spi_forecast_15d", group: "Sécheresse météorologique", name: "SPI prévisionnel — 15 jours", unit: "indice", source: "CHIRPS3 + CHIRPS3-GEFS", description: "SPI glissant de six pentades avec deux pentades prévisionnelles.", pattern: /gaul2024_cog/i, style: "legend_spi_forecast_15d_default_spi_15d_forecast" },
  { id: "raster-fapar", datasetId: "fapar_cdse", group: "Sécheresse agricole", name: "fAPAR décadaire", unit: "fraction", source: "Copernicus Global Land Service — Sentinel-3 OLCI", description: "Fraction du rayonnement photosynthétiquement actif absorbée par la végétation.", pattern: /^fapar_c_gls_/i, cadence: "dekad", style: "fapar_index" },
  { id: "raster-fapar-anomaly", datasetId: "fapar_cdse", group: "Sécheresse agricole", name: "Anomalie fAPAR", unit: "écart", source: "Copernicus Global Land Service / GEOSSIA", description: "Écart avec la même décade de l’année précédente.", pattern: /^fapar_anomaly_(?!monthly)/i, cadence: "dekad", style: "fapar_anomaly_index" },
  { id: "raster-vci", datasetId: "noaa_vhp", group: "Sécheresse agricole", name: "VCI — état de la végétation", unit: "indice 0–100", source: "NOAA/NESDIS STAR VHP", description: "Condition de la végétation par rapport à son historique saisonnier.", pattern: /^vci_/i },
  { id: "raster-tci", datasetId: "noaa_vhp", group: "Sécheresse agricole", name: "TCI — stress thermique", unit: "indice 0–100", source: "NOAA/NESDIS STAR VHP", description: "Stress thermique de la végétation par rapport à son historique.", pattern: /^tci_/i },
  { id: "raster-vhi", datasetId: "noaa_vhp", group: "Sécheresse agricole", name: "VHI — santé de la végétation", unit: "indice 0–100", source: "NOAA/NESDIS STAR VHP", description: "Indice combiné VCI/TCI de santé de la végétation.", pattern: /^vhi_/i },
  { id: "raster-rsm", datasetId: "wapor_rsm", group: "Sécheresse agricole", name: "Humidité du sol racinaire", unit: "%", source: "FAO WaPOR v3", description: "Humidité relative de la zone racinaire, composite décadaire.", cadence: "dekad" },
  { id: "raster-aeti", datasetId: "wapor_aeti", group: "Sécheresse agricole", name: "Évapotranspiration réelle (AETI)", unit: "mm/décade", source: "FAO WaPOR v3", description: "Évapotranspiration réelle et interception décadaires.", cadence: "dekad" },
  { id: "raster-edgar-ghg", datasetId: "edgar_ghg_total", group: "Émissions", name: "Émissions totales de GES", unit: "t CO₂e/km²/an", source: "JRC EDGAR 2026", description: "Total anthropique spatialisé en équivalent CO₂.", cadence: "year" },
  { id: "raster-edgar-co2", datasetId: "edgar_co2", group: "Émissions", name: "CO₂ fossile", unit: "t/km²/an", source: "JRC EDGAR 2026", description: "Émissions anthropiques de CO₂ fossile.", cadence: "year" },
  { id: "raster-edgar-co2bio", datasetId: "edgar_co2bio", group: "Émissions", name: "CO₂ biogénique", unit: "t/km²/an", source: "JRC EDGAR 2026", description: "Émissions anthropiques de CO₂ biogénique.", cadence: "year" },
  { id: "raster-edgar-ch4", datasetId: "edgar_ch4", group: "Émissions", name: "Méthane (CH₄)", unit: "t/km²/an", source: "JRC EDGAR 2026", description: "Émissions anthropiques de méthane.", cadence: "year" },
  { id: "raster-edgar-n2o", datasetId: "edgar_n2o", group: "Émissions", name: "Protoxyde d’azote (N₂O)", unit: "t/km²/an", source: "JRC EDGAR 2026", description: "Émissions anthropiques de protoxyde d’azote.", cadence: "year" },
  ...[["so2", "SO₂"], ["nox", "NOₓ"], ["co", "CO"], ["nmvoc", "COVNM"], ["nh3", "NH₃"], ["pm10", "PM₁₀"], ["pm25", "PM₂,₅"], ["bc", "Carbone suie"], ["oc", "Carbone organique"]].map(([code, label]) => ({ id: `raster-edgar-${code}`, datasetId: `edgar_${code}`, group: "Émissions" as const, name: label, unit: "t/km²/an", source: "JRC EDGAR v8.1", description: `Grille d’émissions anthropiques ${label}.`, cadence: "year" as const })),
  { id: "raster-gfed-co2", datasetId: "gfed_fire_co2", group: "Émissions", name: "CO₂ des feux de biomasse", unit: "t/km²/an", source: "GFED5.1", description: "Émissions de CO₂ dues aux feux de biomasse.", cadence: "year" },
  { id: "raster-gfed-ch4", datasetId: "gfed_fire_ch4", group: "Émissions", name: "CH₄ des feux de biomasse", unit: "t/km²/an", source: "GFED5.1", description: "Émissions de CH₄ dues aux feux de biomasse.", cadence: "year" },
];

const API = ((import.meta.env.VITE_PUBLIC_CATALOG_API_URL as string | undefined) || (import.meta.env.VITE_CORE_API_URL as string | undefined) || "/catalog-api/api/v1").replace(/\/$/, "");

function safeName(value: string): string { return value.toLowerCase().replace(/[^a-z0-9_]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 48) || "raster"; }
function layerName(asset: CoreAsset): string {
  if (asset.metadata?.geoserver_layer) return asset.metadata.geoserver_layer;
  const stem = (asset.storage_uri.split("/").pop() ?? "raster").replace(/\.[^.]+$/, "");
  return `${safeName(stem)}_${asset.asset_id.replace(/-/g, "").slice(0, 8)}`;
}
function periodLabel(date: Date, cadence: Cadence = "day"): string {
  if (cadence === "year") return String(date.getUTCFullYear());
  if (cadence === "month") return new Intl.DateTimeFormat("fr-FR", { month: "long", year: "numeric", timeZone: "UTC" }).format(date);
  if (cadence === "day") return new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "UTC" }).format(date);
  const day = date.getUTCDate();
  const dekad = day <= 10 ? 1 : day <= 20 ? 2 : 3;
  const first = dekad === 1 ? 1 : dekad === 2 ? 11 : 21;
  const last = day <= 10 ? 10 : day <= 20 ? 20 : new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)).getUTCDate();
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${pad(first)}–${pad(last)}/${pad(date.getUTCMonth() + 1)}/${date.getUTCFullYear()} (D${dekad})`;
}

async function loadDefinition(definition: Definition): Promise<RasterClimateLayer | null> {
  const response = await fetch(`${API}/datasets/${encodeURIComponent(definition.datasetId)}`, { headers: { Accept: "application/json" }, signal: AbortSignal.timeout(15_000) });
  if (!response.ok) return null;
  const dataset = await response.json() as CoreDataset;
  const periods = (dataset.versions ?? []).flatMap((version) => {
    const referenceTime = version.reference_time;
    if (!referenceTime || definition.since && referenceTime < definition.since) return [];
    const date = new Date(referenceTime);
    if (!Number.isFinite(date.getTime())) return [];
    return (version.assets ?? []).flatMap((asset) => {
      const file = asset.storage_uri.split("/").pop() ?? "";
      if (!/^(cog|geotiff|tiff)$/i.test(asset.format ?? "") || !/\.tiff?$/i.test(file) || definition.pattern && !definition.pattern.test(file)) return [];
      const match = /_(\d{4})(\d{2})(\d{2})\d{4}_/.exec(file);
      const labelDate = match ? new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]))) : date;
      return [{ id: version.version_id ?? `${definition.datasetId}-${referenceTime}`, label: periodLabel(labelDate, definition.cadence), layerName: layerName(asset), referenceTime }];
    });
  }).sort((a, b) => b.referenceTime.localeCompare(a.referenceTime));
  return periods.length ? { ...definition, periods } : null;
}

export function useRasterClimateCatalog(): { layers: RasterClimateLayer[]; loading: boolean } {
  const [layers, setLayers] = useState<RasterClimateLayer[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let active = true;
    Promise.all(DEFINITIONS.map((definition) => loadDefinition(definition).catch(() => null))).then((items) => {
      if (active) { setLayers(items.filter((item): item is RasterClimateLayer => Boolean(item))); setLoading(false); }
    });
    return () => { active = false; };
  }, []);
  return { layers, loading };
}
