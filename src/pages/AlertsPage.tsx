import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import capLogo from "../cap-logo.png";
import { subscribeSapLayer } from "../services/alertsCache";
import type { SapLayerSnapshot, SapLayerState } from "../services/alertsCache";

/* ════════════════════════════════════════════════════════════════════════
   Page Alertes — surveillance multirisque.
   01 · Inondations : Google Flood Forecasting (WFS flood_gauge_status +
        flash_flood_event).
   02 · Sécheresse  : SAP sécheresse (WFS drought_alert_region_current /
        drought_alert_country_current, migration 0051) — trois horizons.
   03 · Feux        : SAP feux (WFS fire_alert_region_current,
        migration 0035) — GWIS FWI + FIRMS détections.
   ════════════════════════════════════════════════════════════════════════ */

const WFS = (typeNames: string, extra: Record<string, string> = {}) =>
  `/geoserver/geossia/ows?${new URLSearchParams({
    service: "WFS", version: "2.0.0", request: "GetFeature",
    typeNames, outputFormat: "application/json", ...extra,
  })}`;

const regionNames = new Intl.DisplayNames(["fr"], { type: "region" });
function countryLabel(code: string) {
  if (GAUL_TERRITORY_LABELS[code]) return GAUL_TERRITORY_LABELS[code];
  try { return regionNames.of(code) || code; } catch { return code; }
}

