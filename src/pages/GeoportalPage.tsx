import { useRef, useState } from "react";
import { Link } from "react-router-dom";
import data from "../data/indicators.json";
import { GeoportalMap, type LayerKey, type GeoportalMapHandle } from "../components/GeoportalMap";
import { Sparkline } from "../components/charts";
import { BirdLogo } from "../components/BirdLogo";

const layerDefs: {
  key: LayerKey;
  group: "base" | "thematic";
  name: string;
  desc: string;
  color: string;
}[] = [
  { key: "satellite", group: "base", name: "Satellite", desc: "Esri World Imagery", color: "#3a4a3e" },
  { key: "osm", group: "base", name: "Plan OSM", desc: "OpenStreetMap", color: "#d4e9c1" },
  { key: "topo", group: "base", name: "Topographique", desc: "OpenTopoMap", color: "#c9a86a" },
  { key: "spi3", group: "thematic", name: "SPI-3 par pays", desc: "CHIRPS v2 · alertes OMM", color: "#9c2f1c" },
  { key: "firms", group: "thematic", name: "Feux actifs FIRMS", desc: "NASA MODIS/VIIRS", color: "#e67e22" },
];

const levelLabels = ["", "Normal", "Veille", "Alerte", "Alerte sévère"];

// Tabs for the right-side alerts list
const alertTabs = [
  { key: "all", label: "Tous" },
  { key: "1", label: "Normal" },
  { key: "2", label: "Veille" },
  { key: "3", label: "Alerte" },
  { key: "4", label: "Sévère" },
] as const;

type AlertTabKey = (typeof alertTabs)[number]["key"];

