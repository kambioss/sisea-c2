/**
 * Cache quotidien des couches WFS du SAP (alertes sécheresse et feux).
 *
 * Les vues GeoServer `*_alert_*_current` réexécutent l'agrégation de la
 * dernière émission et relisent les géométries GAUL 2024 à chaque requête
 * GetFeature (~15–35 s par couche), alors que les providers SAP n'émettent
 * que quelques fois par jour (feux 06h30/14h30 UTC, sécheresse 08h30 UTC).
 * Chaque réponse est donc calculée une seule fois par navigateur et par
 * période : le cache est valable jusqu'au prochain midi (heure locale) — le
 * premier visiteur de la journée déclenche le recalcul, les suivants sont
 * servis instantanément. Un cache périmé reste affiché pendant que le
 * rafraîchissement se poursuit en arrière-plan, même si la page est quittée.
 */

export interface SapLayerSnapshot<P = Record<string, unknown>> {
  features: { properties: P; bbox: number[] | null }[];
  fetchedAt: number;
}

export type SapLayerState<P = Record<string, unknown>> =
  | { status: "loading" }
  | { status: "ready"; snapshot: SapLayerSnapshot<P> }
  | { status: "error" };

const STORAGE_PREFIX = "c2-sap-wfs:";
const REFRESH_HOUR = 12;

interface LayerEntry {
  snapshot: SapLayerSnapshot | null;
  failed: boolean;
  listeners: Set<() => void>;
  inflight: Promise<void> | null;
}

const entries = new Map<string, LayerEntry>();

/* Prochain midi suivant l'instant donné — borne de validité du cache. */
function nextRefreshPoint(from: Date): number {
  const point = new Date(from);
  point.setHours(REFRESH_HOUR, 0, 0, 0);
  if (point.getTime() <= from.getTime()) point.setDate(point.getDate() + 1);
  return point.getTime();
}

function readStorage(layer: string): SapLayerSnapshot | null {
  try {
    const raw = localStorage.getItem(STORAGE_PREFIX + layer);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as SapLayerSnapshot;
    return Array.isArray(parsed?.features) && typeof parsed.fetchedAt === "number"
      ? parsed
      : null;
  } catch {
    return null;
  }
}

function writeStorage(layer: string, snapshot: SapLayerSnapshot) {
  try {
    localStorage.setItem(STORAGE_PREFIX + layer, JSON.stringify(snapshot));
  } catch { /* quota dépassé — le cache mémoire reste utilisable */ }
}

function startRefresh(layer: string, url: string, entry: LayerEntry) {
  entry.failed = false;
  entry.inflight = fetch(url)
    .then((response) => {
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return response.json();
    })
    .then((json: { features?: { properties?: unknown; bbox?: number[] }[] }) => {
      entry.snapshot = {
        features: (json.features ?? []).map((feature) => ({
          properties: (feature.properties ?? {}) as Record<string, unknown>,
          bbox: Array.isArray(feature.bbox) ? feature.bbox : null,
        })),
        fetchedAt: Date.now(),
      };
      writeStorage(layer, entry.snapshot);
      for (const listener of entry.listeners) listener();
    })
    .catch(() => {
      // Sans snapshot (même périmé) la couche est indisponible ; sinon on
      // continue de servir la dernière émission connue.
      entry.failed = true;
      for (const listener of entry.listeners) listener();
    })
    .finally(() => { entry.inflight = null; });
}

export function subscribeSapLayer<P>(
  layer: string,
  url: string,
  onUpdate: (state: SapLayerState<P>) => void,
): () => void {
  const existing = entries.get(layer);
  const entry: LayerEntry = existing ?? { snapshot: readStorage(layer), failed: false, listeners: new Set(), inflight: null };
  if (!existing) entries.set(layer, entry);

  const notifyListener = () => {
    if (!entry.snapshot) onUpdate(entry.failed ? { status: "error" } : { status: "loading" });
    else onUpdate({ status: "ready", snapshot: entry.snapshot as unknown as SapLayerSnapshot<P> });
  };
  entry.listeners.add(notifyListener);

  const expired = !entry.snapshot
    || Date.now() >= nextRefreshPoint(new Date(entry.snapshot.fetchedAt));
  if (expired && !entry.inflight) startRefresh(layer, url, entry);

  notifyListener();
  return () => { entry.listeners.delete(notifyListener); };
}
