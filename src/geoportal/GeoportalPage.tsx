import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Icon, IconName } from "../components/Icon";
import { BrandMark, useBundle, useTitle } from "../components/Layout";
import { Sparkline, Stripes } from "../components/charts";
import { ALERT_LEVELS, INDICATORS, RegionZone, THEMES, Theme, ZoneData, colorFor, fmt, formatValue, indicatorById, legendFor, loadRegionBundle, monthLabel } from "../data/indicators";
import { COUNTRIES, COUNTRY_BY_ISO3, REGIONS, countryName, regionName } from "../data/countries";
import { BASEMAPS, BasemapId, FeatureStyle, MapCanvas, MapCanvasHandle, OVERLAYS } from "./MapCanvas";
import { Chip, Help, RangeSlider } from "./controls";
import { TimelapseBar, TrendsDrawer } from "./ClimateTrends";
import { AnnualTable, Ssp, TrendVariable, annualLastYear, annualValue, formatAnnual, loadAnnual, rampColor, rampFor } from "../data/climateTrends";

const THEME_ICONS: Record<Theme, IconName> = { climat: "thermometer", alertes: "alert", tendances: "trend" };

type Subdivision = "pays" | "admin1" | "sousregions";
// One map unit: a country, or a level-1 region of a country.
interface Unit { id: string; name: string; iso3: string; subregion: string; bbox: [number, number, number, number] | null }
type Tool = "legend" | "basemap" | "overlays" | "ranking" | null;
type PanelTab = "layers" | "favorites" | "search";
interface SavedView { name: string; indicator: string; country: string | null }

const FAVORITES_KEY = "c2-geoportail-vues";

function readFavorites(): SavedView[] {
  try {
    return JSON.parse(localStorage.getItem(FAVORITES_KEY) ?? "[]") as SavedView[];
  } catch {
    return [];
  }
}

function writeFavorites(views: SavedView[]) {
  try {
    localStorage.setItem(FAVORITES_KEY, JSON.stringify(views));
  } catch {
    // Private window: views simply are not remembered.
  }
}

