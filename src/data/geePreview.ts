export interface GeePreviewResult {
  ok: boolean;
  kind: "fire" | "flood" | "burned_area";
  scene_counts: Record<string, number>;
  scale_m: number;
  layers: Record<string, { tile_url: string }>;
}

export interface GeeTileLayer {
  id: string;
  label: string;
  tileUrl: string;
}

const FIRE_LABELS: Record<string, string> = {
  severity: "Sévérité du feu (dNBR)",
  fire_pre_truecolor: "Avant feu — couleur vraie",
  fire_post_truecolor: "Après feu — couleur vraie",
  fire_pre_nbr: "Avant feu — NBR",
  fire_post_nbr: "Après feu — NBR",
  fire_dnbr: "dNBR (niveaux de gris)",
};

const FLOOD_LABELS: Record<string, string> = {
  before: "Avant inondation — SAR",
  after: "Pendant inondation — SAR",
  difference: "Différence SAR",
  flood: "Étendue inondée",
  landcover: "Occupation du sol",
  cropland_context: "Terres agricoles",
  urban_context: "Zones urbaines",
  population_density: "Densité de population",
  population: "Population exposée",
  cropland: "Terres agricoles affectées",
  urban: "Zones urbaines affectées",
};

export async function requestGeePreview(params: Record<string, unknown>): Promise<GeePreviewResult> {
  const response = await fetch("/__admin/gee-preview", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
    signal: AbortSignal.timeout(120_000),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || `GEE HTTP ${response.status}`);
  return payload as GeePreviewResult;
}

export function geeResultToTileLayers(result: GeePreviewResult): GeeTileLayer[] {
  const labels = result.kind === "fire" ? FIRE_LABELS : FLOOD_LABELS;
  return Object.entries(result.layers)
    .filter(([, v]) => v.tile_url)
    .map(([key, v]) => ({
      id: `gee-${result.kind}-${key}`,
      label: labels[key] ?? key,
      tileUrl: v.tile_url,
    }));
}