function fmtDate(iso?: string) {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleDateString("fr-FR", {
    weekday: "long", day: "numeric", month: "long", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

function fmtDay(iso?: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleDateString("fr-FR", { day: "numeric", month: "long" });
}

/* GeoServer renvoie les bbox WFS en axes lat,lon : [minLat, minLon, maxLat, maxLon] —
   converti ici en [ouest, sud, est, nord] pour le Géoportail. */
function bboxToBox(bbox?: number[] | null): [number, number, number, number] | null {
  if (!bbox || bbox.length < 4) return null;
  return [bbox[1], bbox[0], bbox[3], bbox[2]];
}

/* GAUL 2024 code « x... » les territoires sans ISO 3166 (disputés ou îles du
   cadrage Afrique) : Intl.DisplayNames ne les résout pas et les couches SAP
   affichaient le code brut (« xMS »). Étiquettes françaises de référence. */
const GAUL_TERRITORY_LABELS: Record<string, string> = {
  xAB: "Abyei",
  xHT: "Triangle de Hala'ib",
  xIT: "Triangle d'Ilemi",
  xMS: "Bīr Ṭawīl",
  xFR: "Îles Éparses",
};

/* Les 14 régions GAUL 2024 livrées sans toponyme (« Administrative Unit Not
   Available ») : noms repris du pays parent. La migration 0063 corrige la
   base ; cette table couvre les émissions encore en cache navigateur et sert
   de repli immédiat pendant que la localité la plus proche est résolue. */
const GAUL_ZONE_FALLBACK_NAMES: Record<string, string> = {
  "xAB.1000": "Abyei",
  "xHT.1349": "Triangle de Hala'ib",
  "xIT.1351": "Triangle d'Ilemi",
  "xMS.1132": "Bīr Ṭawīl",
  "ATF.1303": "Terres australes françaises",
  "BVT.1100": "Île Bouvet",
  "ESH.1710": "Sahara occidental",
  "HMD.1350": "Îles Heard-et-MacDonald",
  "MYT.1473": "Mayotte",
  "xFR.1070": "Bassas da India",
  "xFR.1302": "Île Europa",
  "xFR.1331": "Îles Glorieuses",
  "xFR.1352": "Île Juan de Nova",
  "xFR.1650": "Île Tromelin",
};

const UNNAMED_ZONE_NAME = "administrative unit not available";
function isUnnamedZone(name?: string | null): boolean {
  return !name || name.toLowerCase() === UNNAMED_ZONE_NAME;
}

/* Lien profond vers le Géoportail : épingle le lieu de l'alerte, cadre la vue
   et demande la couche thématique correspondant au risque. */
function geoportalAlertHref(
  lon: number,
  lat: number,
  theme: "inondations" | "secheresse" | "feux",
  bbox?: [number, number, number, number],
  source?: { raster?: string; product?: string },
): string {
  const query = new URLSearchParams({ focus: `${lon.toFixed(4)},${lat.toFixed(4)}`, theme });
  if (bbox) query.set("bbox", bbox.map((value) => value.toFixed(3)).join(","));
  if (source?.raster) query.set("raster", source.raster);
  if (source?.product) query.set("product", source.product);
  return `/geoportail?${query.toString()}`;
}

/* ───────────────────────── Inondations (existant) ─────────────────────── */

interface GaugeFeature {
  geometry: { coordinates: [number, number] };
  properties: {
    gauge_id?: string;
    country?: string;
    severity?: string;
    forecast_trend?: string;
    issued_time?: string;
  };
}

interface FlashFeature {
  geometry?: { type?: string; coordinates?: unknown };
  properties: {
    event_id?: string;
    likelihood?: string;
    country_codes?: string[];
    forecast_period_hours?: number;
  };
}

function geometryCenter(coordinates: unknown): [number, number] | null {
  const points: [number, number][] = [];
  const visit = (value: unknown) => {
    if (!Array.isArray(value)) return;
    if (value.length >= 2 && typeof value[0] === "number" && typeof value[1] === "number") {
      points.push([value[0], value[1]]);
      return;
    }
    value.forEach(visit);
  };
  visit(coordinates);
  if (!points.length) return null;
  const xs = points.map(([x]) => x);
  const ys = points.map(([, y]) => y);
  return [(Math.min(...xs) + Math.max(...xs)) / 2, (Math.min(...ys) + Math.max(...ys)) / 2];
}

const SEVERITY_MAP: Record<string, { label: string; color: string }> = {
  EXTREME_DANGER: { label: "Extrême",       color: "#d32f2f" },
  DANGER:         { label: "Danger",         color: "#e65100" },
  WARNING:        { label: "Avertissement",  color: "#f9a825" },
  ABOVE_NORMAL:   { label: "Vigilance",      color: "#fbc02d" },
};

interface ActiveGauge {
  gaugeId: string;
  country: string;
  severity: string;
  trend: string;
  issuedTime: string;
  lon: number;
  lat: number;
}

async function reverseGeocode(lat: number, lon: number): Promise<string> {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json&zoom=10&accept-language=fr`,
    );
    if (!res.ok) return "";
    const data = await res.json();
    const a = data.address ?? {};
    const city = a.city || a.town || a.village || a.county || "";
    const state = a.state || "";
    const country = a.country || "";
    const unique = [city, state !== city ? state : "", country && country !== state && country !== city ? country : ""].filter(Boolean);
    return unique.join(", ") || "";
  } catch {
    return "";
  }
}

const GAUL_ZONE_CONTEXTS: Record<string, string> = {
  "xAB.1000": "Frontière Soudan–Soudan du Sud",
  "xHT.1349": "Frontière Égypte–Soudan",
  "xIT.1351": "Frontière Kenya–Soudan du Sud",
  "xMS.1132": "Entre l’Égypte et le Soudan",
  "xFR.1070": "Canal du Mozambique",
  "xFR.1302": "Canal du Mozambique",
  "xFR.1331": "Canal du Mozambique",
  "xFR.1352": "Canal du Mozambique",
  "xFR.1650": "Océan Indien",
};

function zoneDisplayName(zone: { iso3: string; zone_key: string; zone_name: string }): string {
  const name = zone.zone_name?.trim();
  if (!isUnnamedZone(name) && name.toUpperCase() !== zone.iso3.toUpperCase()) return name;
  return GAUL_ZONE_FALLBACK_NAMES[zone.zone_key]
    ?? GAUL_TERRITORY_LABELS[zone.iso3]
    ?? countryLabel(zone.iso3.length === 3 ? iso3to2(zone.iso3) : zone.iso3);
}

function zoneDisplayContext(zone: { iso3: string; zone_key: string }): string {
  return GAUL_ZONE_CONTEXTS[zone.zone_key]
    ?? countryLabel(zone.iso3.length === 3 ? iso3to2(zone.iso3) : zone.iso3);
}

/* ───────────────────────── Sécheresse (SAP) ───────────────────────────── */

type HorizonClass = "court" | "moyen" | "long";

interface DroughtZone {
  zone_key: string;
  iso3: string;
  zone_name: string;
  issue_date?: string;
  alert_level_now?: number | null;
  level_j5?: number | null;
  level_j10?: number | null;
  level_j15?: number | null;
  level_m1?: number | null;
  level_m3?: number | null;
  level_m6?: number | null;
  level_court?: number | null;
  level_moyen?: number | null;
  level_long?: number | null;
  peak_alert_level?: number | null;
  peak_horizon?: string | null;
  trend?: string | null;
  alert_type?: string | null;
  spi_now?: number | null;
  vhi_now?: number | null;
  spi_source_date?: string | null;
  vhi_source_date?: string | null;
  gdo_source_date?: string | null;
}

const DROUGHT_PROPS = [
  "zone_key", "iso3", "zone_name", "issue_date", "alert_level_now",
  "level_j5", "level_j10", "level_j15", "level_m1", "level_m3", "level_m6",
  "level_court", "level_moyen", "level_long", "peak_alert_level",
  "peak_horizon", "trend", "alert_type", "spi_now", "vhi_now",
  "spi_source_date", "gdo_source_date",
].join(",");

const DROUGHT_LEVELS: Record<number, { label: string; color: string }> = {
  3: { label: "Alerte",        color: "#b3261e" },
  2: { label: "Avertissement", color: "#e07b1f" },
  1: { label: "Veille",        color: "#e8c227" },
  0: { label: "Normal",        color: "#9fb3c8" },
};

const HORIZONS: { id: HorizonClass; label: string; sub: string; attr: string }[] = [
  { id: "court", label: "Court terme",  sub: "≤ 15 jours",  attr: "level_court" },
  { id: "moyen", label: "Moyen terme",  sub: "1 – 3 mois",  attr: "level_moyen" },
  { id: "long",  label: "Long terme",   sub: "6 mois",      attr: "level_long" },
];

const TRAJECTORY: { key: keyof DroughtZone; label: string; cls: HorizonClass }[] = [
  { key: "level_j5",  label: "J+5",  cls: "court" },
  { key: "level_j10", label: "J+10", cls: "court" },
  { key: "level_j15", label: "J+15", cls: "court" },
  { key: "level_m1",  label: "1 mois", cls: "moyen" },
  { key: "level_m3",  label: "3 mois", cls: "moyen" },
  { key: "level_m6",  label: "6 mois", cls: "long" },
];

function levelOf(zone: DroughtZone, attr: string): number {
  const v = (zone as unknown as Record<string, unknown>)[attr];
  return typeof v === "number" ? v : 0;
}

function TrajectoryDots({ zone }: { zone: DroughtZone }) {
  return (
    <span className="drought-traj" aria-label="Trajectoire J+5 à 6 mois">
      {TRAJECTORY.map((t) => {
        const raw = zone[t.key];
        const known = typeof raw === "number";
        const lvl = known ? (raw as number) : 0;
        return (
          <i
            key={t.key}
            className={known ? "" : "unknown"}
            style={known ? { background: DROUGHT_LEVELS[lvl].color } : undefined}
            title={`${t.label} : ${known ? DROUGHT_LEVELS[lvl].label : "non évalué"}`}
          />
        );
      })}
    </span>
  );
}

const TREND_LABEL: Record<string, string> = {
  worsening: "Hausse prévue J+3 ↗",
  improving: "Baisse prévue J+3 ↘",
  stable: "Stable sur 3 j →",
};

function DroughtSection() {
  const navigate = useNavigate();
  const [regionSnapshot, setRegionSnapshot] = useState<SapLayerSnapshot<DroughtZone> | null>(null);
  const [countrySnapshot, setCountrySnapshot] = useState<SapLayerSnapshot<DroughtZone> | null>(null);
  const [regionFailed, setRegionFailed] = useState(false);
  const [countryFailed, setCountryFailed] = useState(false);
  const [horizon, setHorizon] = useState<HorizonClass>("court");
  const [levelFilter, setLevelFilter] = useState<2 | 3 | null>(null);

  useEffect(() => {
    const onLayer = (
      setSnapshot: (snapshot: SapLayerSnapshot<DroughtZone> | null) => void,
      setFailed: (failed: boolean) => void,
    ) => (layerState: SapLayerState<DroughtZone>) => {
      if (layerState.status === "ready") {
        setSnapshot(layerState.snapshot);
        setFailed(false);
      } else {
        setFailed(layerState.status === "error");
      }
    };
    const unsubscribeRegion = subscribeSapLayer<DroughtZone>(
      "geossia:drought_alert_region_current",
      WFS("geossia:drought_alert_region_current", { propertyName: DROUGHT_PROPS }),
      onLayer(setRegionSnapshot, setRegionFailed),
    );
    const unsubscribeCountry = subscribeSapLayer<DroughtZone>(
      "geossia:drought_alert_country_current",
      WFS("geossia:drought_alert_country_current", { propertyName: DROUGHT_PROPS }),
      onLayer(setCountrySnapshot, setCountryFailed),
    );
    return () => { unsubscribeRegion(); unsubscribeCountry(); };
  }, []);

  const regions = useMemo(
    () => regionSnapshot?.features.map((f) => f.properties) ?? [],
    [regionSnapshot],
  );
  const countries = useMemo(
    () => countrySnapshot?.features.map((f) => f.properties) ?? [],
    [countrySnapshot],
  );
  const boxes = useMemo(() => {
    const map = new Map<string, [number, number, number, number]>();
    for (const f of regionSnapshot?.features ?? []) {
      const box = bboxToBox(f.bbox);
      if (box) map.set(f.properties.zone_key, box);
    }
    return map;
  }, [regionSnapshot]);
  const state: "loading" | "ready" | "error" =
    regionSnapshot && countrySnapshot ? "ready"
      : regionFailed || countryFailed ? "error"
        : "loading";

  const active = HORIZONS.find((h) => h.id === horizon)!;

  const counts = useMemo(() => {
    const c = { 1: 0, 2: 0, 3: 0 };
    for (const z of regions) {
      const lvl = levelOf(z, active.attr);
      if (lvl >= 1) c[Math.min(lvl, 3) as 1 | 2 | 3] += 1;
    }
    return c;
  }, [regions, active.attr]);

  const ranked = useMemo(() => {
    return regions
      .filter((z) => levelOf(z, active.attr) >= 2)
      .sort((a, b) =>
        levelOf(b, active.attr) - levelOf(a, active.attr) ||
        (b.peak_alert_level ?? 0) - (a.peak_alert_level ?? 0) ||
        zoneDisplayName(a).localeCompare(zoneDisplayName(b), "fr"));
  }, [regions, active.attr]);

  const countriesOnAlert = useMemo(
    () => new Set(ranked.map((z) => z.iso3)).size,
    [ranked],
  );

  const visible = useMemo(
    () => (levelFilter === null
      ? ranked
      : ranked.filter((z) => Math.min(levelOf(z, active.attr), 3) === levelFilter)),
    [ranked, active.attr, levelFilter],
  );

  const openZone = (zoneKey: string) => {
    const box = boxes.get(zoneKey);
    if (!box) return;
    const source = horizon === "court"
      ? { raster: "raster-spi-forecast-5d" }
      : { product: horizon === "moyen" ? "gdo_fcst_3m" : "gdo_fcst_6m" };
    navigate(geoportalAlertHref((box[0] + box[2]) / 2, (box[1] + box[3]) / 2, "secheresse", box, source));
  };

  const issue = regions[0]?.issue_date;
  const spiDate = regions.find((z) => z.spi_source_date)?.spi_source_date;
  const vhiDate = regions.find((z) => z.vhi_source_date)?.vhi_source_date;
  const gdoDate = regions.find((z) => z.gdo_source_date)?.gdo_source_date;
  const countryByIso = useMemo(() => {
    const m = new Map<string, DroughtZone>();
    for (const c of countries) m.set(c.iso3, c);
    return m;
  }, [countries]);

  return (
    <>
      <div className={`flood-state ${state}`}>
        <i />
        <span>
          <strong>
            {state === "loading"
              ? "Chargement de l'évaluation sécheresse…"
              : state === "error"
                ? "Évaluation sécheresse momentanément indisponible"
                : "Alertes sécheresse"}
          </strong>
          <small>
            {state === "ready"
              ? <>Émission du {fmtDay(issue)} · SPI prévisionnel CHIRPS3+GEFS du {fmtDay(spiDate)}{vhiDate && <> · VHI NOAA du {fmtDay(vhiDate)}</>} · GDO Copernicus du {fmtDay(gdoDate)}</>
              : "SAP sécheresse GEOSSIA · SPI prévisionnel × VHI (CDI) + GDO saisonnier"}
          </small>
        </span>
      </div>

      {state === "ready" && (
        <>
          {/* ── Sélecteur d'horizon ── */}
          <div className="horizon-tabs" role="tablist" aria-label="Horizon de prévision">
            {HORIZONS.map((h) => (
              <button
                key={h.id}
                role="tab"
                aria-selected={horizon === h.id}
                className={horizon === h.id ? "active" : ""}
                onClick={() => setHorizon(h.id)}
              >
                <strong>{h.label}</strong>
                <small>{h.sub}</small>
              </button>
            ))}
          </div>

          {/* ── Compteurs — cliquables, filtrent la liste et la carte ── */}
          <div className="cap-stats">
            <button type="button" className={`cap-stat cap-stat--filter${counts[3] > 0 ? " cap-stat--alert" : ""}${levelFilter === 3 ? " active" : ""}`} aria-pressed={levelFilter === 3} onClick={() => setLevelFilter(levelFilter === 3 ? null : 3)}>
              <span className="cap-stat-num" style={counts[3] > 0 ? { color: DROUGHT_LEVELS[3].color } : undefined}>{counts[3]}</span>
              <span className="cap-stat-label">Alerte</span>
            </button>
            <button type="button" className={`cap-stat cap-stat--filter${levelFilter === 2 ? " active" : ""}`} aria-pressed={levelFilter === 2} onClick={() => setLevelFilter(levelFilter === 2 ? null : 2)}>
              <span className="cap-stat-num" style={counts[2] > 0 ? { color: DROUGHT_LEVELS[2].color } : undefined}>{counts[2]}</span>
              <span className="cap-stat-label">Avertissement</span>
            </button>
            <div className="cap-stat">
              <span className="cap-stat-num">{countriesOnAlert}</span>
              <span className="cap-stat-label">Pays/zone concernés</span>
            </div>
          </div>

          {/* ── Zones en alerte, triées par sévérité — clic → Géoportail ── */}
          {ranked.length > 0 ? (
            <div className="cap-countries">
              <h3>Régions en alerte ou avertissement — {active.label.toLowerCase()} ({active.sub})</h3>
              {visible.length > 0 ? (
                <ul>
                  {visible.map((z) => {
                    const lvl = DROUGHT_LEVELS[Math.min(levelOf(z, active.attr), 3)];
                    const national = countryByIso.get(z.iso3);
                    return (
                      <li key={z.zone_key} title="Voir la région sur le Géoportail" onClick={() => openZone(z.zone_key)}>
                        <div className="cap-country-left">
                          <span className="cap-country-dot" style={{ background: lvl.color }} />
                          <div>
                            <span className="cap-country-sev" style={{ color: lvl.color }}>{lvl.label}</span>
                            <span className="cap-country-detail">
                              {TREND_LABEL[z.trend ?? ""] ?? "Tendance inconnue"}
                              {typeof z.spi_now === "number" && <>{" · "}SPI {z.spi_now.toFixed(1)}</>}
                              {typeof z.vhi_now === "number" && <>{" · "}VHI {Math.round(z.vhi_now)}</>}
                              {national && (national.alert_level_now ?? 0) >= 1 && " · pays en vigilance"}
                            </span>
                          </div>
                        </div>
                        <div className="cap-country-right">
                          <span className="cap-country-name">{zoneDisplayName(z)}</span>
                          <span className="cap-country-date">{zoneDisplayContext(z)}</span>
                          <TrajectoryDots zone={z} />
                        </div>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <p className="muted">Aucune région à ce niveau de sévérité sur cet horizon.</p>
              )}
            </div>
          ) : (
            <div className="flood-empty">
              <h2>Aucune alerte sécheresse — {active.label.toLowerCase()}</h2>
              <p>
                Aucune des {regions.length} régions évaluées ne dépasse le seuil d'avertissement
                sur cet horizon ({active.sub}).
              </p>
            </div>
          )}
        </>
      )}
    </>
  );
}

/* ───────────────────────── Feux (SAP 2) ─────────────────────────────── */

interface FireZone {
  zone_key: string;
  iso3: string;
  zone_name: string;
  issue_date?: string;
  alert_level_now?: number | null;
  peak_alert_level?: number | null;
  peak_lead_days?: number | null;
  alert_type?: string | null;
  trend?: string | null;
  danger_level_now?: number | null;
  detections_24h?: number | null;
  detections_7d?: number | null;
  frp_24h_mw?: number | null;
  fire_activity_level?: number | null;
  share_p90?: number | null;
  share_p95?: number | null;
}

const FIRE_PROPS = [
  "zone_key", "iso3", "zone_name", "issue_date", "alert_level_now",
  "peak_alert_level", "peak_lead_days", "alert_type", "trend",
  "danger_level_now", "detections_24h", "detections_7d", "frp_24h_mw",
  "fire_activity_level", "share_p90", "share_p95",
].join(",");

const FIRE_LEVELS: Record<number, { label: string; color: string }> = {
  3: { label: "Alerte",        color: "#b3261e" },
  2: { label: "Avertissement", color: "#e07b1f" },
  1: { label: "Veille",        color: "#e8c227" },
  0: { label: "Normal",        color: "#9fb3c8" },
};

function FireSection() {
  const navigate = useNavigate();
  const [snapshot, setSnapshot] = useState<SapLayerSnapshot<FireZone> | null>(null);
  const [failed, setFailed] = useState(false);
  const [levelFilter, setLevelFilter] = useState<2 | 3 | null>(null);

  useEffect(() => {
    const unsubscribe = subscribeSapLayer<FireZone>(
      "geossia:fire_alert_region_current",
      WFS("geossia:fire_alert_region_current", { propertyName: FIRE_PROPS }),
      (layerState: SapLayerState<FireZone>) => {
        if (layerState.status === "ready") {
          setSnapshot(layerState.snapshot);
          setFailed(false);
        } else {
          setFailed(layerState.status === "error");
        }
      },
    );
    return unsubscribe;
  }, []);

  const regions = useMemo(
    () => snapshot?.features.map((f) => f.properties) ?? [],
    [snapshot],
  );
  const boxes = useMemo(() => {
    const map = new Map<string, [number, number, number, number]>();
    for (const f of snapshot?.features ?? []) {
      const box = bboxToBox(f.bbox);
      if (box) map.set(f.properties.zone_key, box);
    }
    return map;
  }, [snapshot]);
  const state: "loading" | "ready" | "error" = snapshot ? "ready" : failed ? "error" : "loading";

  const ranked = useMemo(() =>
    regions
      .filter((z) => (z.alert_level_now ?? 0) >= 2)
      .sort((a, b) =>
        (b.alert_level_now ?? 0) - (a.alert_level_now ?? 0) ||
        (b.peak_alert_level ?? 0) - (a.peak_alert_level ?? 0) ||
        zoneDisplayName(a).localeCompare(zoneDisplayName(b), "fr")),
    [regions],
  );

  const counts = useMemo(() => {
    const c = { 1: 0, 2: 0, 3: 0 };
    for (const z of regions) {
      const lvl = z.alert_level_now ?? 0;
      if (lvl >= 1) c[Math.min(lvl, 3) as 1 | 2 | 3] += 1;
    }
    return c;
  }, [regions]);

  const countriesOnAlert = useMemo(
    () => new Set(ranked.map((z) => z.iso3)).size,
    [ranked],
  );

  const visible = useMemo(
    () => (levelFilter === null
      ? ranked
      : ranked.filter((z) => Math.min(z.alert_level_now ?? 0, 3) === levelFilter)),
    [ranked, levelFilter],
  );

  const openZone = (zoneKey: string) => {
    const box = boxes.get(zoneKey);
    if (!box) return;
    navigate(geoportalAlertHref((box[0] + box[2]) / 2, (box[1] + box[3]) / 2, "feux", box));
  };

  const issue = regions[0]?.issue_date;

  return (
    <>
      <div className={`flood-state ${state}`}>
        <i />
        <span>
          <strong>
            {state === "loading"
              ? "Chargement de l'évaluation feux…"
              : state === "error"
                ? "Évaluation feux momentanément indisponible"
                : "Alertes feux de végétation"}
          </strong>
          <small>
            {state === "ready"
              ? <>Émission du {fmtDay(issue)} · GWIS ECMWF/GEFF (FWI) + NASA FIRMS (détections)</>
              : "SAP feux GEOSSIA · Indice FWI ECMWF (GWIS) × détections FIRMS"}
          </small>
        </span>
      </div>

      {state === "ready" && (
        <>
          <div className="cap-stats">
            <button type="button" className={`cap-stat cap-stat--filter${counts[3] > 0 ? " cap-stat--alert" : ""}${levelFilter === 3 ? " active" : ""}`} aria-pressed={levelFilter === 3} onClick={() => setLevelFilter(levelFilter === 3 ? null : 3)}>
              <span className="cap-stat-num" style={counts[3] > 0 ? { color: FIRE_LEVELS[3].color } : undefined}>{counts[3]}</span>
              <span className="cap-stat-label">Alerte</span>
            </button>
            <button type="button" className={`cap-stat cap-stat--filter${levelFilter === 2 ? " active" : ""}`} aria-pressed={levelFilter === 2} onClick={() => setLevelFilter(levelFilter === 2 ? null : 2)}>
              <span className="cap-stat-num" style={counts[2] > 0 ? { color: FIRE_LEVELS[2].color } : undefined}>{counts[2]}</span>
              <span className="cap-stat-label">Avertissement</span>
            </button>
            <div className="cap-stat">
              <span className="cap-stat-num">{countriesOnAlert}</span>
              <span className="cap-stat-label">Pays/zone concernés</span>
            </div>
          </div>

          {ranked.length > 0 ? (
            <div className="cap-countries">
              <h3>Régions en alerte ou avertissement — danger feux</h3>
              {visible.length > 0 ? (
                <ul>
                  {visible.map((z) => {
                    const lvl = FIRE_LEVELS[Math.min(z.alert_level_now ?? 0, 3)];
                    return (
                      <li key={z.zone_key} title="Voir la région sur le Géoportail" onClick={() => openZone(z.zone_key)}>
                        <div className="cap-country-left">
                          <span className="cap-country-dot" style={{ background: lvl.color }} />
                          <div>
                            <span className="cap-country-sev" style={{ color: lvl.color }}>{lvl.label}</span>
                            <span className="cap-country-detail">
                              {TREND_LABEL[z.trend ?? ""] ?? "Tendance inconnue"}
                              {typeof z.detections_24h === "number" && z.detections_24h > 0 && <>{" · "}{z.detections_24h} foyers 24h</>}
                              {typeof z.detections_7d === "number" && z.detections_7d > 0 && <>{" · "}{z.detections_7d} foyers 7j</>}
                              {typeof z.share_p95 === "number" && z.share_p95 > 0 && <>{" · "}{Math.round(z.share_p95 * 100)}% surface FWI ≥ P95</>}
                            </span>
                          </div>
                        </div>
                        <div className="cap-country-right">
                          <span className="cap-country-name">{zoneDisplayName(z)}</span>
                          <span className="cap-country-date">{zoneDisplayContext(z)}</span>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <p className="muted">Aucune région à ce niveau de sévérité.</p>
              )}
            </div>
          ) : (
            <div className="flood-empty">
              <h2>Aucune alerte feux active</h2>
              <p>
                Aucune des {regions.length} régions évaluées ne dépasse le seuil d'avertissement
                pour le danger de feux de végétation.
              </p>
            </div>
          )}
        </>
      )}
    </>
  );
}

/* ISO3 -> ISO2 pour Intl.DisplayNames (pays africains + bordures du cadrage). */
const ISO3TO2: Record<string, string> = {
  AGO: "AO", BDI: "BI", BEN: "BJ", BFA: "BF", BWA: "BW", CAF: "CF", CIV: "CI",
  CMR: "CM", COD: "CD", COG: "CG", COM: "KM", CPV: "CV", DJI: "DJ", DZA: "DZ",
  EGY: "EG", ERI: "ER", ESH: "EH", ETH: "ET", GAB: "GA", GHA: "GH", GIN: "GN",
  GMB: "GM", GNB: "GW", GNQ: "GQ", KEN: "KE", LBR: "LR", LBY: "LY", LSO: "LS",
  MAR: "MA", MDG: "MG", MLI: "ML", MOZ: "MZ", MRT: "MR", MUS: "MU", MWI: "MW",
  MYT: "YT", NAM: "NA", NER: "NE", NGA: "NG", RWA: "RW", SDN: "SD", SEN: "SN",
  SLE: "SL", SOM: "SO", SSD: "SS", STP: "ST", SWZ: "SZ", SYC: "SC", TCD: "TD",
  TGO: "TG", TUN: "TN", TZA: "TZ", UGA: "UG", ZAF: "ZA", ZMB: "ZM", ZWE: "ZW",
  /* Îles du cadrage Afrique hors continent, présentes dans GAUL 2024. */
  ATF: "TF", BVT: "BV", HMD: "HM",
};
function iso3to2(iso3: string): string {
  return ISO3TO2[iso3.toUpperCase()] ?? iso3;
}

/* ───────────────────────── Accordéon alerte ─────────────────────────── */

function AlertAccordion({ icon, title, count, countLabel, defaultOpen, children }: {
  icon: string;
  title: string;
  count?: number;
  countLabel: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(!!defaultOpen);
  return (
    <div className={`report-accordion${open ? " open" : ""}`}>
      <button className="report-accordion-header" onClick={() => setOpen(!open)}>
        <span className="report-accordion-icon">{icon}</span>
        <div className="report-accordion-info">
          <h4>{title}{typeof count === "number" && count > 0 && <span className="alert-badge">{count}</span>}</h4>
          <span className="report-accordion-count">{countLabel}</span>
        </div>
        <span className={`report-accordion-chevron${open ? " rotated" : ""}`}>
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M6 9l6 6 6-6" /></svg>
        </span>
      </button>
      {open && <div className="report-accordion-body">{children}</div>}
    </div>
  );
}

/* ───────────────────────────── Page ───────────────────────────────────── */

export default function AlertsPage() {
  const navigate = useNavigate();
  const [gauges, setGauges] = useState<GaugeFeature[]>([]);
  const [flashes, setFlashes] = useState<FlashFeature[]>([]);
  const [gaugeState, setGaugeState] = useState<"loading" | "ready" | "error">("loading");
  const [flashState, setFlashState] = useState<"loading" | "ready" | "error">("loading");
  const [localities, setLocalities] = useState<Record<string, string>>({});
  const [flashLocalities, setFlashLocalities] = useState<Record<string, string>>({});

  useEffect(() => {
    const ctrl = new AbortController();

    fetch(WFS("geossia:flood_gauge_status"), { signal: ctrl.signal })
      .then((r) => { if (!r.ok) throw new Error(String(r.status)); return r.json(); })
      .then((json) => { setGauges(json.features ?? []); setGaugeState("ready"); })
      .catch((e: Error) => { if (e.name !== "AbortError") setGaugeState("error"); });

    fetch(WFS("geossia:flash_flood_event"), { signal: ctrl.signal })
      .then((r) => { if (!r.ok) throw new Error(String(r.status)); return r.json(); })
      .then((json) => { setFlashes(json.features ?? []); setFlashState("ready"); })
      .catch((e: Error) => { if (e.name !== "AbortError") setFlashState("error"); });

    return () => ctrl.abort();
  }, []);

  const state = gaugeState === "error" && flashState === "error" ? "error"
    : gaugeState === "ready" || flashState === "ready" ? "ready"
    : "loading";

  const activeGauges = useMemo<ActiveGauge[]>(() => {
    const result: ActiveGauge[] = [];
    for (const g of gauges) {
      const sev = g.properties.severity || "NO_FLOODING";
      if (sev === "NO_FLOODING") continue;
      const coords = g.geometry?.coordinates ?? [0, 0];
      result.push({
        gaugeId: g.properties.gauge_id || "",
        country: countryLabel(g.properties.country || ""),
        severity: sev,
        trend: g.properties.forecast_trend || "",
        issuedTime: g.properties.issued_time || "",
        lon: coords[0],
        lat: coords[1],
      });
    }
    const order = ["EXTREME_DANGER", "DANGER", "WARNING", "ABOVE_NORMAL"];
    result.sort((a, b) => order.indexOf(a.severity) - order.indexOf(b.severity));
    return result;
  }, [gauges]);

  useEffect(() => {
    if (activeGauges.length === 0) return;
    let cancelled = false;
    const seen = new Set<string>();
    const queue: ActiveGauge[] = [];
    for (const g of activeGauges) {
      const key = `${g.lat.toFixed(2)},${g.lon.toFixed(2)}`;
      if (!seen.has(key)) { seen.add(key); queue.push(g); }
    }

    (async () => {
      const result: Record<string, string> = {};
      for (const g of queue) {
        if (cancelled) break;
        const loc = await reverseGeocode(g.lat, g.lon);
        if (loc) result[g.gaugeId] = loc;
        for (const other of activeGauges) {
          if (Math.abs(other.lat - g.lat) < 0.05 && Math.abs(other.lon - g.lon) < 0.05) {
            result[other.gaugeId] = loc;
          }
        }
      }
      if (!cancelled) setLocalities(result);
    })();

    return () => { cancelled = true; };
  }, [activeGauges]);

  useEffect(() => {
    if (!flashes.length) return;
    let cancelled = false;
    (async () => {
      const result: Record<string, string> = {};
      for (const flash of flashes) {
        if (cancelled) break;
        const id = flash.properties.event_id;
        const center = geometryCenter(flash.geometry?.coordinates);
        if (!id || !center) continue;
        const locality = await reverseGeocode(center[1], center[0]);
        if (locality) result[id] = locality;
      }
      if (!cancelled) setFlashLocalities(result);
    })();
    return () => { cancelled = true; };
  }, [flashes]);

  const lastUpdate = useMemo(() =>
    gauges.reduce((max, g) => {
      const t = g.properties.issued_time || "";
      return t > max ? t : max;
    }, ""),
  [gauges]);

  const totalAlerts = activeGauges.length + flashes.length;

  return (
    <>
      <section className="page-hero">
        <div className="page-hero-bg" style={{ backgroundImage: "url(/images/sahel-landscape.jpg)" }} aria-hidden="true" />
        <div className="container page-hero-inner">
          <div className="kicker light"><span style={{ color: "var(--forest-light)" }}>●</span> Surveillance opérationnelle multirisque</div>
          <h1>Alertes <em>et prévisions</em>.</h1>
          <p className="lead light" style={{ textAlign: "justify" }}>
            Suivi des inondations, sécheresses, feux de végétation et autres événements
            environnementaux affectant les territoires africains — données en temps réel.
          </p>
        </div>
        <img className="alerts-hero-cap-logo" src={capLogo} alt="CAP — Common Alerting Protocol" />
      </section>

      <section className="section tight">
        <div className="container">
          <div className="report-accordion-list alerts-accordion-list">
            {/* ════ 01 · Inondations ════ */}
            <AlertAccordion
              icon="🌊"
              title="Inondations"
              count={totalAlerts}
              countLabel={totalAlerts > 0 ? `${totalAlerts} alerte${totalAlerts > 1 ? "s" : ""} active${totalAlerts > 1 ? "s" : ""}` : "Aucune alerte active"}
            >
              <div className={`flood-state ${state}`}>
                <i />
                <span>
                  <strong>
                    {state === "loading"
                      ? "Chargement des alertes…"
                      : state === "error"
                        ? "Alertes momentanément indisponibles"
                        : "Alertes inondations"}
                  </strong>
                  <small>
                    {state === "ready" && lastUpdate
                      ? <>Mis à jour le {fmtDate(lastUpdate)} · Google Flood Forecasting · CAP v1.2</>
                      : "Google Flood Forecasting · mise à jour opérationnelle"}
                  </small>
                </span>
              </div>

              {state === "ready" && (
                <>
                  {activeGauges.length > 0 && (
                    <div className="cap-countries">
                      <h3>Stations en alerte</h3>
                      <ul>
                        {activeGauges.map((g) => {
                          const sev = SEVERITY_MAP[g.severity];
                          const loc = localities[g.gaugeId];
                          return (
                            <li key={g.gaugeId} title="Voir la station sur le Géoportail" onClick={() => navigate(geoportalAlertHref(g.lon, g.lat, "inondations", undefined, { product: "google_flood_gauges" }))}>
                              <div className="cap-country-left">
                                <span className="cap-country-dot" style={{ background: sev?.color ?? "#fbc02d" }} />
                                <div>
                                  <span className="cap-country-sev" style={{ color: sev?.color }}>
                                    {sev?.label ?? g.severity}
                                  </span>
                                  <span className="cap-country-detail">
                                    {g.trend === "RISING" ? "En hausse ↑" : g.trend === "FALLING" ? "En baisse ↓" : "Stable →"}
                                    {" · "}
                                    {new Date(g.issuedTime).toLocaleDateString("fr-FR", { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" })}
                                  </span>
                                </div>
                              </div>
                              <div className="cap-country-right">
                                {loc
                                  ? <><span className="cap-country-name">{loc}</span><span className="cap-country-date">{g.country}</span></>
                                  : <span className="cap-country-name">{g.country}</span>
                                }
                              </div>
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  )}

                  {flashes.length > 0 && (
                    <div className="cap-flash">
                      <h3>Inondations éclair</h3>
                      <ul>
                        {flashes.map((f) => {
                          const p = f.properties;
                          const locality = p.event_id ? flashLocalities[p.event_id] : "";
                          const countries = (p.country_codes || []).map(countryLabel).join(", ");
                          return (
                            <li key={p.event_id} title="Voir la zone sur le Géoportail" onClick={() => {
                              const center = geometryCenter(f.geometry?.coordinates);
                              if (center) navigate(geoportalAlertHref(center[0], center[1], "inondations", undefined, { product: "google_flash_floods" }));
                            }}>
                              <div className="cap-flash-left">
                                <span className="cap-flash-dot" />
                                <span>{p.likelihood} · {p.forecast_period_hours}h</span>
                              </div>
                              <div className="cap-flash-right">
                                <span className="cap-country-name">{locality || "Localité en cours d’identification"}</span>
                                {countries && <span className="cap-country-date">{countries}</span>}
                              </div>
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  )}

                  {totalAlerts === 0 && (
                    <div className="flood-empty">
                      <p>
                        Aucune des {gauges.length} stations suivies en Afrique ne présente actuellement
                        un niveau de crue supérieur à la normale.
                      </p>
                    </div>
                  )}
                </>
              )}
            </AlertAccordion>

            {/* ════ 02 · Sécheresse ════ */}
            <AlertAccordion
              icon="☀️"
              title="Sécheresse"
              countLabel="SAP sécheresse · SPI + VHI + GDO"
            >
              <DroughtSection />
            </AlertAccordion>

            {/* ════ 03 · Feux de végétation ════ */}
            <AlertAccordion
              icon="🔥"
              title="Feux de végétation"
              countLabel="SAP feux · GWIS FWI + FIRMS"
            >
              <FireSection />
            </AlertAccordion>
          </div>

          <p className="cap-source">
            Inondations : Google Flood Forecasting API · Protocole CAP v1.2 · OASIS Standard<br />
            Sécheresse : SAP GEOSSIA — SPI prévisionnel CHIRPS3+GEFS × VHI NOAA STAR (cascade CDI, Sepulcre-Canto 2012) · Alarme saisonnière GDO Copernicus · Unités GAUL 2024<br />
            Feux : SAP GEOSSIA — Indice FWI ECMWF/GEFF (GWIS, rang climatologique J0–J+9) × NASA FIRMS (détections actives) · Unités GAUL 2024
          </p>
        </div>
      </section>
    </>
  );
}
