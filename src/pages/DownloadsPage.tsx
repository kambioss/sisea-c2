import { useCallback, useEffect, useState } from "react";
import "./downloads.css";
import {
  getDownloads,
  prepareDownload,
  triggerBrowserDownload,
  removeDownload,
  type DownloadItem,
} from "../services/downloadService";

const STATUS_LABEL: Record<string, string> = {
  preparing: "Préparation WCS…",
  pipeline: "Traitement satellite en cours…",
  ready: "Prêt",
  failed: "Échec",
  downloading: "Téléchargé",
};

const TYPE_LABEL: Record<string, string> = {
  burn_assessment: "Évaluation post-feu",
  flood_assessment: "Évaluation inondation",
  layer_export: "Export couche",
};

function fmtDate(iso: string) {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleDateString("fr-FR", {
    day: "numeric", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

export default function DownloadsPage() {
  const [items, setItems] = useState<DownloadItem[]>([]);

  const refresh = useCallback(() => setItems(getDownloads()), []);

  useEffect(() => {
    refresh();
    window.addEventListener("c2:downloads-changed", refresh);
    // Auto-refresh while any pipeline is active
    const timer = setInterval(() => {
      const current = getDownloads();
      if (current.some((i) => i.status === "pipeline")) refresh();
    }, 4000);
    return () => { window.removeEventListener("c2:downloads-changed", refresh); clearInterval(timer); };
  }, [refresh]);

  const retry = async (item: DownloadItem) => {
    await prepareDownload({ ...item, status: "preparing", progress: 0 });
  };

  return (
    <>
      <section className="page-hero">
        <div className="page-hero-bg" style={{ background: "var(--c2-surface-dark, #152736)" }} aria-hidden="true" />
        <div className="container page-hero-inner">
          <small className="page-hero-label">Données & Analyses</small>
          <h1>Téléchargements</h1>
          <p>Suivez la progression de vos préparations de données et téléchargez les résultats d'analyses géospatiales.</p>
        </div>
      </section>

      <section className="section tight">
        <div className="container">
          {items.length === 0 ? (
            <div className="dl-empty">
              <div className="dl-empty-icon">📥</div>
              <h3>Aucun téléchargement</h3>
              <p>
                Lancez une évaluation post-feu ou d'inondation depuis le géoportail,
                ou exportez une couche pour la retrouver ici.
              </p>
            </div>
          ) : (
            <div className="dl-list">
              {items.map((item) => (
                <div key={item.id} className={`dl-card dl-${item.status}`}>
                  <div className="dl-card-header">
                    <span className="dl-type-badge">{TYPE_LABEL[item.type] ?? item.type}</span>
                    <span className="dl-date">{fmtDate(item.createdAt)}</span>
                  </div>
                  <h3 className="dl-label">{item.label}</h3>
                  {item.params && (
                    <div className="dl-params">
                      {Object.entries(item.params).map(([k, v]) => (
                        <span key={k}><b>{k}</b>: {String(v)}</span>
                      ))}
                    </div>
                  )}
                  {(item.status === "preparing" || item.status === "pipeline") && (
                    <div className="dl-progress">
                      <div className="dl-progress-bar" style={{ width: `${item.progress}%` }} />
                      <span>{item.progress}%</span>
                    </div>
                  )}
                  {item.status === "pipeline" && item.pipelineLog?.length ? (
                    <div className="dl-pipeline-log">
                      {item.pipelineLog.map((line, i) => <div key={i}>{line}</div>)}
                    </div>
                  ) : null}
                  {item.status === "failed" && (
                    <p className="dl-error">{item.error ?? "Erreur inconnue"}</p>
                  )}
                  <div className="dl-actions">
                    <span className={`dl-status dl-status-${item.status}`}>
                      {STATUS_LABEL[item.status]}
                    </span>
                    {item.status === "ready" && (
                      <button className="dl-btn dl-btn-download" onClick={() => triggerBrowserDownload(item)}>
                        Télécharger GeoTIFF
                      </button>
                    )}
                    {item.status === "downloading" && (
                      <button className="dl-btn dl-btn-download" onClick={() => triggerBrowserDownload(item)}>
                        Re-télécharger
                      </button>
                    )}
                    {item.status === "failed" && (
                      <button className="dl-btn" onClick={() => retry(item)}>
                        Réessayer
                      </button>
                    )}
                    <button className="dl-btn dl-btn-remove" onClick={() => removeDownload(item.id)}>
                      Supprimer
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>
    </>
  );
}
