import { useEffect, useState } from "react";

export interface ProductDate {
  layer_name: string;
  workspace: string;
  style: string | null;
  title: string;
  reference_time: string | null;
  period_label: string;
  period_start?: string | null;
  period_end?: string | null;
  forecast_horizon_days?: number | null;
}

export interface ProductLatest {
  layer_name: string;
  workspace: string;
  style: string | null;
  reference_time: string | null;
  period_label: string;
  period_start?: string | null;
  period_end?: string | null;
  forecast_horizon_days?: number | null;
}

export interface ProductIndicator {
  id: string;
  label_fr: string;
  label_en: string;
  unit: string;
  temporal_step: string;
  forecast_horizon_days?: number | null;
  dates_count: number;
  latest: ProductLatest | null;
}

export interface ProductFamily {
  id: string;
  label_fr: string;
  label_en: string;
  indicators: ProductIndicator[];
}

export interface LegendItem {
  value: string | number;
  label?: string | null;
  color: string;
  opacity?: number | null;
}

export interface ProductLegend {
  indicator_id: string;
  layer_ref: string | null;
  attribute: string | null;
  unit: string;
  type: "categorical" | "continuous" | "intervals" | null;
  style: {
    classes?: LegendItem[];
    stops?: LegendItem[];
    min?: number;
    max?: number;
  } | null;
}

const API = (
  (import.meta.env.VITE_PUBLIC_CATALOG_API_URL as string | undefined)
  || (import.meta.env.VITE_CORE_API_URL as string | undefined)
  || "/catalog-api/api/v1"
).replace(/\/$/, "");

const HIDDEN_PRODUCT_INDICATORS = new Set([
  "vhi_landsat", "vci_landsat", "tci_landsat", "ndvi_landsat", "lst_landsat",
  // The current MODIS ingestion only contains isolated tiles. Keep these
  // products out of the public catalogue until the Africa mosaic is complete.
  "svi", "evi",
  // Superseded in the public catalogue by the operational Google Flood
  // gauge and flash-flood products.
  "flood_extent",
]);

const GOOGLE_FLOOD_INDICATORS: ProductIndicator[] = [
  {
    id: "google_flood_gauges",
    label_fr: "Vigilance des cours d’eau (Google Flood)",
    label_en: "River gauge alerts (Google Flood)",
    unit: "niveau d’alerte",
    temporal_step: "live",
    dates_count: 1,
    latest: { layer_name: "flood_gauge_status", workspace: "geossia", style: "flood_gauge_severity", reference_time: null, period_label: "Temps réel" },
  },
  {
    id: "google_flash_floods",
    label_fr: "Risque de crue éclair (Google Flood)",
    label_en: "Flash-flood risk (Google Flood)",
    unit: "probabilité",
    temporal_step: "live",
    dates_count: 1,
    latest: { layer_name: "flash_flood_event", workspace: "geossia", style: "flash_flood_likelihood", reference_time: null, period_label: "Temps réel" },
  },
];

function withGoogleFlood(families: ProductFamily[]): ProductFamily[] {
  const flood = families.find((family) => family.id === "flood");
  if (flood) {
    flood.indicators.push(...GOOGLE_FLOOD_INDICATORS.filter((extra) => !flood.indicators.some((item) => item.id === extra.id)));
    return families;
  }
  return [...families, { id: "flood", label_fr: "Inondations", label_en: "Floods", indicators: GOOGLE_FLOOD_INDICATORS }];
}

export async function fetchProductFamilies(): Promise<ProductFamily[]> {
  const response = await fetch(`${API}/products`, {
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) throw new Error(`products: HTTP ${response.status}`);
  const payload = await response.json() as { families?: ProductFamily[] };
  return withGoogleFlood((payload.families ?? [])
    .map((family) => ({
      ...family,
      indicators: family.indicators.filter((indicator) => !HIDDEN_PRODUCT_INDICATORS.has(indicator.id)),
    }))
    .filter((family) => family.indicators.length > 0));
}

export async function fetchProductDates(indicatorId: string, limit = 400): Promise<ProductDate[]> {
  const googleFlood = GOOGLE_FLOOD_INDICATORS.find((indicator) => indicator.id === indicatorId);
  if (googleFlood?.latest) {
    return [{
      ...googleFlood.latest,
      title: googleFlood.label_fr,
      period_label: googleFlood.latest.period_label,
    }];
  }
  const response = await fetch(
    `${API}/products/${encodeURIComponent(indicatorId)}/dates?limit=${limit}`,
    { headers: { Accept: "application/json" }, signal: AbortSignal.timeout(15_000) },
  );
  if (!response.ok) throw new Error(`product dates: HTTP ${response.status}`);
  const payload = await response.json() as { dates?: ProductDate[] };
  return payload.dates ?? [];
}

export async function fetchProductLegend(indicatorId: string): Promise<ProductLegend | null> {
  if (indicatorId === "google_flood_gauges") return {
    indicator_id: indicatorId, layer_ref: "flood_gauge_status", attribute: "severity", unit: "niveau d’alerte", type: "categorical",
    style: { classes: [
      { value: "NO_FLOODING", label: "Situation normale", color: "#6BAF6B" },
      { value: "ABOVE_NORMAL", label: "Niveau supérieur à la normale", color: "#F2C94C" },
      { value: "SEVERE", label: "Crue sévère", color: "#F2994A" },
      { value: "EXTREME", label: "Crue extrême", color: "#C62828" },
      { value: "UNKNOWN", label: "Statut inconnu", color: "#9E9E9E" },
    ] },
  };
  if (indicatorId === "google_flash_floods") return {
    indicator_id: indicatorId, layer_ref: "flash_flood_event", attribute: "likelihood", unit: "probabilité", type: "categorical",
    style: { classes: [
      { value: "LIKELY", label: "Crue éclair probable", color: "#2D9CDB", opacity: 0.55 },
      { value: "HIGHLY_LIKELY", label: "Crue éclair très probable", color: "#1B4F9C", opacity: 0.75 },
    ] },
  };
  const response = await fetch(`${API}/products/${encodeURIComponent(indicatorId)}/legend`, {
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(15_000),
  });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`product legend: HTTP ${response.status}`);
  return response.json() as Promise<ProductLegend>;
}

export async function fetchLayerLegend(layerRef: string): Promise<ProductLegend | null> {
  const response = await fetch(`${API}/legends/${encodeURIComponent(layerRef)}`, {
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(15_000),
  });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`layer legend: HTTP ${response.status}`);
  const payload = await response.json() as Omit<ProductLegend, "indicator_id" | "unit">;
  return { ...payload, indicator_id: "", unit: "" };
}

const REFRESH_MS = 5 * 60 * 1000;

export function useProductCatalog(): { families: ProductFamily[]; loading: boolean; error: string | null } {
  const [families, setFamilies] = useState<ProductFamily[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const load = () => {
      fetchProductFamilies()
        .then((items) => { if (active) { setFamilies(items); setError(null); setLoading(false); } })
        .catch(() => { if (active) { setError("Catalogue produits indisponible"); setLoading(false); } });
    };
    load();
    const timer = window.setInterval(load, REFRESH_MS);
    return () => { active = false; window.clearInterval(timer); };
  }, []);

  return { families, loading, error };
}