export default function GeoportalPage() {
  const [layers, setLayers] = useState<Record<LayerKey, boolean>>({
    satellite: true,
    osm: false,
    topo: false,
    spi3: true,
    firms: false,
  });
  const [selected, setSelected] = useState<string | undefined>("ML");
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState<AlertTabKey>("all");
  const [viewMode, setViewMode] = useState<"globe" | "plan" | "routes">("globe");
  const mapRef = useRef<GeoportalMapHandle>(null);

  const alert = data.alerts.find((a) => a.code === selected);

  const toggleLayer = (key: LayerKey) => {
    if (key === "osm" || key === "satellite" || key === "topo") {
      setLayers({
        ...layers,
        osm: key === "osm",
        satellite: key === "satellite",
        topo: key === "topo",
      });
    } else {
      setLayers({ ...layers, [key]: !layers[key] });
    }
  };

  // Filter alerts based on tab and search
  const filteredAlerts = data.alerts.filter((a) => {
    const matchesSearch = search
      ? `${a.name} ${a.code}`.toLowerCase().includes(search.toLowerCase())
      : true;
    const matchesTab = activeTab === "all" ? true : String(a.level) === activeTab;
    return matchesSearch && matchesTab;
  });

  // Status distribution for the bar chart card
  const statusBars = data.levels.map((l) => ({
    label: l.label,
    count: l.count,
    color:
      l.level === 1
        ? "#5fa371"
        : l.level === 2
        ? "#c9a86a"
        : l.level === 3
        ? "#d4a24c"
        : "#9c2f1c",
    pct: Math.round((l.count / data.summary.countriesTotal) * 100),
  }));

  // Sparkline bars for the regional anomaly card (synthetic trend)
  const anomalyBars = [0.6, 0.8, 0.5, 1.0, 1.2, 0.9, 1.4, 1.1, 1.3, 1.5, 1.2, 1.42];

  return (
    <div className="geo-shell">
      {/* ===================== TOP BAR ===================== */}
      <header className="geo-topbar">
        <div className="geo-topbar-left">
          <Link to="/" className="geo-brand">
            <span className="geo-brand-mark">
              <BirdLogo size={28} />
            </span>
            <span className="geo-brand-text">
              <strong>GEOSSIA</strong>
              <small>Géoportail Climat</small>
            </span>
          </Link>

          <div className="geo-icon-toolbar" aria-label="Navigation">
            <button className="geo-icon-btn" title="Tableau de bord">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
                <rect x="3" y="3" width="7" height="9" />
                <rect x="14" y="3" width="7" height="5" />
                <rect x="14" y="12" width="7" height="9" />
                <rect x="3" y="16" width="7" height="5" />
              </svg>
            </button>
            <button className="geo-icon-btn" title="Couches">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="12 2 2 7 12 12 22 7 12 2" />
                <polyline points="2 17 12 22 22 17" />
                <polyline points="2 12 12 17 22 12" />
              </svg>
            </button>
            <button className="geo-icon-btn active" title="Géoportail">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6" />
                <line x1="8" y1="2" x2="8" y2="18" />
                <line x1="16" y1="6" x2="16" y2="22" />
              </svg>
            </button>
            <button className="geo-icon-btn" title="Ressources">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
                <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
              </svg>
            </button>
          </div>
        </div>

        <div className="geo-topbar-center">
          <div className="geo-search">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="7" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              type="text"
              placeholder="Rechercher un pays, une ville, un indicateur…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        <div className="geo-topbar-right">
          <button className="geo-btn-ghost" title="Exporter la vue courante">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            Exporter
          </button>
          <button className="geo-btn-dark" title="Nouvelle analyse">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            Nouvelle analyse
          </button>
        </div>
      </header>

      {/* ===================== MAIN AREA ===================== */}
      <div className="geo-main">
        {/* ---------- LEFT KPI COLUMN ---------- */}
        <aside className="geo-kpi-col">
          {/* Card 1 — Regional anomaly */}
          <div className="kpi-card">
            <div className="kpi-card-head">
              <span className="kpi-label">Anomalie régionale</span>
              <span className="kpi-badge up">
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="17 6 23 6 23 12" />
                  <path d="M1 18l7-7 5 5 9-9" />
                </svg>
                +0.18 °C
              </span>
            </div>
            <div className="kpi-value-lg">
              +{data.summary.regionalAnomaly.toFixed(2)}
              <span className="unit">°C</span>
            </div>
            <div className="kpi-sub">
              {data.region} · Bulletin #{data.bulletin}
            </div>
            <div className="kpi-bar-chart" aria-hidden="true">
              {anomalyBars.map((v, i) => (
                <span
                  key={i}
                  className="bar"
                  style={{
                    height: `${(v / Math.max(...anomalyBars)) * 100}%`,
                    background:
                      i === anomalyBars.length - 1
                        ? "var(--forest-2)"
                        : "rgba(45, 90, 61, 0.32)",
                  }}
                />
              ))}
            </div>
            <div className="kpi-bar-axis">
              <span>Sep</span>
              <span>Oct</span>
              <span>Nov</span>
            </div>
          </div>

          {/* Card 2 — Total countries */}
          <div className="kpi-card">
            <div className="kpi-card-head">
              <span className="kpi-label">Pays suivis</span>
              <span className="kpi-sub-sm">Suivi continu</span>
            </div>
            <div className="kpi-value-lg">
              {data.summary.countriesTotal}
              <span className="unit">pays</span>
            </div>
            <div className="kpi-spark">
              <svg viewBox="0 0 200 50" preserveAspectRatio="none" width="100%" height="40">
                <defs>
                  <linearGradient id="sparkFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="rgba(95, 163, 113, 0.45)" />
                    <stop offset="100%" stopColor="rgba(95, 163, 113, 0)" />
                  </linearGradient>
                </defs>
                <path
                  d="M0,30 L20,28 L40,22 L60,25 L80,18 L100,20 L120,12 L140,16 L160,10 L180,14 L200,8 L200,50 L0,50 Z"
                  fill="url(#sparkFill)"
                />
                <path
                  d="M0,30 L20,28 L40,22 L60,25 L80,18 L100,20 L120,12 L140,16 L160,10 L180,14 L200,8"
                  fill="none"
                  stroke="#5fa371"
                  strokeWidth="1.8"
                />
                <circle cx="200" cy="8" r="3" fill="#5fa371" />
              </svg>
              <div className="kpi-tooltip">15 pays</div>
            </div>
          </div>

          {/* Card 3 — Alert status */}
          <div className="kpi-card">
            <div className="kpi-card-head">
              <span className="kpi-label">Statut d'alerte</span>
              <span className="kpi-sub-sm">SPI-3</span>
            </div>
            <div className="kpi-status-grid">
              {statusBars.map((s) => (
                <div key={s.label} className="kpi-status-col">
                  <div className="kpi-status-track">
                    <div
                      className="kpi-status-fill"
                      style={{ height: `${s.pct}%`, background: s.color }}
                    />
                  </div>
                  <div className="kpi-status-num">{s.count}</div>
                  <div className="kpi-status-lbl">{s.label}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Layers mini-section */}
          <div className="kpi-card kpi-layers">
            <div className="kpi-card-head">
              <span className="kpi-label">Couches thématiques</span>
            </div>
            <div className="layer-mini-list">
              {layerDefs
                .filter((l) => l.group === "thematic")
                .map((l) => (
                  <button
                    key={l.key}
                    className={`layer-mini ${layers[l.key] ? "active" : ""}`}
                    onClick={() => toggleLayer(l.key)}
                  >
                    <span className="layer-mini-dot" style={{ background: l.color }} />
                    <span className="layer-mini-text">
                      <strong>{l.name}</strong>
                      <small>{l.desc}</small>
                    </span>
                    <span className={`layer-mini-toggle ${layers[l.key] ? "on" : ""}`}>
                      <span />
                    </span>
                  </button>
                ))}
            </div>

            <div className="kpi-card-head" style={{ marginTop: 14 }}>
              <span className="kpi-label">Fonds de carte</span>
            </div>
            <div className="layer-mini-list">
              {layerDefs
                .filter((l) => l.group === "base")
                .map((l) => (
                  <button
                    key={l.key}
                    className={`layer-mini ${layers[l.key] ? "active" : ""}`}
                    onClick={() => toggleLayer(l.key)}
                  >
                    <span className="layer-mini-dot" style={{ background: l.color }} />
                    <span className="layer-mini-text">
                      <strong>{l.name}</strong>
                      <small>{l.desc}</small>
                    </span>
                    <span className={`layer-mini-toggle ${layers[l.key] ? "on" : ""}`}>
                      <span />
                    </span>
                  </button>
                ))}
            </div>
          </div>

          {/* Indicators catalogue */}
          <div className="kpi-card kpi-indicators">
            <div className="kpi-card-head">
              <span className="kpi-label">Indicateurs climat</span>
              <span className="kpi-sub-sm">{data.indicators.length}</span>
            </div>
            <div className="geo-ind-list">
              {data.indicators.map((ind) => (
                <div key={ind.code} className="geo-ind-item">
                  <div className="geo-ind-head">
                    <span className={`geo-ind-code ${ind.theme}`}>{ind.code}</span>
                    <span className={`geo-ind-trend ${ind.trendDir}`}>
                      {ind.trendDir === "up" ? "↑" : "↓"}
                    </span>
                  </div>
                  <div className="geo-ind-name">{ind.name}</div>
                  <div className="geo-ind-spark">
                    <Sparkline
                      data={ind.trend}
                      color={ind.trendDir === "up" ? "#9c2f1c" : "#2d5a3d"}
                      width={200}
                      height={28}
                    />
                  </div>
                  <div className="geo-ind-foot">
                    <span className="geo-ind-val">{ind.current} <small>{ind.unit}</small></span>
                    <span className="geo-ind-src">{ind.source}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </aside>

        {/* ---------- CENTER MAP ---------- */}
        <section className="geo-map-area">
          <GeoportalMap
            ref={mapRef}
            alerts={data.alerts}
            layers={layers}
            selectedCode={selected}
            onSelect={(code) => setSelected(code)}
          />

          {/* Top overlay — context pills */}
          <div className="geo-map-top">
            <span className="geo-pill">
              <span className="live-dot" />
              Suivi en direct · {data.region}
            </span>
            <span className="geo-pill right">
              SPI-3 moyen : {data.summary.spi3Mean.toFixed(2)}
            </span>
          </div>

          {/* Zoom controls on right side */}
          <div className="geo-zoom-controls">
            <button className="geo-zoom-btn" title="Zoom +" onClick={() => mapRef.current?.zoom(1)}>+</button>
            <button className="geo-zoom-btn" title="Zoom −" onClick={() => mapRef.current?.zoom(-1)}>−</button>
            <button className="geo-zoom-btn" title="Recentrer" onClick={() => mapRef.current?.reset()}>⌖</button>
          </div>

          {/* Bottom — segmented control + filters + legend */}
          <div className="geo-map-bottom">
            <div className="geo-segmented">
              <button
                className={viewMode === "globe" ? "active" : ""}
                onClick={() => setViewMode("globe")}
              >
                Globe
              </button>
              <button
                className={viewMode === "plan" ? "active" : ""}
                onClick={() => setViewMode("plan")}
              >
                Plan
              </button>
              <button
                className={viewMode === "routes" ? "active" : ""}
                onClick={() => setViewMode("routes")}
              >
                Routes
              </button>
            </div>

            <div className="geo-filters">
              <button className="geo-filter-btn" title="Filtres">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
                </svg>
              </button>
              <button className="geo-chip active">Sahel</button>
              <button className="geo-chip">Afrique de l'Ouest</button>
              <button className="geo-chip">Tous</button>
            </div>

            <div className="geo-legend">
              <span className="geo-legend-title">Légende SPI-3</span>
              <ul>
                <li><i style={{ background: "#5fa371" }} /> Normal</li>
                <li><i style={{ background: "#c9a86a" }} /> Veille</li>
                <li><i style={{ background: "#d4a24c" }} /> Alerte</li>
                <li><i style={{ background: "#9c2f1c" }} /> Sévère</li>
              </ul>
            </div>
          </div>

          {/* Bottom-left — selected country preview card */}
          {alert && (
            <div className="geo-preview-card">
              <button
                className="geo-preview-close"
                onClick={() => setSelected(undefined)}
                aria-label="Fermer"
              >
                ×
              </button>
              <div className="geo-preview-flag">
                <span className={`flag-mock ${alert.code.toLowerCase()}`} aria-hidden="true" />
                <div>
                  <strong>{alert.name}</strong>
                  <small>#{alert.code}-2026</small>
                </div>
              </div>
              <div className="geo-preview-route">
                <span className="geo-preview-route-from">{alert.name}</span>
                <span className="geo-preview-route-line">
                  <span className="dash" />
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 10.5a8.5 8.5 0 1 1-3.5-6.86" />
                    <polyline points="21 4 21 10 15 10" />
                  </svg>
                  <span className="dash" />
                </span>
                <span>Niveau {alert.level}</span>
              </div>
              <div className="geo-preview-stats">
                <span>SPI-3</span>
                <strong className={`lvl-${alert.level}`}>{alert.spi3.toFixed(2)}</strong>
              </div>
              <div className="geo-preview-stats">
                <span>Statut</span>
                <strong className={`lvl-${alert.level}`}>{levelLabels[alert.level]}</strong>
              </div>
              <Link to="/" className="geo-preview-cta">
                Fiche complète →
              </Link>
            </div>
          )}
        </section>

        {/* ---------- RIGHT ALERTS LIST ---------- */}
        <aside className="geo-alerts-col">
          <div className="geo-alerts-head">
            <h3>Pays surveillés</h3>
            <span className="geo-alerts-count">{filteredAlerts.length}</span>
          </div>

          <div className="geo-alerts-tabs">
            {alertTabs.map((t) => (
              <button
                key={t.key}
                className={activeTab === t.key ? "active" : ""}
                onClick={() => setActiveTab(t.key)}
              >
                {t.label}
              </button>
            ))}
          </div>

          <div className="geo-alerts-list">
            {filteredAlerts.map((a) => (
              <button
                key={a.code}
                className={`geo-alert-row ${selected === a.code ? "active" : ""}`}
                onClick={() => setSelected(a.code)}
              >
                <div className="geo-alert-row-top">
                  <span className="geo-alert-id">#{a.code}-{1000 + a.code.charCodeAt(0) + a.code.charCodeAt(1)}</span>
                  <span className={`geo-alert-status lvl-${a.level}`}>
                    <i />
                    {levelLabels[a.level]}
                  </span>
                </div>
                <div className="geo-alert-route">
                  <span>{a.name}</span>
                  <span className="geo-alert-route-line">
                    <span className="dash" />
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="1" y="3" width="15" height="13" />
                      <polygon points="16 8 20 8 23 11 23 16 16 16 16 8" />
                      <circle cx="5.5" cy="18.5" r="2.5" />
                      <circle cx="18.5" cy="18.5" r="2.5" />
                    </svg>
                    <span className="dash" />
                  </span>
                  <span>Niv. {a.level}</span>
                </div>
                <div className="geo-alert-progress">
                  <div
                    className="geo-alert-progress-fill"
                    style={{
                      width: `${Math.max(15, Math.min(100, (Math.abs(a.spi3) / 3) * 100))}%`,
                      background:
                        a.level === 1
                          ? "#5fa371"
                          : a.level === 2
                          ? "#c9a86a"
                          : a.level === 3
                          ? "#d4a24c"
                          : "#9c2f1c",
                    }}
                  />
                </div>
              </button>
            ))}
            {filteredAlerts.length === 0 && (
              <div className="geo-alerts-empty">Aucun pays dans cette catégorie.</div>
            )}
          </div>

          <Link to="/" className="geo-alerts-all">
            Voir tous les pays →
          </Link>
        </aside>

        {/* ---------- EXTREME RIGHT — CONNEXION + BULLETIN ---------- */}
        <div className="geo-rail-actions" aria-label="Actions rapides">
          <Link to="/login" className="geo-rail-btn light" title="Se connecter à son compte GEOSSIA">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
              <polyline points="10 17 15 12 10 7" />
              <line x1="15" y1="12" x2="3" y2="12" />
            </svg>
            <span>Connexion</span>
          </Link>
          <Link to="/bulletin" className="geo-rail-btn accent" title="Recevoir le bulletin mensuel par email">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
              <polyline points="22,6 12,13 2,6" />
            </svg>
            <span>S'abonner au bulletin</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
