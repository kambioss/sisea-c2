import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { requestGeePreview, geeResultToTileLayers, type GeeTileLayer } from "../data/geePreview";
import { startPipelineDownload } from "../services/downloadService";

export interface FireAssessmentParams {
  sensor: "sentinel2" | "landsat" | "modis";
  bbox: [number, number, number, number];
  geometry?: Record<string, unknown>;
  before_start: string;
  before_end: string;
  after_start: string;
  after_end: string;
}

export interface FireInitialParams {
  sensor?: "sentinel2" | "landsat" | "modis";
  bbox?: [number, number, number, number];
  before_start?: string;
  before_end?: string;
  after_start?: string;
  after_end?: string;
}

interface Props {
  selectedCountryBbox?: [number, number, number, number] | null;
  initialParams?: FireInitialParams | null;
  onStartDraw(): void;
  onZoneUpload(bbox: [number, number, number, number], geometry: Record<string, unknown>): void;
  onSubmit(params: FireAssessmentParams): void;
  onGeeResult(layers: GeeTileLayer[]): void;
  onClose(): void;
}

const SENSORS = [
  { id: "sentinel2" as const, label: "Sentinel-2 (20 m)", desc: "Haute résolution, zones < 50 km" },
  { id: "landsat" as const, label: "Landsat (30 m)", desc: "Couverture historique depuis 1984" },
  { id: "modis" as const, label: "MODIS (500 m)", desc: "Grandes régions, révision fréquente" },
];

export function FireAssessmentPanel({ selectedCountryBbox, initialParams, onStartDraw, onZoneUpload, onSubmit, onGeeResult, onClose }: Props) {
  const navigate = useNavigate();
  const [sensor, setSensor] = useState<"sentinel2" | "landsat" | "modis">(initialParams?.sensor ?? "sentinel2");
  const [beforeStart, setBeforeStart] = useState(initialParams?.before_start ?? "");
  const [beforeEnd, setBeforeEnd] = useState(initialParams?.before_end ?? "");
  const [afterStart, setAfterStart] = useState(initialParams?.after_start ?? "");
  const [afterEnd, setAfterEnd] = useState(initialParams?.after_end ?? "");
  const [uploadedGeometry, setUploadedGeometry] = useState<Record<string, unknown> | undefined>();
  const [zoneName, setZoneName] = useState("");
  const fileInput = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<"idle" | "running" | "done" | "error">("idle");
  const [error, setError] = useState("");
  const [allLayers, setAllLayers] = useState<GeeTileLayer[]>([]);
  const [activeLayer, setActiveLayer] = useState<string | null>(null);
  const autoTriggered = useRef(false);

  const bbox = selectedCountryBbox;

  useEffect(() => {
    if (autoTriggered.current) return;
    if (!initialParams?.bbox || !initialParams.before_start || !initialParams.after_start) return;
    if (!bbox) return;
    autoTriggered.current = true;
    const fakeEvent = { preventDefault: () => {} } as FormEvent;
    handleSubmit(fakeEvent);
  }, [bbox]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    if (!bbox) {
      setError("Dessinez une zone sur la carte ou importez un fichier de zone.");
      return;
    }
    if (!beforeStart || !beforeEnd || !afterStart || !afterEnd) {
      setError("Toutes les dates sont requises");
      return;
    }
    if (beforeStart >= beforeEnd || beforeEnd > afterStart || afterStart >= afterEnd) {
      setError("Les fenêtres temporelles doivent être : pré-début < pré-fin ≤ post-début < post-fin");
      return;
    }
    const params: FireAssessmentParams = { sensor, bbox, geometry: uploadedGeometry, before_start: beforeStart, before_end: beforeEnd, after_start: afterStart, after_end: afterEnd };
    setStatus("running");

    try {
      const result = await requestGeePreview({
        mode: "fire",
        bbox,
        sensor,
        before_start: beforeStart,
        before_end: beforeEnd,
        after_start: afterStart,
        after_end: afterEnd,
      });
      const tiles = geeResultToTileLayers(result);
      setAllLayers(tiles);
      setStatus("done");
      onSubmit(params);
      if (tiles.length > 0) {
        const severity = tiles.find((t) => t.id.includes("severity"));
        const shown = severity ?? tiles[0];
        setActiveLayer(shown.id);
        onGeeResult([shown]);
      }
    } catch (err) {
      setStatus("error");
      setError(err instanceof Error ? err.message : "L'aperçu GEE n'a pas pu être généré. Réessayez.");
    }
  };

  const switchLayer = (id: string) => {
    setActiveLayer(id);
    const layer = allLayers.find((l) => l.id === id);
    if (layer) onGeeResult([layer]);
  };

  const handleDownload = () => {
    if (!bbox) return;
    startPipelineDownload(
      "fire",
      { sensor, before_start: beforeStart, before_end: beforeEnd, after_start: afterStart, after_end: afterEnd, bbox },
      `Burn Assessment ${sensor} — ${afterStart}`,
      bbox,
    );
    navigate("/telecharger");
  };

  const uploadZone = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setError("");
    try {
      const geometry = parseZoneFile(await file.text(), file.name);
      const fileBbox = geometryBounds(geometry);
      setUploadedGeometry(geometry);
      setZoneName(file.name);
      onZoneUpload(fileBbox, geometry);
    } catch {
      setError("Zone non reconnue. Importez un GeoJSON ou un KML contenant un polygone.");
    } finally {
      event.target.value = "";
    }
  };

  return (
    <div className="map-card fire-assess-card">
      <div className="map-card-head">
        <strong>Évaluation post-feu (dNBR)</strong>
        <button onClick={onClose} title="Fermer">&#x2715;</button>
      </div>
      <form onSubmit={handleSubmit} className="fire-assess-form">
        <label>
          Capteur satellite
          <select value={sensor} onChange={(e) => setSensor(e.target.value as typeof sensor)}>
            {SENSORS.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
          </select>
          <small>{SENSORS.find((s) => s.id === sensor)?.desc}</small>
        </label>

        <fieldset>
          <legend>Fenêtre pré-feu</legend>
          <div className="fire-assess-dates">
            <label>Début <input type="date" value={beforeStart} onChange={(e) => setBeforeStart(e.target.value)} required /></label>
            <label>Fin <input type="date" value={beforeEnd} onChange={(e) => setBeforeEnd(e.target.value)} required /></label>
          </div>
        </fieldset>

        <fieldset>
          <legend>Fenêtre post-feu</legend>
          <div className="fire-assess-dates">
            <label>Début <input type="date" value={afterStart} onChange={(e) => setAfterStart(e.target.value)} required /></label>
            <label>Fin <input type="date" value={afterEnd} onChange={(e) => setAfterEnd(e.target.value)} required /></label>
          </div>
        </fieldset>

        <fieldset>
          <legend>Zone d'intérêt</legend>
          <div className="fire-zone-actions">
            <button type="button" onClick={() => { setUploadedGeometry(undefined); setZoneName(""); onStartDraw(); }}>Dessiner sur la carte</button>
            <button type="button" onClick={() => fileInput.current?.click()}>Importer une zone</button>
            <input ref={fileInput} className="fire-zone-file" type="file" accept=".geojson,.json,.kml,application/geo+json,application/vnd.google-earth.kml+xml" onChange={uploadZone} />
          </div>
          <small>{zoneName ? `Zone importée : ${zoneName}` : bbox ? "Zone prête pour l'analyse" : "GeoJSON ou KML · polygone uniquement"}</small>
        </fieldset>

        {error && <p className="fire-assess-error">{error}</p>}

        {status === "running" && (
          <div className="fire-assess-progress">
            <div className="fire-assess-spinner" />
            <span>Calcul GEE en cours… (10-30 s)</span>
          </div>
        )}

        {status === "done" && allLayers.length > 0 && (
          <div className="fire-assess-done">
            <p>{allLayers.length} couche(s) disponible(s) sur la carte.</p>
            <div className="gee-layer-switch">
              {allLayers.map((l) => (
                <button
                  key={l.id}
                  type="button"
                  className={`gee-layer-btn${activeLayer === l.id ? " on" : ""}`}
                  onClick={() => switchLayer(l.id)}
                >
                  {l.label}
                </button>
              ))}
            </div>
            <button type="button" className="fire-assess-download" onClick={handleDownload}>
              Télécharger (COG haute résolution)
            </button>
          </div>
        )}

        <button type="submit" className="fire-assess-submit" disabled={status === "running"}>
          {status === "running" ? "Calcul en cours…" : status === "done" ? "Relancer l'aperçu" : "Aperçu rapide (GEE)"}
        </button>
      </form>
    </div>
  );
}