export default function GeoportalPage() {
  useTitle("Géoportail");
  const { bundle, error } = useBundle();
  const [params, setParams] = useSearchParams();
  const indicator = indicatorById(params.get("ind"));
  const selected = params.get("pays");
  const mapRef = useRef<MapCanvasHandle>(null);

  const [panelOpen, setPanelOpen] = useState(true);
  const [indicatorVisible, setIndicatorVisible] = useState(true);
  const [panelTab, setPanelTab] = useState<PanelTab>("layers");
  const [subdivision, setSubdivision] = useState<Subdivision>("pays");
  const [region, setRegion] = useState<string>("all");
  const [draftExcluded, setDraftExcluded] = useState<string[]>([]);
  const [draftRange, setDraftRange] = useState<[number, number]>(indicator.domain);
  const [applied, setApplied] = useState<{ excluded: string[]; range: [number, number] }>({ excluded: [], range: indicator.domain });
  const [excludeQuery, setExcludeQuery] = useState("");
  const [tool, setTool] = useState<Tool>("legend");
  const [basemap, setBasemap] = useState<BasemapId>("clair");
  const [overlays, setOverlays] = useState<string[]>([]);
  const [hover, setHover] = useState<{ iso3: string; x: number; y: number } | null>(null);
  const [territoryOpen, setTerritoryOpen] = useState(false);
  const [favorites, setFavorites] = useState<SavedView[]>(readFavorites);
  const [search, setSearch] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);
  // Climate trends (as in the main portal's Results panel): drawer for the
  // selected zone, and the animated map 1901-2100.
  const [trendsOpen, setTrendsOpen] = useState(false);
  const [trendVar, setTrendVar] = useState<TrendVariable>("tmp");
  const [trendSsp, setTrendSsp] = useState<Ssp | "obs">("ssp245");
  const [timelapse, setTimelapse] = useState<{ variable: TrendVariable; ssp: Ssp; year: number; playing: boolean } | null>(null);
  const [annual, setAnnual] = useState<AnnualTable | null>(null);

  useEffect(() => {
    if (!timelapse) return;
    let live = true;
    loadAnnual(timelapse.variable).then((table) => {
      if (!live || !table) return;
      setAnnual(table);
      setTimelapse((t) => t && { ...t, year: Math.min(Math.max(t.year, table.first), annualLastYear(table)) });
    });
    return () => {
      live = false;
    };
  }, [timelapse?.variable]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!timelapse?.playing || !annual) return;
    const id = window.setInterval(() => {
      setTimelapse((t) => {
        if (!t) return t;
        const last = annualLastYear(annual);
        return t.year >= last ? { ...t, playing: false } : { ...t, year: t.year + 1 };
      });
    }, 260);
    return () => window.clearInterval(id);
  }, [timelapse?.playing, annual]);

  const timelapseTable = timelapse && annual?.var === timelapse.variable ? annual : null;

  // A new indicator has its own value domain: reset the range filter.
  useEffect(() => {
    setDraftRange(indicator.domain);
    setApplied((current) => ({ ...current, range: indicator.domain }));
  }, [indicator.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const update = (next: { ind?: string; pays?: string | null }) => {
    const p = new URLSearchParams(params);
    if (next.ind !== undefined) p.set("ind", next.ind);
    if (next.pays !== undefined) {
      if (next.pays) p.set("pays", next.pays);
      else p.delete("pays");
    }
    setParams(p, { replace: true });
  };

  // Level-1 regions are loaded on first use (map level, animated map, or a
  // region link). The animated map is always drawn at the region level.
  const [regionZones, setRegionZones] = useState<Record<string, RegionZone> | null>(null);
  const regionLevel = subdivision === "admin1" || timelapse !== null;
  const needRegions = regionLevel || Boolean(selected?.includes("."));
  useEffect(() => {
    if (needRegions && !regionZones) loadRegionBundle().then(setRegionZones).catch(() => setRegionZones({}));
  }, [needRegions, regionZones]);

  const units: Unit[] = useMemo(() => {
    if (regionLevel) {
      return Object.entries(regionZones ?? {})
        .filter(([, z]) => COUNTRY_BY_ISO3.has(z.iso3))
        .map(([id, z]) => ({ id, name: z.name, iso3: z.iso3, subregion: COUNTRY_BY_ISO3.get(z.iso3)!.region, bbox: z.bbox }));
    }
    return COUNTRIES.map((c) => ({ id: c.iso3, name: c.name, iso3: c.iso3, subregion: c.region, bbox: c.bbox }));
  }, [regionLevel, regionZones]);
  const unitById = useMemo(() => new Map(units.map((u) => [u.id, u])), [units]);

  const zoneOf = (id: string | null): ZoneData | undefined => (!id ? undefined : id.includes(".") ? regionZones?.[id] : bundle?.zones[id]);
  const zoneName = (id: string) => (id.includes(".") ? regionZones?.[id]?.name ?? id : countryName(id));
  const zoneSub = (id: string) => {
    if (!id.includes(".")) return regionName(COUNTRY_BY_ISO3.get(id)?.region ?? "");
    const iso3 = id.split(".")[0];
    return `${countryName(iso3)} · région (niveau 1)`;
  };

  const selectCountry = (id: string | null) => {
    update({ pays: id });
    if (!id) return;
    const bbox = id.includes(".") ? regionZones?.[id]?.bbox : COUNTRY_BY_ISO3.get(id)?.bbox;
    if (bbox) mapRef.current?.fitBounds(bbox);
  };

  const values = useMemo(() => {
    const out: Record<string, number | null> = {};
    if (!bundle) return out;
    for (const unit of units) {
      const zone = unit.id.includes(".") ? regionZones?.[unit.id] : bundle.zones[unit.id];
      out[unit.id] = zone ? indicator.value(zone) : null;
    }
    if (subdivision === "sousregions") {
      for (const r of REGIONS) {
        const members = units.filter((u) => u.subregion === r.id).map((u) => out[u.id]).filter((v): v is number => v !== null);
        const mean = members.length ? members.reduce((a, b) => a + b, 0) / members.length : null;
        const value = mean !== null && indicator.scale.kind === "alert" ? Math.round(mean) : mean;
        for (const u of units) if (u.subregion === r.id) out[u.id] = value;
      }
    }
    return out;
  }, [bundle, regionZones, units, indicator, subdivision]);

  const isActive = (id: string) => {
    const v = values[id];
    const unit = unitById.get(id);
    if (unit && applied.excluded.includes(unit.iso3)) return false;
    if (region !== "all" && unit?.subregion !== region) return false;
    if (v === null || v === undefined) return true;
    return v >= applied.range[0] - 1e-9 && v <= applied.range[1] + 1e-9;
  };

  const styles = useMemo(() => {
    const out: Record<string, FeatureStyle> = {};
    if (timelapse && timelapseTable) {
      const { ramp, range } = rampFor(timelapse.variable);
      for (const unit of units) {
        const v = annualValue(timelapseTable, unit.id, timelapse.year, timelapse.ssp);
        out[unit.id] = { fill: v === null ? "#e6e9ef" : rampColor(ramp, v, range), active: true };
      }
      return out;
    }
    for (const unit of units) out[unit.id] = { fill: colorFor(indicator, values[unit.id] ?? null), active: isActive(unit.id) };
    return out;
  }, [units, values, applied, region, indicator, timelapse, timelapseTable]); // eslint-disable-line react-hooks/exhaustive-deps

  const openTrends = () => {
    setTimelapse(null);
    setTrendsOpen(true);
  };
  const openTimelapse = () => {
    setTrendsOpen(false);
    setTimelapse({ variable: trendVar, ssp: trendSsp === "obs" ? "ssp245" : trendSsp, year: 1901, playing: false });
  };

  const ranking = useMemo(
    () => units.filter((u) => isActive(u.id) && values[u.id] !== null && values[u.id] !== undefined).sort((a, b) => (values[b.id] as number) - (values[a.id] as number)),
    [units, values, applied, region], // eslint-disable-line react-hooks/exhaustive-deps
  );

  const africa = bundle?.zones.AFR;
  const selectedZone = zoneOf(selected);
  const alertCount = bundle ? COUNTRIES.filter((c) => (bundle.zones[c.iso3]?.alerts.drought_level ?? 0) >= 2).length : 0;
  const excludeMatches = excludeQuery.length >= 2
    ? COUNTRIES.filter((c) => !draftExcluded.includes(c.iso3) && (c.name.toLowerCase().includes(excludeQuery.toLowerCase()) || c.iso3.toLowerCase() === excludeQuery.toLowerCase())).slice(0, 5)
    : [];
  const activeFilters = applied.excluded.length + (region !== "all" ? 1 : 0) + (applied.range[0] !== indicator.domain[0] || applied.range[1] !== indicator.domain[1] ? 1 : 0);
  const dirty = draftRange[0] !== applied.range[0] || draftRange[1] !== applied.range[1] || draftExcluded.join() !== applied.excluded.join();
  const step = indicator.scale.kind === "alert" ? 1 : (indicator.domain[1] - indicator.domain[0]) / 60;
  const sliderDecimals = indicator.scale.kind === "alert" ? 0 : indicator.domain[1] - indicator.domain[0] <= 1 ? 2 : 1;

  const setTheme = (theme: Theme) => {
    const first = INDICATORS.find((i) => i.theme === theme)!;
    update({ ind: first.id });
    setIndicatorVisible(true);
  };

  const toggleIndicator = (id: string, checked: boolean) => {
    if (id !== indicator.id) update({ ind: id });
    setIndicatorVisible(checked);
  };

  const clear = () => {
    setDraftExcluded([]);
    setDraftRange(indicator.domain);
    setApplied({ excluded: [], range: indicator.domain });
    setRegion("all");
    setSubdivision("pays");
  };

  const saveView = () => {
    const view: SavedView = { name: `${indicator.short}${selected ? ` · ${zoneName(selected)}` : ""}`, indicator: indicator.id, country: selected };
    const next = [view, ...favorites.filter((f) => f.name !== view.name)].slice(0, 8);
    setFavorites(next);
    writeFavorites(next);
  };

  const tabs: Array<{ id: PanelTab; icon: IconName; label: string }> = [
    { id: "layers", icon: "layers", label: "Indicateurs" },
    { id: "favorites", icon: "star", label: "Vues" },
    { id: "search", icon: "search", label: "Pays" },
  ];


  const territoryLabel = selected ? zoneName(selected) : region !== "all" ? regionName(region) : "Afrique";
  const territorySub = selected
    ? selected.includes(".") ? zoneSub(selected) : `${zoneSub(selected)} · ${selected}`
    : region !== "all"
      ? `${COUNTRIES.filter((c) => c.region === region).length} pays · sous-région ONU M49`
      : "55 pays · 5 sous-régions ONU M49";

  return (
    <div className="gp">

      {panelOpen && (
        <section className="gp-panel">
          <div className="gp-brandbar">
            <Link to="/" className="gp-brand" title="Accueil">
              <BrandMark size={30} />
              <span><strong>GEOSSIA</strong><small>Climat & Alertes</small></span>
            </Link>
            <Link to="/a-propos" className="icon-btn" title="Méthodologie" aria-label="Méthodologie"><Icon name="help" size={17} /></Link>
            <button className="icon-btn bell" onClick={() => update({ ind: "drought-alert" })} title="Afficher les alertes sécheresse" aria-label="Afficher les alertes sécheresse">
              <Icon name="bell" size={17} />
              {alertCount > 0 && <span className="badge">{alertCount}</span>}
            </button>
          </div>
          <div className="territory-card">
            <button className="territory-main" onClick={() => setTerritoryOpen((v) => !v)} aria-expanded={territoryOpen}>
              <Icon name="pin" size={16} className="territory-pin" />
              <span className="territory-text">
                <strong>{territoryLabel}</strong>
                <small>{territorySub}</small>
              </span>
              <Icon name="swap" size={16} className="territory-icon" />
              <Icon name="chevronDown" size={16} className="territory-icon" />
            </button>
            {territoryOpen && (
              <div className="territory-menu">
                <button onClick={() => { setRegion("all"); selectCountry(null); mapRef.current?.reset(); setTerritoryOpen(false); }}>Afrique — tout le continent</button>
                {REGIONS.map((r) => (
                  <button key={r.id} onClick={() => { setRegion(r.id); update({ pays: null }); setTerritoryOpen(false); }}>{r.name}</button>
                ))}
                <hr />
                <div className="territory-countries">
                  {COUNTRIES.map((c) => (
                    <button key={c.iso3} onClick={() => { selectCountry(c.iso3); setTerritoryOpen(false); }}>{c.name}</button>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="panel-tabs" role="tablist">
            {tabs.map((item) => (
              <button key={item.id} role="tab" aria-selected={panelTab === item.id} className={panelTab === item.id ? "on" : ""} onClick={() => setPanelTab(item.id)}>
                <Icon name={item.icon} size={15} /> {item.label}
              </button>
            ))}
          </div>

          {panelTab === "layers" && (
            <div className="panel-body layers">
              <div className="panel-scroll">
                <div className="theme-tabs" role="tablist" aria-label="Famille d'indicateurs">
                  {THEMES.map((t) => (
                    <button key={t.id} role="tab" aria-selected={indicator.theme === t.id} className={indicator.theme === t.id ? `on ${t.id}` : t.id} onClick={() => setTheme(t.id)}>
                      <Icon name={THEME_ICONS[t.id]} size={16} />
                      {t.label}
                    </button>
                  ))}
                </div>

                <section className="pgroup">
                  <div className="pgroup-head">
                    <span>Indicateur</span>
                    <Help text={indicator.description} />
                  </div>
                  <div className="ind-grid">
                    {INDICATORS.filter((i) => i.theme === indicator.theme).map((i) => (
                      <label key={i.id} className={i.id === indicator.id && indicatorVisible ? "ind-tile on" : "ind-tile"}>
                        <input
                          type="checkbox"
                          checked={i.id === indicator.id && indicatorVisible}
                          onChange={(event) => toggleIndicator(i.id, event.target.checked)}
                          aria-label={`Afficher ${i.short}`}
                        />
                        <strong>{i.short}</strong>
                        <small>{i.unit}</small>
                        <span className="ind-ramp">{legendFor(i).map((l) => <i key={l.label} style={{ background: l.color }} />)}</span>
                      </label>
                    ))}
                  </div>
                  <p className="field-note">{indicator.name} · {indicator.source}</p>
                </section>

                {indicator.theme === "tendances" && (
                  <section className="pgroup">
                    <div className="pgroup-head"><span>Tendances climatiques</span></div>
                    <div className="launch-grid">
                      <button className={trendsOpen ? "launch on" : "launch"} onClick={openTrends}>
                        <span className="launcher-art stripes-art" />
                        <strong>Bandes et projections</strong>
                        <small>{selected ? zoneName(selected) : "Afrique"}</small>
                      </button>
                      <button className={timelapse ? "launch on" : "launch"} onClick={openTimelapse}>
                        <span className="launcher-art play-art"><svg width="12" height="12" viewBox="0 0 14 14"><path d="M3 1.5v11l9.5-5.5L3 1.5Z" fill="currentColor" /></svg></span>
                        <strong>Carte animée</strong>
                        <small>Régions · 1901-2100</small>
                      </button>
                    </div>
                  </section>
                )}

                <section className="pgroup">
                  <div className="pgroup-head">
                    <span>Unité spatiale</span>
                    <small>{subdivision === "admin1" ? `${regionZones ? Object.keys(regionZones).length : "…"} régions` : subdivision === "pays" ? "55 pays" : "5 sous-régions"}</small>
                  </div>
                  <div className="seg-full" role="radiogroup" aria-label="Unité spatiale">
                    {([["pays", "Pays"], ["admin1", "Régions"], ["sousregions", "Sous-rég. ONU"]] as Array<[Subdivision, string]>).map(([id, label]) => (
                      <button key={id} role="radio" aria-checked={subdivision === id} className={subdivision === id ? "on" : ""} onClick={() => setSubdivision(id)}>{label}</button>
                    ))}
                  </div>
                </section>

                <section className="pgroup">
                  <button className="pgroup-toggle" onClick={() => setFiltersOpen((v) => !v)} aria-expanded={filtersOpen}>
                    <span>Filtres</span>
                    {activeFilters > 0 && <span className="count">{activeFilters}</span>}
                    <Icon name="chevronDown" size={16} className={filtersOpen ? "chev open" : "chev"} />
                  </button>
                  {filtersOpen && (
                    <div className="filters">
                      <div className="field">
                        <label>
                          Sous-région
                          <Help text="Découpage géographique ONU M49. Restreint la carte et le classement à la sous-région." />
                        </label>
                        <div className="pills">
                          <button className={region === "all" ? "pill on" : "pill"} onClick={() => setRegion("all")}>Toutes</button>
                          {REGIONS.map((r) => (
                            <button key={r.id} className={region === r.id ? "pill on" : "pill"} onClick={() => setRegion(r.id)}>{r.short}</button>
                          ))}
                        </div>
                      </div>

                      <div className="field">
                        <label>
                          Plage de valeurs <span className="unit">({indicator.unit})</span>
                          <Help text="Les unités dont la valeur sort de la plage sont estompées sur la carte et retirées du classement." />
                        </label>
                        <RangeSlider domain={indicator.domain} value={draftRange} step={step} decimals={sliderDecimals} onChange={setDraftRange} />
                      </div>

                      <div className="field">
                        <label htmlFor="exclude">Exclure des pays</label>
                        <div className="combo">
                          <input id="exclude" placeholder="Nom ou code ISO3" value={excludeQuery} onChange={(e) => setExcludeQuery(e.target.value)} autoComplete="off" />
                          {excludeMatches.length > 0 && (
                            <div className="combo-menu">
                              {excludeMatches.map((c) => (
                                <button key={c.iso3} onClick={() => { setDraftExcluded([...draftExcluded, c.iso3]); setExcludeQuery(""); }}>
                                  {c.name} <small>{c.iso3}</small>
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                        {draftExcluded.length > 0 && (
                          <div className="chips">
                            {draftExcluded.map((iso3) => <Chip key={iso3} label={iso3} onRemove={() => setDraftExcluded(draftExcluded.filter((c) => c !== iso3))} />)}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </section>
              </div>

              {(filtersOpen || dirty || activeFilters > 0) && (
                <footer className="panel-foot">
                  <button className="btn btn-dark sm" disabled={!dirty} onClick={() => setApplied({ excluded: draftExcluded, range: draftRange })}>
                    <Icon name="check" size={15} /> Appliquer
                  </button>
                  <button className="btn btn-ghost sm" onClick={clear} disabled={!dirty && activeFilters === 0}>
                    <Icon name="close" size={14} /> Effacer
                  </button>
                </footer>
              )}
            </div>
          )}

          {panelTab === "favorites" && (
            <div className="panel-body">
              <div className="panel-title"><h2>Vues enregistrées</h2></div>
              <button className="btn btn-dark sm" onClick={saveView}><Icon name="star" size={15} /> Enregistrer la vue actuelle</button>
              {favorites.length === 0 ? (
                <p className="field-note">Aucune vue enregistrée. Une vue retient l'indicateur et le pays sélectionné, dans ce navigateur.</p>
              ) : (
                <ul className="list">
                  {favorites.map((f) => (
                    <li key={f.name}>
                      <button onClick={() => { update({ ind: f.indicator, pays: f.country }); setPanelTab("layers"); }}>
                        <strong>{f.name}</strong>
                        <small>{indicatorById(f.indicator).name}</small>
                      </button>
                      <button className="icon-btn" aria-label="Supprimer" onClick={() => { const next = favorites.filter((x) => x !== f); setFavorites(next); writeFavorites(next); }}>
                        <Icon name="close" size={14} />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {panelTab === "search" && (
            <div className="panel-body">
              <div className="panel-title"><h2>Rechercher</h2></div>
              <div className="combo">
                <input autoFocus placeholder="Pays ou code ISO3…" value={search} onChange={(e) => setSearch(e.target.value)} />
              </div>
              <ul className="list">
                {COUNTRIES.filter((c) => !search || c.name.toLowerCase().includes(search.toLowerCase()) || c.iso3.toLowerCase().includes(search.toLowerCase())).map((c) => (
                  <li key={c.iso3}>
                    <button onClick={() => selectCountry(c.iso3)}>
                      <strong>{c.name}</strong>
                      <small>{regionName(c.region)} · {formatValue(indicator, values[c.iso3] ?? null)}</small>
                    </button>
                    <i className="swatch" style={{ background: colorFor(indicator, values[c.iso3] ?? null) }} />
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>
      )}

      <section className="gp-map">
        <MapCanvas ref={mapRef} level={regionLevel ? "regions" : "countries"} styles={styles} choroplethVisible={indicatorVisible || Boolean(timelapse)} selected={selected} basemap={basemap} overlays={overlays} onSelect={selectCountry} onHover={setHover} />
        {!bundle && <div className="map-status">{error ? `Indicateurs indisponibles : ${error}` : "Chargement…"}</div>}

        <button className="map-collapse" onClick={() => setPanelOpen((v) => !v)} aria-label={panelOpen ? "Masquer le panneau" : "Afficher le panneau"}>
          <Icon name={panelOpen ? "chevronLeft" : "chevronRight"} size={16} />
        </button>

        {timelapse ? (
          <div className="map-headline">
            <span className="eyebrow">Carte animée</span>
            <strong>{timelapse.variable.startsWith("spi") ? `${timelapse.variable.toUpperCase().replace("SPI", "SPI-")} moyen annuel` : "Anomalie annuelle de température"} · {timelapse.year}</strong>
            <small>{timelapse.variable.startsWith("spi") ? "CHIRPS, référence 1991-2020" : "vs 1961-1990 · CRU TS 4.09 puis CMIP6"}</small>
          </div>
        ) : (
        <div className="map-headline">
          <span className="eyebrow">{THEMES.find((t) => t.id === indicator.theme)?.label}</span>
          <strong>{indicator.name}</strong>
          {africa && (
            <small>
              Afrique : {formatValue(indicator, indicator.value(africa))}
              {indicator.theme === "alertes" ? ` · ${monthLabel(africa.alerts.spi_month)}` : indicator.theme === "climat" && indicator.unit === "°C" ? ` · ${africa.climate.year}` : ""}
            </small>
          )}
        </div>
        )}

        {hover && bundle && (
          <div className="map-tooltip" style={{ left: hover.x + 14, top: hover.y + 14 }}>
            <strong>{subdivision === "sousregions" && !timelapse ? regionName(unitById.get(hover.iso3)?.subregion ?? "") : zoneName(hover.iso3)}</strong>
            {hover.iso3.includes(".") && <small className="tip-sub">{countryName(hover.iso3.split(".")[0])}</small>}
            <span>
              {timelapse && timelapseTable
                ? formatAnnual(timelapse.variable, annualValue(timelapseTable, hover.iso3, timelapse.year, timelapse.ssp))
                : formatValue(indicator, values[hover.iso3] ?? null)}
            </span>
          </div>
        )}

        {selected && selectedZone && !trendsOpen && <CountryCard title={zoneName(selected)} subtitle={zoneSub(selected)} zone={selectedZone} onClose={() => update({ pays: null })} onTrends={openTrends} />}

        {trendsOpen && (
          <TrendsDrawer code={selected ?? "AFR"} title={selected ? `${zoneName(selected)}${selected.includes(".") ? ` · ${countryName(selected.split(".")[0])}` : ""}` : "Afrique"} variable={trendVar} ssp={trendSsp} onVariable={setTrendVar} onSsp={setTrendSsp} onClose={() => setTrendsOpen(false)} />
        )}

        {timelapse && (
          <TimelapseBar
            variable={timelapse.variable}
            ssp={timelapse.ssp}
            year={timelapse.year}
            first={timelapseTable?.first ?? 1901}
            last={timelapseTable ? annualLastYear(timelapseTable) : 2100}
            lastObs={timelapseTable?.last_obs ?? 2024}
            playing={timelapse.playing}
            onVariable={(variable) => setTimelapse({ ...timelapse, variable, playing: false })}
            onSsp={(ssp) => setTimelapse({ ...timelapse, ssp })}
            onYear={(year) => setTimelapse({ ...timelapse, year, playing: false })}
            onPlay={() => setTimelapse({ ...timelapse, playing: !timelapse.playing, year: timelapseTable && timelapse.year >= annualLastYear(timelapseTable) ? timelapseTable.first : timelapse.year })}
            onClose={() => setTimelapse(null)}
          />
        )}

        {tool === "legend" && indicatorVisible && !trendsOpen && !timelapse && (
          <div className="map-card legend-card">
            <div className="map-card-head">
              <strong>{indicator.short}</strong>
              <span>{indicator.unit}</span>
            </div>
            <ul className="legend">
              {legendFor(indicator).map((item) => (
                <li key={item.label}><i style={{ background: item.color }} />{item.label}</li>
              ))}
              <li><i style={{ background: "#e6e9ef" }} />Pas de donnée</li>
            </ul>
            <p className="legend-note">{indicator.howToRead}</p>
          </div>
        )}

        {tool === "basemap" && (
          <div className="map-card tool-card">
            <div className="map-card-head"><strong>Fond de carte</strong></div>
            {(Object.keys(BASEMAPS) as BasemapId[]).map((id) => (
              <button key={id} className={basemap === id ? "tool-option on" : "tool-option"} onClick={() => setBasemap(id)}>
                <span className={`basemap-thumb ${id}`} />{BASEMAPS[id].label}
              </button>
            ))}
          </div>
        )}

        {tool === "overlays" && (
          <div className="map-card tool-card">
            <div className="map-card-head"><strong>Surcouches GeoServer</strong></div>
            {OVERLAYS.map((o) => (
              <label key={o.id} className="tool-check">
                <input type="checkbox" checked={overlays.includes(o.id)} onChange={(e) => setOverlays(e.target.checked ? [...overlays, o.id] : overlays.filter((x) => x !== o.id))} />
                <span><strong>{o.label}</strong><small>{o.description}</small></span>
              </label>
            ))}
            <p className="legend-note">Nécessite l'accès au GeoServer GEOSSIA (réseau OSS ou tunnel).</p>
          </div>
        )}

        {tool === "ranking" && !trendsOpen && (
          <div className="map-card ranking-card">
            <div className="map-card-head">
              <strong>Classement · {indicator.short}</strong>
              <button className="icon-btn" onClick={() => setTool(null)} aria-label="Fermer"><Icon name="close" size={14} /></button>
            </div>
            <ol className="ranking">
              {ranking.map((u, i) => (
                <li key={u.id} className={u.id === selected ? "on" : ""}>
                  <button onClick={() => selectCountry(u.id)} title={u.id.includes(".") ? `${u.name} · ${countryName(u.iso3)}` : u.name}>
                    <span className="rank">{i + 1}</span>
                    <i className="swatch" style={{ background: colorFor(indicator, values[u.id] ?? null) }} />
                    <span className="rank-name">{u.name}{u.id.includes(".") && <small> {u.iso3}</small>}</span>
                    <span className="rank-value">{formatValue(indicator, values[u.id] ?? null)}</span>
                  </button>
                </li>
              ))}
            </ol>
          </div>
        )}

        <div className="map-toolbar">
          <div className="toolbar-group">
            <button className={trendsOpen ? "on" : ""} onClick={() => (trendsOpen ? setTrendsOpen(false) : openTrends())} title="Tendances climatiques" aria-label="Tendances climatiques"><Icon name="trend" size={16} /></button>
            <button className={timelapse ? "on" : ""} onClick={() => (timelapse ? setTimelapse(null) : openTimelapse())} title="Carte animée 1901-2100" aria-label="Carte animée"><Icon name="history" size={16} /></button>
            <button className={tool === "ranking" ? "on" : ""} onClick={() => setTool(tool === "ranking" ? null : "ranking")} title="Classement des pays" aria-label="Classement des pays"><Icon name="compare" size={16} /></button>
            <button className={tool === "legend" ? "on" : ""} onClick={() => setTool(tool === "legend" ? null : "legend")} title="Légende" aria-label="Légende"><Icon name="list" size={16} /></button>
            <button onClick={() => { mapRef.current?.reset(); update({ pays: null }); }} title="Vue d'ensemble" aria-label="Vue d'ensemble"><Icon name="globe" size={16} /></button>
            <button className={tool === "basemap" ? "on" : ""} onClick={() => setTool(tool === "basemap" ? null : "basemap")} title="Fond de carte" aria-label="Fond de carte"><Icon name="palette" size={16} /></button>
            <button className={tool === "overlays" ? "on" : ""} onClick={() => setTool(tool === "overlays" ? null : "overlays")} title="Surcouches" aria-label="Surcouches"><Icon name="sliders" size={16} /></button>
          </div>
          <div className="toolbar-group">
            <button onClick={() => mapRef.current?.zoomOut()} aria-label="Dézoomer"><Icon name="minus" size={16} /></button>
            <button onClick={() => mapRef.current?.zoomIn()} aria-label="Zoomer"><Icon name="plus" size={16} /></button>
          </div>
        </div>
      </section>
    </div>
  );
}

function CountryCard({ title, subtitle, zone, onClose, onTrends }: { title: string; subtitle: string; zone: ZoneData; onClose(): void; onTrends(): void }) {
  const level = ALERT_LEVELS[zone.alerts.drought_level];
  const s = zone.series.tmean_anom;
  return (
    <div className="map-card country-card">
      <div className="map-card-head">
        <span>
          <strong>{title}</strong>
          <small>{subtitle}</small>
        </span>
        <button className="icon-btn" onClick={onClose} aria-label="Fermer"><Icon name="close" size={14} /></button>
      </div>
      <div className="alert-banner" style={{ borderColor: level.color }}>
        <i style={{ background: level.color }} />
        <span><strong>{level.label}</strong> sécheresse · SPI-3 {fmt(zone.alerts.spi3, 2, true)} ({monthLabel(zone.alerts.spi_month)})</span>
      </div>
      <dl className="kv">
        <div><dt>Anomalie Tmoy {zone.climate.year}</dt><dd>{fmt(zone.climate.tmean_anom, 2, true)} °C</dd></div>
        <div><dt>Réchauffement 1981+</dt><dd>{fmt(zone.trends.warming_decade, 2, true)} °C/déc.</dd></div>
        <div><dt>SPI-12</dt><dd>{fmt(zone.alerts.spi12, 2, true)}</dd></div>
        <div><dt>2041-60 · SSP2-4.5</dt><dd>{fmt(zone.trends.proj2050_ssp245, 1, true)} °C</dd></div>
      </dl>
      <div className="mini-label">Bandes de réchauffement {s.start}-{s.start + s.values.length - 1}</div>
      <Stripes values={s.values} start={s.start} height={34} />
      <div className="mini-label spark-row">
        SPI-3, 36 derniers mois <Sparkline values={zone.series.spi3_recent.values} width={110} height={26} color="#6660c8" />
      </div>
      <div className="card-actions">
        <button className="btn btn-dark sm" onClick={onTrends}><Icon name="trend" size={15} /> Tendances climatiques</button>
      </div>
    </div>
  );
}
