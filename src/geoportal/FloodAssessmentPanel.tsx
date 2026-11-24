import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { requestGeePreview, geeResultToTileLayers, type GeeTileLayer } from "../data/geePreview";
import { startPipelineDownload } from "../services/downloadService";

export interface FloodAssessmentParams {
  sensor: "sentinel1" | "sentinel2" | "modis";
  bbox: [number, number, number, number];
  before_start: string;
  before_end: string;
  during_start: string;
  during_end: string;
}

interface Props {
  selectedCountryBbox?: [number, number, number, number] | null;
  onSubmit(params: FloodAssessmentParams): void;
  onGeeResult(layers: GeeTileLayer[]): void;
  onClose(): void;
}

export function FloodAssessmentPanel({ selectedCountryBbox, onSubmit, onGeeResult, onClose }: Props) {
  const navigate = useNavigate();
  const [beforeStart, setBeforeStart] = useState("");
  const [beforeEnd, setBeforeEnd] = useState("");
  const [duringStart, setDuringStart] = useState("");
  const [duringEnd, setDuringEnd] = useState("");
  const [status, setStatus] = useState<"idle" | "running" | "done" | "error">("idle");
  const [error, setError] = useState("");
  const [allLayers, setAllLayers] = useState<GeeTileLayer[]>([]);
  const [activeLayer, setActiveLayer] = useState<string | null>(null);

  const bbox = selectedCountryBbox;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    if (!bbox) {
      setError("Dessinez une zone d'étude sur la carte (Shift + glisser) ou sélectionnez un pays.");
      return;
    }
    if (!beforeStart || !beforeEnd || !duringStart || !duringEnd) {
      setError("Toutes les dates sont requises");
      return;
    }
    if (beforeStart >= beforeEnd || beforeEnd > duringStart || duringStart >= duringEnd) {
      setError("Les fenêtres temporelles doivent être : avant-début < avant-fin ≤ pendant-début < pendant-fin");
      return;
    }
    const params: FloodAssessmentParams = { sensor: "sentinel1", bbox, before_start: beforeStart, before_end: beforeEnd, during_start: duringStart, during_end: duringEnd };
    setStatus("running");

    try {
      const result = await requestGeePreview({
        mode: "flood",
        bbox,
        before_start: beforeStart,
        before_end: beforeEnd,
        after_start: duringStart,
        after_end: duringEnd,
      });
      const tiles = geeResultToTileLayers(result);
      setAllLayers(tiles);
      setStatus("done");
      onSubmit(params);
      if (tiles.length > 0) {
        const floodExtent = tiles.find((t) => t.id.includes("flood"));
        const shown = floodExtent ?? tiles[0];
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
      "flood",
      { before_start: beforeStart, before_end: beforeEnd, after_start: duringStart, after_end: duringEnd, bbox },
      `Flood Assessment — ${duringStart}`,
      bbox,
    );
    navigate("/telecharger");
  };

  return (
    <div className="map-card fire-assess-card">
      <div className="map-card-head">
        <strong>Évaluation d'inondation (SAR)</strong>
        <button onClick={onClose} title="Fermer">&#x2715;</button>
      </div>
      <form onSubmit={handleSubmit} className="fire-assess-form">
        <fieldset>
          <legend>Avant inondation (référence)</legend>
          <div className="fire-assess-dates">
            <label>Début <input type="date" value={beforeStart} onChange={(e) => setBeforeStart(e.target.value)} required /></label>
            <label>Fin <input type="date" value={beforeEnd} onChange={(e) => setBeforeEnd(e.target.value)} required /></label>
          </div>
        </fieldset>

        <fieldset>
          <legend>Pendant l'inondation</legend>
          <div className="fire-assess-dates">
            <label>Début <input type="date" value={duringStart} onChange={(e) => setDuringStart(e.target.value)} required /></label>
            <label>Fin <input type="date" value={duringEnd} onChange={(e) => setDuringEnd(e.target.value)} required /></label>
          </div>
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
