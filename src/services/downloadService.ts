/**
 * Service de préparation et suivi des téléchargements de données géospatiales.
 *
 * Flux : affichage WMS direct → l'utilisateur clique « télécharger » →
 * préparation GeoTIFF via GeoServer WCS → progression → téléchargement.
 */

export type DownloadStatus = "preparing" | "pipeline" | "ready" | "failed" | "downloading";

export interface DownloadItem {
  id: string;
  label: string;
  type: "burn_assessment" | "flood_assessment" | "layer_export" | "raster";
  layerName: string;
  bbox: [number, number, number, number];
  status: DownloadStatus;
  progress: number;
  createdAt: string;
  url?: string;
  error?: string;
  params?: Record<string, unknown>;
  pipelineKind?: "fire" | "flood";
  pipelineLog?: string[];
}

const STORAGE_KEY = "c2-downloads";

function loadItems(): DownloadItem[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
  } catch {
    return [];
  }
}

function saveItems(items: DownloadItem[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  } catch { /* storage full or blocked */ }
}

function uid(): string {
  return `dl_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export function getDownloads(): DownloadItem[] {
  return loadItems();
}

export function addDownload(item: Omit<DownloadItem, "id" | "createdAt" | "status" | "progress">): DownloadItem {
  const dl: DownloadItem = {
    ...item,
    id: uid(),
    createdAt: new Date().toISOString(),
    status: "preparing",
    progress: 0,
  };
  const items = loadItems();
  items.unshift(dl);
  saveItems(items);
  window.dispatchEvent(new CustomEvent("c2:downloads-changed"));
  return dl;
}

export function updateDownload(id: string, patch: Partial<DownloadItem>) {
  const items = loadItems();
  const idx = items.findIndex((i) => i.id === id);
  if (idx >= 0) {
    items[idx] = { ...items[idx], ...patch };
    saveItems(items);
    window.dispatchEvent(new CustomEvent("c2:downloads-changed"));
  }
}

export function removeDownload(id: string) {
  const items = loadItems().filter((i) => i.id !== id);
  saveItems(items);
  window.dispatchEvent(new CustomEvent("c2:downloads-changed"));
}

/**
 * Prépare un téléchargement GeoTIFF via GeoServer WCS.
 * Met à jour la progression et lance le téléchargement du blob.
 */
export async function prepareDownload(item: DownloadItem): Promise<void> {
  updateDownload(item.id, { status: "preparing", progress: 5 });

  const [west, south, east, north] = item.bbox;
  const wcsUrl = `/geoserver/ows?service=WCS&version=2.0.1` +
    `&request=GetCoverage&CoverageId=${encodeURIComponent(item.layerName)}` +
    `&format=image/tiff` +
    `&subset=Long(${west},${east})` +
    `&subset=Lat(${south},${north})`;

  try {
    const response = await fetch(wcsUrl);
    if (!response.ok) {
      const text = await response.text().catch(() => "");
      throw new Error(text.slice(0, 200) || `HTTP ${response.status}`);
    }

    const contentLength = Number(response.headers.get("Content-Length") || 0);
    const reader = response.body?.getReader();

    if (!reader) {
      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);
      updateDownload(item.id, { status: "ready", progress: 100, url: blobUrl });
      return;
    }

    const chunks: Uint8Array[] = [];
    let received = 0;

    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
      received += value.length;
      const pct = contentLength > 0
        ? Math.min(95, Math.round((received / contentLength) * 95))
        : Math.min(90, 10 + Math.floor(received / 1024 / 10));
      updateDownload(item.id, { progress: pct });
    }

    const blob = new Blob(chunks as BlobPart[], { type: "image/tiff" });
    const blobUrl = URL.createObjectURL(blob);
    updateDownload(item.id, { status: "ready", progress: 100, url: blobUrl });
  } catch (err) {
    updateDownload(item.id, {
      status: "failed",
      error: err instanceof Error ? err.message : "Erreur lors de la préparation",
    });
  }
}

export function triggerBrowserDownload(item: DownloadItem) {
  if (!item.url) return;
  const a = document.createElement("a");
  a.href = item.url;
  a.download = `${item.label.replace(/\s+/g, "_")}.tif`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  updateDownload(item.id, { status: "downloading" });
}

/**
 * Lance un pipeline STAC (fire-assessment ou flood-assessment) via adminPlugin,
 * crée un item dans les téléchargements, et poll jusqu'à la fin.
 * Quand le pipeline finit, prépare le téléchargement WCS du COG résultant.
 */
export async function startPipelineDownload(
  kind: "fire" | "flood",
  params: Record<string, unknown>,
  label: string,
  bbox: [number, number, number, number],
): Promise<DownloadItem> {
  const endpoint = kind === "fire" ? "/__admin/fire-assessment" : "/__admin/flood-assessment";

  const dl = addDownload({
    label,
    type: kind === "fire" ? "burn_assessment" : "flood_assessment",
    layerName: "",
    bbox,
    pipelineKind: kind,
    pipelineLog: [],
  });
  updateDownload(dl.id, { status: "pipeline", progress: 5 });

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(params),
    });
    if (response.status === 409) {
      const data = await response.json().catch(() => ({}));
      updateDownload(dl.id, { status: "failed", error: data.error ?? "Un traitement est déjà en cours" });
      return dl;
    }
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      updateDownload(dl.id, { status: "failed", error: data.error ?? `HTTP ${response.status}` });
      return dl;
    }
  } catch (err) {
    updateDownload(dl.id, { status: "failed", error: err instanceof Error ? err.message : "Erreur réseau" });
    return dl;
  }

  pollUntilDone(dl.id, endpoint);
  return dl;
}

async function pollUntilDone(dlId: string, endpoint: string) {
  const poll = async (): Promise<boolean> => {
    try {
      const response = await fetch(endpoint);
      const state = await response.json() as {
        running: boolean;
        exitCode: number | null;
        log: string[];
        finishedAt: string | null;
      };

      const logTail = state.log.slice(-8);
      const progressEstimate = state.running
        ? Math.min(85, 10 + Math.floor((state.log.length / 60) * 75))
        : (state.exitCode === 0 ? 95 : 0);

      updateDownload(dlId, {
        status: state.running ? "pipeline" : (state.exitCode === 0 ? "preparing" : "failed"),
        progress: progressEstimate,
        pipelineLog: logTail,
        error: state.exitCode !== null && state.exitCode !== 0
          ? `Pipeline terminé avec code ${state.exitCode}. ${logTail[logTail.length - 1] ?? ""}`
          : undefined,
      });

      if (!state.running) {
        if (state.exitCode === 0) {
          // Pipeline done — find the last published layer in the logs
          const layerMatch = state.log.join("\n").match(/published (\S+)|layer[:\s]+(\S+geossia:\S+)/i);
          const layerName = layerMatch?.[1] ?? layerMatch?.[2] ?? "";
          if (layerName) {
            updateDownload(dlId, { layerName, progress: 95 });
            const items = loadItems();
            const item = items.find((i) => i.id === dlId);
            if (item) await prepareDownload({ ...item, layerName });
          } else {
            updateDownload(dlId, { status: "ready", progress: 100, pipelineLog: logTail });
          }
        }
        return true;
      }
      return false;
    } catch {
      return false;
    }
  };

  const interval = setInterval(async () => {
    const done = await poll();
    if (done) clearInterval(interval);
  }, 4000);

  // First poll immediately
  const done = await poll();
  if (done) clearInterval(interval);
}