function parseZoneFile(text: string, filename: string): Record<string, unknown> {
  if (/\.kml$/i.test(filename)) {
    const xml = new DOMParser().parseFromString(text, "application/xml");
    const coordinates = xml.querySelector("Polygon coordinates")?.textContent?.trim().split(/\s+/).map((item) => item.split(",").slice(0, 2).map(Number));
    if (!coordinates?.length || coordinates.some((point) => point.some(Number.isNaN))) throw new Error("invalid kml");
    return { type: "Polygon", coordinates: [coordinates] };
  }
  const data = JSON.parse(text) as { type?: string; geometry?: Record<string, unknown>; features?: Array<{ geometry?: Record<string, unknown> }>; coordinates?: unknown };
  const geometry = data.type === "FeatureCollection" ? data.features?.[0]?.geometry : data.type === "Feature" ? data.geometry : data;
  if (!geometry || !["Polygon", "MultiPolygon"].includes(String(geometry.type))) throw new Error("invalid geojson");
  return geometry;
}

function geometryBounds(geometry: Record<string, unknown>): [number, number, number, number] {
  const points: number[][] = [];
  const visit = (value: unknown) => {
    if (Array.isArray(value) && value.length >= 2 && typeof value[0] === "number" && typeof value[1] === "number") points.push(value as number[]);
    else if (Array.isArray(value)) value.forEach(visit);
  };
  visit(geometry.coordinates);
  if (!points.length) throw new Error("empty geometry");
  return [Math.min(...points.map((p) => p[0])), Math.min(...points.map((p) => p[1])), Math.max(...points.map((p) => p[0])), Math.max(...points.map((p) => p[1]))];
}
