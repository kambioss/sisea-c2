import { useEffect, useMemo, useState } from "react";
import type { CSSProperties } from "react";
import { Link } from "react-router-dom";
import { Map as MapIcon, TrendingUp } from "../components/Icon";
import DashboardCountryMap from "../components/DashboardCountryMap";
import { COUNTRIES as AFRICAN_COUNTRIES } from "../data/countries";
import { loadEdgarCatalog, loadEmissionSeries, SUBSTANCES } from "../data/emissionsApi";
import type { EdgarDataset, EmissionSeriesPayload } from "../data/emissionsApi";
import "./dashboard.css";

type Series = { name: string; color: string; values: number[] };
type TerritoryFacts = { emissions: number; emissionShare: number; population: number; populationShare: number; gdp: number | null; gdpShare: number | null };

const YEARS = Array.from({ length: 24 }, (_, index) => 2001 + index);
const GHG_YEARS = Array.from({ length: 56 }, (_, index) => 1970 + index);

const CLIMATE_SERIES: Series[] = [
  { name: "Température moyenne", color: "#d95f2b", values: [21.8, 21.9, 22.1, 22, 22.3, 22.5, 22.4, 22.7, 22.8, 22.6, 22.9, 23, 23.2, 23.1, 23.4, 23.5, 23.3, 23.7, 23.6, 23.9, 24, 24.2, 24.1, 24.4] },
  { name: "Température maximale", color: "#9c2f1c", values: [28.4, 28.7, 28.8, 28.6, 29, 29.2, 29.1, 29.5, 29.7, 29.3, 29.8, 30, 30.2, 29.9, 30.4, 30.5, 30.1, 30.8, 30.6, 31, 31.1, 31.4, 31.2, 31.6] },
  { name: "Température minimale", color: "#d6a24a", values: [15.1, 15.2, 15.4, 15.3, 15.5, 15.7, 15.6, 15.9, 16, 15.8, 16.1, 16.2, 16.4, 16.3, 16.5, 16.7, 16.6, 16.9, 16.8, 17.1, 17.2, 17.4, 17.3, 17.6] },
];

const RAIN_SERIES: Series[] = [
  { name: "Précipitations", color: "#3e76b8", values: [648, 702, 690, 735, 614, 780, 724, 669, 812, 758, 701, 788, 830, 745, 692, 810, 766, 842, 711, 798, 854, 822, 746, 874] },
  { name: "Moyenne 2001–2020", color: "#8aa8cc", values: Array(24).fill(742) },
];

const SPI_SERIES: Series[] = [
  { name: "SPI-3", color: "#ca4c42", values: [0.4, -0.2, -0.8, 0.6, 1.1, -1.3, -0.7, 0.9, 0.2, -1.7, -0.9, 0.5, 1.3, 0.7, -0.4, -1.1, 0.3, 0.8, -1.4, -0.6, 1.2, 0.4, -0.3, -1.2] },
  { name: "SPI-12", color: "#5f78b8", values: [0.2, 0.1, -0.4, -0.1, 0.5, -0.6, -0.8, -0.2, 0.4, -0.7, -1, -0.3, 0.6, 0.9, 0.2, -0.5, -0.2, 0.3, -0.8, -0.9, 0.1, 0.5, 0.2, -0.4] },
];

const shock = (year: number) => year === 1991 ? .72 : year === 1999 ? .67 : year === 2009 ? .82 : year === 2020 ? .76 : 1;
const ghgValues = (base: number, growth: number, wave: number) => GHG_YEARS.map((year, index) => Number(((base + index * growth + Math.sin(index / 3) * wave) * shock(year)).toFixed(2)));
const GHG_SERIES: Series[] = [
  { name: "Agriculture", color: "#496fae", values: ghgValues(3.8, .055, .22) },
  { name: "Bâtiments", color: "#be3940", values: ghgValues(2.1, .042, .18) },
  { name: "Production de combustibles", color: "#df8b32", values: ghgValues(1.4, .028, .14) },
  { name: "Combustion industrielle", color: "#5e7fb5", values: ghgValues(4.2, .082, .38) },
  { name: "Industrie énergétique", color: "#df6b32", values: ghgValues(10.4, .42, 1.1) },
  { name: "Procédés industriels", color: "#e5a532", values: ghgValues(1.1, .035, .16) },
  { name: "Transport", color: "#8ba4cc", values: ghgValues(3.4, .11, .32) },
  { name: "Déchets", color: "#e6a083", values: ghgValues(1.7, .025, .12) },
];
const GHG_PER_CAPITA = GHG_YEARS.map((year, index) => Number((3.3 + index * .06 + Math.sin(index / 4) * .35 - (year === 1999 ? 1.15 : 0) - (year === 2020 ? .75 : 0)).toFixed(2)));

const POLLUTANT_SERIES: Series[] = [
  { name: "Ammoniac (NH₃)", color: "#4f78b9", values: [128,132,137,144,148,151,149,147,153,162,151,145,143,136,121,108,119,125,123,116,104,118,111,98] },
  { name: "Oxydes d'azote (NOₓ)", color: "#dd6330", values: [42,44,46,49,51,53,55,57,58,60,61,63,64,65,66,68,70,71,72,73,74,76,77,79] },
  { name: "Particules fines (PM₂.₅)", color: "#d7a13b", values: [31,32,30,34,36,35,38,39,37,41,43,42,44,46,45,48,49,47,51,52,54,53,56,58] },
  { name: "Dioxyde de soufre (SO₂)", color: "#8d76a8", values: [55,54,56,58,57,60,62,61,63,65,64,62,61,59,58,57,55,54,53,52,50,49,48,46] },
];

export default function DashboardPage() {
  const [country, setCountry] = useState("Afrique");
  const [activeSection, setActiveSection] = useState("emissions");
  const [edgarDatasets, setEdgarDatasets] = useState<EdgarDataset[]>([]);
  const [emissionPayload, setEmissionPayload] = useState<EmissionSeriesPayload | null>(null);
  const [substance, setSubstance] = useState("All GHG");
  const [backendState, setBackendState] = useState<"loading" | "connected" | "partial" | "offline">("loading");
  const [territoryFacts, setTerritoryFacts] = useState<TerritoryFacts | null>(null);
  const selectedCountry = AFRICAN_COUNTRIES.find((item) => item.name === country);
  const selectedIso3 = selectedCountry?.iso3 ?? "AFR";

  const exportFactSheet = () => {
    const previousTitle = document.title;
    document.title = `Fiche émissions EDGAR — ${country} — GEOSSIA`;
    document.body.dataset.exportingDashboard = "true";
    window.setTimeout(() => {
      window.print();
      window.setTimeout(() => {
        document.title = previousTitle;
        delete document.body.dataset.exportingDashboard;
      }, 250);
    }, 120);
  };

  useEffect(() => {
    const controller = new AbortController();
    setBackendState("loading");
    Promise.allSettled([loadEdgarCatalog(controller.signal), loadEmissionSeries(selectedIso3, substance, controller.signal)]).then(([catalog, series]) => {
      if (catalog.status === "fulfilled") setEdgarDatasets(catalog.value);
      if (series.status === "fulfilled" && series.value) {
        setEmissionPayload(series.value);
        setBackendState("connected");
      } else if (catalog.status === "fulfilled" && catalog.value.length) {
        setEmissionPayload(null);
        setBackendState("partial");
      } else {
        setBackendState("offline");
      }
    });
    return () => controller.abort();
  }, [selectedIso3, substance]);

  useEffect(() => {
    const controller = new AbortController();
    const wfs = (filter: string) => {
      const params = new URLSearchParams({ service: "WFS", version: "2.0.0", request: "GetFeature", typeName: "geossia:country_indicator_series", outputFormat: "application/json", propertyName: "iso3,value", count: "200", CQL_FILTER: filter });
      return fetch(`/geoserver/geossia/wms?${params}`, { signal: controller.signal }).then((response) => response.ok ? response.json() : Promise.reject(new Error(String(response.status))));
    };
    const isoCodes = AFRICAN_COUNTRIES.map((item) => item.iso3).join(";");
    Promise.allSettled([
      wfs("indicator='climatetrace_emissions' AND sub_indicator='total' AND year=2025"),
      wfs("indicator='wdi' AND sub_indicator='population_total' AND year=2025"),
      fetch(`https://api.worldbank.org/v2/country/${isoCodes}/indicator/NY.GDP.MKTP.CD?format=json&mrnev=1&per_page=100`, { signal: controller.signal }).then((response) => response.ok ? response.json() : Promise.reject(new Error(String(response.status)))),
    ]).then(([emissionsResult, populationResult, gdpResult]) => {
      const toMap = (result: PromiseSettledResult<{ features?: { properties?: { iso3?: string; value?: number } }[] }>) => new Map(result.status === "fulfilled" ? (result.value.features ?? []).flatMap((feature) => {
        const iso3 = feature.properties?.iso3, value = Number(feature.properties?.value);
        return iso3 && Number.isFinite(value) ? [[iso3, value] as [string, number]] : [];
      }) : []);
      const emissions = toMap(emissionsResult as PromiseSettledResult<{ features?: { properties?: { iso3?: string; value?: number } }[] }>);
      const population = toMap(populationResult as PromiseSettledResult<{ features?: { properties?: { iso3?: string; value?: number } }[] }>);
      const gdp = new Map<string, number>();
      if (gdpResult.status === "fulfilled" && Array.isArray(gdpResult.value?.[1])) for (const row of gdpResult.value[1]) if (row.countryiso3code && Number.isFinite(Number(row.value))) gdp.set(row.countryiso3code, Number(row.value));
      const total = (map: Map<string, number>) => [...map.values()].reduce((sum, value) => sum + value, 0);
      const selected = (map: Map<string, number>) => selectedIso3 === "AFR" ? total(map) : (map.get(selectedIso3) ?? 0);
      const emissionTotal = total(emissions), populationTotal = total(population), gdpTotal = total(gdp);
      setTerritoryFacts({ emissions: selected(emissions), emissionShare: emissionTotal ? selected(emissions) / emissionTotal * 100 : 0, population: selected(population), populationShare: populationTotal ? selected(population) / populationTotal * 100 : 0, gdp: gdp.size ? selected(gdp) : null, gdpShare: gdpTotal ? selected(gdp) / gdpTotal * 100 : null });
    });
    return () => controller.abort();
  }, [selectedIso3]);

  return (
    <main className="fs-dashboard">
      <div className="fs-print-header" aria-hidden="true">
        <div className="fs-print-brand"><span>GEOSSIA</span><small>Climat & Alertes · Composante 2</small></div>
        <div className="fs-print-title"><span>Fiche territoriale EDGAR</span><strong>{country}</strong></div>
        <div className="fs-print-meta"><span>Édition du {new Date().toLocaleDateString("fr-FR")}</span><span>Source : JRC · EDGAR 2026 GHG</span></div>
      </div>
      <header className="fs-head">
        <div>
          <span className="fs-eyebrow">Outils · Composante 2</span>
          <h1>Tableau de bord climatique</h1>
          <p>Profil synthétique, tendances historiques et signaux d'alerte par territoire.</p>
        </div>
        <div className={`fs-status ${backendState}`}><i />{backendState === "connected" ? `Séries ${emissionPayload?.source ?? "GES"} connectées` : backendState === "partial" ? `Backend connecté · ${edgarDatasets.length} produits EDGAR · séries en attente` : backendState === "offline" ? "Backend indisponible · données de démonstration" : "Connexion au backend…"}</div>
      </header>

      <section className="fs-filters" aria-label="Filtres globaux">
        <label>Territoire
          <select value={country} onChange={(event) => setCountry(event.target.value)}>
            <option>Afrique</option>
            {AFRICAN_COUNTRIES.map((item) => <option key={item.iso3} value={item.name}>{item.name}</option>)}
          </select>
        </label>
        <button className="fs-export" onClick={exportFactSheet} title="Exporter cette fiche en PDF"><span className="fs-export-icon">⇩</span><span><strong>Exporter la fiche</strong><small>Document PDF</small></span></button>
      </section>

      <section className="fs-map-card">
        <div className="fs-map-copy">
          <span className="fs-section-no">01 · Vue territoriale</span>
          <h2>{country}</h2>
          <p>Survolez la carte pour consulter les valeurs. La géométrie et les indicateurs seront alimentés depuis la base.</p>
          <Link to="/geoportail"><MapIcon size={16} /> Ouvrir le géoportail détaillé</Link>
        </div>
        <div className="fs-map" role="img" aria-label={`Carte climatique de ${country}`}>
          <DashboardCountryMap selectedIso3={selectedIso3} onSelect={(iso3) => setCountry(AFRICAN_COUNTRIES.find((item) => item.iso3 === iso3)?.name ?? country)} />
          <div className="fs-map-label"><strong>{country}</strong><span>{selectedIso3} · GES 2025 · Climate TRACE</span></div>
          <div className="fs-legend"><span>Faibles</span><i /><i /><i /><i /><i /><span>Élevées</span></div>
        </div>
      </section>

      <section className="fs-fact-strip" aria-label="Profil socio-économique et carbone">
        <FactCard title="Part des émissions africaines" value={territoryFacts ? `${territoryFacts.emissionShare.toLocaleString("fr-FR", { maximumFractionDigits: 2 })} %` : "—"} detail={territoryFacts ? `${territoryFacts.emissions.toLocaleString("fr-FR", { maximumFractionDigits: 1 })} MtCO₂e · 2025` : "Chargement…"} progress={territoryFacts?.emissionShare ?? 0} />
        <FactCard title="Part du PIB africain" value={territoryFacts?.gdpShare !== null && territoryFacts?.gdpShare !== undefined ? `${territoryFacts.gdpShare.toLocaleString("fr-FR", { maximumFractionDigits: 2 })} %` : "—"} detail={territoryFacts?.gdp ? `${(territoryFacts.gdp / 1e9).toLocaleString("fr-FR", { maximumFractionDigits: 1 })} Md USD · Banque mondiale` : "Donnée indisponible"} progress={territoryFacts?.gdpShare ?? 0} />
        <FactCard title="Part de la population africaine" value={territoryFacts ? `${territoryFacts.populationShare.toLocaleString("fr-FR", { maximumFractionDigits: 2 })} %` : "—"} detail={territoryFacts ? `${(territoryFacts.population / 1e6).toLocaleString("fr-FR", { maximumFractionDigits: 2 })} millions d'habitants · 2025` : "Chargement…"} progress={territoryFacts?.populationShare ?? 0} />
      </section>

      <nav className="fs-section-nav" aria-label="Sections du tableau de bord">
        {[["emissions", "Gaz à effet de serre"], ["climat", "Climat"], ["secheresse", "Sécheresse"], ["polluants", "Polluants"], ["projection", "Projections"]].map(([id, label]) => (
          <button key={id} className={activeSection === id ? "active" : ""} onClick={() => setActiveSection(id)}>{label}</button>
        ))}
      </nav>

      {activeSection === "climat" && <>
        <ChartSection number="02" title="Températures" description="Évolution annuelle des températures moyennes, minimales et maximales." series={CLIMATE_SERIES} unit="°C" selectors={["Variable", "Agrégation", "Scénario"]} />
        <ChartSection number="03" title="Précipitations" description="Cumul annuel comparé à la moyenne climatologique." series={RAIN_SERIES} unit="mm/an" selectors={["Produit", "Agrégation"]} />
      </>}

      {activeSection === "secheresse" && <ChartSection number="02" title="Indices de sécheresse" description="SPI-3 et SPI-12 pour le suivi des déficits météorologiques et hydrologiques." series={SPI_SERIES} unit="indice" selectors={["Indice", "Échelle temporelle", "Niveau d'alerte"]} baseline />}

      {activeSection === "emissions" && <>
        <GreenhouseGasSection payload={emissionPayload} substance={substance} onSubstanceChange={setSubstance} />
        <SectorBreakdown payload={emissionPayload} />
      </>}

      {activeSection === "polluants" && <>
        <PollutantSection />
        <BreakdownTable title="Inventaire des polluants suivis" rows={[["Ammoniac","NH₃","Agriculture"],["Oxydes d'azote","NOₓ","Transport et énergie"],["Particules fines","PM₂.₅","Combustion"],["Dioxyde de soufre","SO₂","Industrie et énergie"],["Monoxyde de carbone","CO","Combustion incomplète"],["Composés organiques volatils","COVNM","Solvants et industrie"]]} />
      </>}

      {activeSection === "projection" && <ChartSection number="02" title="Projections climatiques" description="Évolution multi-modèles selon les trajectoires climatiques sélectionnées." series={CLIMATE_SERIES.slice(0, 1)} unit="°C" selectors={["Scénario SSP", "Horizon", "Modèle"]} />}

      <footer className="fs-foot">
        <span>Sources indicatives : CRU TS · CHIRPS · CMIP6</span>
        <span>Les valeurs de démonstration seront remplacées par l'API de la base.</span>
      </footer>
    </main>
  );
}

function FactCard({ title, value, detail, progress }: { title: string; value: string; detail: string; progress: number }) {
  return <article className="fs-fact-card"><span>{title}</span><div className="fs-semi"><i style={{ "--progress": `${progress * 1.8}deg` } as CSSProperties} /><strong>{value}</strong></div><p>{detail}</p></article>;
}

function BreakdownTable({ title, rows }: { title: string; rows: string[][] }) {
  const percentages = rows.map((row) => Number.parseFloat(row[2].replace(",", ".")) || 0);
  const maximum = Math.max(...percentages, 1);
  return <section className="fs-breakdown">
    <header className="fs-breakdown-head"><div><span>Profil sectoriel</span><h3>{title}</h3></div><small>Part des émissions · dernière année disponible</small></header>
    <div className="fs-breakdown-grid">{rows.map((row, index) => <article key={row[0]}>
      <span className="fs-bd-rank">{String(index + 1).padStart(2, "0")}</span>
      <div className="fs-bd-main">
        <div className="fs-bd-copy"><strong>{row[0]}</strong><span>{row[1]}</span></div>
        <div className="fs-bd-track" aria-label={`${row[0]} : ${row[2]}`}><i style={{ width: `${percentages[index] / maximum * 100}%` }} /></div>
        <small>{row[2]} du total</small>
      </div>
    </article>)}</div>
  </section>;
}

function SectorBreakdown({ payload }: { payload: EmissionSeriesPayload | null }) {
  const rows = useMemo(() => {
    const sectors = payload?.sectors ?? GHG_SERIES.map((s) => ({ label: s.name, color: s.color, values: s.values }));
    const lastValues = sectors.map((s) => ({ label: s.label, color: s.color ?? "#496fae", value: s.values[s.values.length - 1] ?? 0 }));
    const total = lastValues.reduce((sum, r) => sum + r.value, 0) || 1;
    return lastValues.sort((a, b) => b.value - a.value).map((r) => ({ ...r, pct: r.value / total * 100 }));
  }, [payload]);
  const max = rows[0]?.value ?? 1;
  const lastYear = payload?.years?.[payload.years.length - 1] ?? GHG_YEARS[GHG_YEARS.length - 1];
  const unit = payload?.unit ?? "MtCO₂e";

  return <section className="fs-sector-breakdown">
    <header><div><span className="fs-section-no">Profil sectoriel</span><h3>Répartition — {lastYear}</h3></div><small>Part des émissions · {unit}</small></header>
    <ul className="fs-sector-list">
      {rows.map((r) => <li key={r.label}>
        <span className="fs-sector-dot" style={{ background: r.color }} />
        <span className="fs-sector-name">{r.label}</span>
        <span className="fs-sector-bar"><i style={{ width: `${r.value / max * 100}%`, background: r.color }} /></span>
        <span className="fs-sector-val">{r.value.toLocaleString("fr-FR", { maximumFractionDigits: 1 })} {unit}</span>
        <span className="fs-sector-pct">{r.pct.toFixed(1)} %</span>
      </li>)}
    </ul>
  </section>;
}

function GreenhouseGasSection({ payload, substance, onSubstanceChange }: { payload: EmissionSeriesPayload | null; substance: string; onSubstanceChange: (s: string) => void }) {
  const [hover, setHover] = useState<number | null>(41);
  const [selectedSector, setSelectedSector] = useState("all");
  const series = useMemo(() => payload?.sectors.map((item, index) => ({ name: item.label, color: item.color ?? GHG_SERIES[index % GHG_SERIES.length].color, values: item.values })) ?? GHG_SERIES, [payload]);
  const years = payload?.years ?? GHG_YEARS;
  const perCapita = payload ? (payload.per_capita ?? []) : GHG_PER_CAPITA;
  const gasLabel = substance === "All GHG" ? "GES" : substance === "CO2" ? "CO₂" : substance === "CH4" ? "CH₄" : substance === "N2O" ? "N₂O" : "F-Gas";
  const [visible, setVisible] = useState(() => new Set(series.map((item) => item.name)));
  useEffect(() => { setVisible(new Set(series.map((item) => item.name))); setSelectedSector("all"); setHover(Math.min(41, years.length - 1)); }, [series, years.length]);
  const active = series.filter((item) => visible.has(item.name) && (selectedSector === "all" || item.name === selectedSector));
  const W = 1100, H = 470, L = 72, R = 72, T = 28, B = 112;
  const x = (index: number) => L + index * ((W - L - R) / (years.length - 1));
  const totals = years.map((_, index) => active.reduce((sum, item) => sum + item.values[index], 0));
  const max = Math.max(1, ...totals) * 1.08;
  const leftTicks = Array.from({ length: 5 }, (_, index) => index * max / 4);
  const y = (value: number) => T + (max - value) * ((H - T - B) / max);
  const validPerCapita = perCapita.filter(Number.isFinite);
  const rightMin = validPerCapita.length ? Math.min(...validPerCapita) * .9 : 0;
  const rightMax = validPerCapita.length ? Math.max(...validPerCapita) * 1.1 : 1;
  const rightTicks = Array.from({ length: 5 }, (_, index) => rightMin + index * (rightMax - rightMin) / 4);
  const yRight = (value: number) => T + (rightMax - value) * ((H - T - B) / Math.max(.001, rightMax - rightMin));
  let cumulative = Array(years.length).fill(0) as number[];
  const areas = active.map((item) => {
    const bottom = [...cumulative];
    const top = cumulative.map((value, index) => value + item.values[index]);
    cumulative = top;
    const path = top.map((value, index) => `${index ? "L" : "M"}${x(index)},${y(value)}`).join(" ") + " " + bottom.map((_, index) => `L${x(bottom.length - 1 - index)},${y(bottom[bottom.length - 1 - index])}`).join(" ") + " Z";
    return { item, path };
  });
  const redPath = perCapita.map((value, index) => Number.isFinite(value) ? `${index ? "L" : "M"}${x(index)},${yRight(value)}` : "").join(" ");
  const toggle = (name: string) => setVisible((current) => { const next = new Set(current); next.has(name) ? next.delete(name) : next.add(name); return next; });

  return <section className="fs-chart-section fs-ghg">
    <header><div><span className="fs-section-no">02 · Émissions</span><h2>Gaz à effet de serre</h2><p>Émissions territoriales de GES hors forêts et usage des terres (LULUCF), empilées par secteur.</p></div><button className="fs-menu" aria-label="Options d'export">☰</button></header>
    <div className="fs-chart-filters fs-ghg-filters">
      <label>Regrouper par<select value="Secteur" disabled><option>Secteur</option></select></label>
      <label>Substance<select value={substance} onChange={(e) => onSubstanceChange(e.target.value)}>{SUBSTANCES.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}</select></label>
      <label>Secteur<select value={selectedSector} onChange={(event) => setSelectedSector(event.target.value)}><option value="all">Tous les secteurs</option>{series.map((item) => <option key={item.name} value={item.name}>{item.name}</option>)}</select></label>
      <label>Indicateur complémentaire<select value="none" disabled title="Population et PIB non publiés dans cette série"><option value="none">Aucun</option></select></label>
    </div>
    <div className="fs-chart-wrap fs-stacked-wrap">
      <h3>{selectedSector === "all" ? `Émissions de ${substance === "All GHG" ? "GES" : substance} par secteur` : `Émissions de ${substance === "All GHG" ? "GES" : substance} — ${selectedSector}`}</h3>
      <svg className="fs-chart" viewBox={`0 0 ${W} ${H}`} onMouseLeave={() => setHover(null)}>
        {leftTicks.map((tick) => <g key={tick}><line x1={L} x2={W-R} y1={y(tick)} y2={y(tick)} className="grid"/><text x={L-12} y={y(tick)+4} textAnchor="end">{tick.toLocaleString("fr-FR", {maximumFractionDigits: max < 10 ? 2 : max < 100 ? 1 : 0})}</text></g>)}
        {!!validPerCapita.length && rightTicks.map((tick) => <text key={tick} x={W-R+14} y={yRight(tick)+4} className="right-tick">{tick.toLocaleString("fr-FR", { minimumFractionDigits: rightMax < 1 ? 3 : 2, maximumFractionDigits: rightMax < 1 ? 3 : 2 })}</text>)}
        {areas.map(({item,path}) => <path key={item.name} d={path} fill={item.color} stroke={item.color} strokeWidth="1.2" opacity=".9"/>)}
        {!!validPerCapita.length && <path d={redPath} className="ghg-cap-line" />}
        {perCapita.map((value,index) => Number.isFinite(value) ? <path key={index} d={`M${x(index)-4},${yRight(value)+4} L${x(index)},${yRight(value)-4} L${x(index)+4},${yRight(value)+4} Z`} fill="#f11" /> : null)}
        <line x1={L} x2={W-R} y1={H-B} y2={H-B} className="x-axis-line" />
        {years.map((year,index) => { const step = Math.max(1, Math.ceil(years.length / 25)); const showLabel = index % step === 0 || index === years.length - 1; return <g key={year}>{showLabel&&<><line x1={x(index)} x2={x(index)} y1={H-B} y2={H-B+8} className="x-axis-tick"/><text x={x(index)} y={H-72} textAnchor="end" transform={`rotate(-48 ${x(index)} ${H-72})`}>{year}</text></>}<rect x={x(index)-9} y={T} width="18" height={H-T-B} fill="transparent" onMouseEnter={()=>setHover(index)}/></g>; })}
        {hover !== null && <line x1={x(hover)} x2={x(hover)} y1={T} y2={H-B} className="cursor"/>}
        <text transform={`translate(18 ${H/2}) rotate(-90)`} textAnchor="middle" className="axis-title">{payload?.unit ?? "Mt CO₂"} / an</text>
        {!!validPerCapita.length && <text transform={`translate(${W-12} ${(T + H - B) / 2}) rotate(90)`} textAnchor="middle" className="axis-title right-axis">t {gasLabel} / hab. / an</text>}
      </svg>
      {hover !== null && hover < years.length && <div className="fs-tooltip fs-ghg-tooltip" style={{left:`${7+(hover/(years.length-1))*84}%`}}><strong>{years[hover]}</strong>{active.map((item)=><span key={item.name}><i style={{background:item.color}}/>{item.name}<b>{item.values[hover].toFixed(2)} {payload?.unit ?? "Mt"}</b></span>)}{Number.isFinite(perCapita[hover]) && <span className="red"><i/>{gasLabel} par habitant<b>{perCapita[hover]} t</b></span>}</div>}
      <div className="fs-legend fs-ghg-legend">{series.map((item)=><button key={item.name} className={visible.has(item.name) && (selectedSector === "all" || selectedSector === item.name)?"":"off"} onClick={()=>{setSelectedSector("all"); toggle(item.name);}}><i style={{background:item.color}}/>{item.name}</button>)}{!!validPerCapita.length && <span className="cap"><i/>Total {gasLabel}/hab.</span>}</div>
    </div>
    <p className="fs-source-state">Source affichée : {payload?.source ?? "données de démonstration"} · {payload?.release ?? "aucune série backend"}{payload?.source !== "EDGAR" && <span> · Cette série n’est pas la série nationale EDGAR 1970–2025.</span>}</p>
    <div className="fs-chart-note"><TrendingUp size={15}/> Cliquez sur les éléments de légende pour activer ou désactiver les secteurs. Le menu permet l'export du graphique et des données.</div>
  </section>;
}

const POLLUTANT_SECTORS = [
  { name: "Agriculture", color: "#6f91c5", share: .38 },
  { name: "Bâtiments", color: "#de7449", share: .17 },
  { name: "Industrie énergétique", color: "#e7ad3e", share: .14 },
  { name: "Transport", color: "#91a8ce", share: .22 },
  { name: "Autres combustions industrielles", color: "#e8a585", share: .09 },
];

function PollutantSection() {
  const [pollutant, setPollutant] = useState("Oxydes d'azote (NOₓ)");
  const [sector, setSector] = useState("all");
  const [hover, setHover] = useState<number | null>(null);
  const total = POLLUTANT_SERIES.find((item) => item.name === pollutant) ?? POLLUTANT_SERIES[1];
  const series = useMemo(() => POLLUTANT_SECTORS.map((item, sectorIndex) => ({
    name: item.name, color: item.color,
    values: total.values.map((value, index) => value * item.share * (1 + Math.sin(index / 4 + sectorIndex) * .08)),
  })), [total]);
  const active = sector === "all" ? series : series.filter((item) => item.name === sector);
  const W = 1100, H = 430, L = 72, R = 30, T = 28, B = 78;
  const x = (index: number) => L + index * ((W - L - R) / (YEARS.length - 1));
  const totals = YEARS.map((_, index) => active.reduce((sum, item) => sum + item.values[index], 0));
  const max = Math.max(...totals) * 1.12;
  const y = (value: number) => T + (max - value) * ((H - T - B) / max);
  const ticks = Array.from({ length: 6 }, (_, index) => index * max / 5);
  let cumulative = Array(YEARS.length).fill(0) as number[];
  const areas = active.map((item) => {
    const bottom = [...cumulative];
    const top = cumulative.map((value, index) => value + item.values[index]);
    cumulative = top;
    return { item, path: top.map((value, index) => `${index ? "L" : "M"}${x(index)},${y(value)}`).join(" ") + " " + bottom.map((_, index) => `L${x(bottom.length - 1 - index)},${y(bottom[bottom.length - 1 - index])}`).join(" ") + " Z" };
  });
  const symbol = pollutant.match(/\(([^)]+)\)/)?.[1] ?? pollutant;
  return <section className="fs-chart-section fs-pollutants">
    <header><div><span className="fs-section-no">03 · Qualité de l'air</span><h2>Polluants atmosphériques et toxiques</h2><p>Évolution annuelle des émissions atmosphériques, ventilée par secteur d'activité.</p></div><button className="fs-menu" aria-label="Options d'export">☰</button></header>
    <div className="fs-chart-filters fs-pollutant-filters">
      <label>Substance<select value={pollutant} onChange={(event) => setPollutant(event.target.value)}>{POLLUTANT_SERIES.map((item) => <option key={item.name}>{item.name}</option>)}</select></label>
      <label>Secteur<select value={sector} onChange={(event) => setSector(event.target.value)}><option value="all">Tous les secteurs</option>{series.map((item) => <option key={item.name}>{item.name}</option>)}</select></label>
    </div>
    <div className="fs-chart-wrap fs-stacked-wrap">
      <h3>Émissions de {symbol} par secteur</h3>
      <svg className="fs-chart" viewBox={`0 0 ${W} ${H}`} onMouseLeave={() => setHover(null)}>
        {ticks.map((tick) => <g key={tick}><line x1={L} x2={W-R} y1={y(tick)} y2={y(tick)} className="grid"/><text x={L-12} y={y(tick)+4} textAnchor="end">{tick.toFixed(0)}</text></g>)}
        {areas.map(({ item, path }) => <path key={item.name} d={path} fill={item.color} stroke={item.color} strokeWidth="1.3" opacity=".92"/>)}
        {YEARS.map((year,index) => <g key={year}>{(index%4===0||index===YEARS.length-1)&&<text x={x(index)} y={H-34} textAnchor="middle">{year}</text>}<rect x={x(index)-14} y={T} width="28" height={H-T-B} fill="transparent" onMouseEnter={()=>setHover(index)}/></g>)}
        {hover !== null && <line x1={x(hover)} x2={x(hover)} y1={T} y2={H-B} className="cursor"/>}
        <text transform={`translate(18 ${H/2}) rotate(-90)`} textAnchor="middle" className="axis-title">kt / an</text>
      </svg>
      {hover !== null && <div className="fs-tooltip" style={{left:`${7+(hover/(YEARS.length-1))*84}%`}}><strong>{YEARS[hover]}</strong>{active.map((item)=><span key={item.name}><i style={{background:item.color}}/>{item.name}<b>{item.values[hover].toFixed(1)} kt</b></span>)}</div>}
      <div className="fs-legend fs-ghg-legend">{series.map((item)=><button key={item.name} className={sector === "all" || sector === item.name ? "" : "off"} onClick={()=>setSector(item.name)}><i style={{background:item.color}}/>{item.name}</button>)}</div>
    </div>
    <p className="fs-source-state">Source : produits EDGAR AP disponibles dans le catalogue backend · visualisation sectorielle en attente de la série détaillée.</p>
  </section>;
}

function ChartSection({ number, title, description, series, unit, selectors, baseline = false }: { number: string; title: string; description: string; series: Series[]; unit: string; selectors: string[]; baseline?: boolean }) {
  const [hover, setHover] = useState<number | null>(null);
  return <section className="fs-chart-section">
    <header><div><span className="fs-section-no">{number} · Analyse</span><h2>{title}</h2><p>{description}</p></div><button className="fs-menu" aria-label="Options d'export">☰</button></header>
    <div className="fs-chart-filters">
      {selectors.map((label, index) => <label key={label}>{label}<select><option>{index === 0 ? series[0].name : "Toutes les valeurs"}</option></select></label>)}
    </div>
    <LineChart years={YEARS} series={series} unit={unit} hover={hover} onHover={setHover} baseline={baseline} />
    <div className="fs-chart-note"><TrendingUp size={15} /> Survolez le graphique pour afficher les valeurs annuelles. Les séries peuvent être activées depuis la légende.</div>
  </section>;
}

function LineChart({ years, series, unit, hover, onHover, baseline }: { years: number[]; series: Series[]; unit: string; hover: number | null; onHover(index: number | null): void; baseline: boolean }) {
  const W = 1000, H = 330, L = 70, R = 24, T = 25, B = 48;
  const values = series.flatMap((item) => item.values);
  const min = baseline ? Math.min(-2, ...values) : Math.min(...values) * 0.94;
  const max = baseline ? Math.max(2, ...values) : Math.max(...values) * 1.04;
  const x = (index: number) => L + index * ((W - L - R) / (years.length - 1));
  const y = (value: number) => T + (max - value) * ((H - T - B) / (max - min));
  const ticks = Array.from({ length: 5 }, (_, index) => min + index * ((max - min) / 4));
  const paths = useMemo(() => series.map((item) => item.values.map((value, index) => `${index ? "L" : "M"}${x(index).toFixed(1)},${y(value).toFixed(1)}`).join(" ")), [series, min, max]);

  return <div className="fs-chart-wrap">
    <svg className="fs-chart" viewBox={`0 0 ${W} ${H}`} onMouseLeave={() => onHover(null)}>
      {ticks.map((tick) => <g key={tick}><line x1={L} x2={W - R} y1={y(tick)} y2={y(tick)} className="grid" /><text x={L - 12} y={y(tick) + 4} textAnchor="end">{tick.toFixed(baseline ? 1 : 0)}</text></g>)}
      {baseline && <line x1={L} x2={W - R} y1={y(0)} y2={y(0)} className="baseline" />}
      {series.map((item, index) => <path key={item.name} d={paths[index]} stroke={item.color} className="data-line" />)}
      {years.map((year, index) => <g key={year}>
        {(index % 4 === 0 || index === years.length - 1) && <text x={x(index)} y={H - 17} textAnchor="middle">{year}</text>}
        <rect x={x(index) - 18} y={T} width={36} height={H - T - B} fill="transparent" onMouseEnter={() => onHover(index)} />
      </g>)}
      {hover !== null && <><line x1={x(hover)} x2={x(hover)} y1={T} y2={H - B} className="cursor" />{series.map((item) => <circle key={item.name} cx={x(hover)} cy={y(item.values[hover])} r="4" fill={item.color} />)}</>}
      <text transform={`translate(18 ${H / 2}) rotate(-90)`} textAnchor="middle" className="axis-title">{unit}</text>
    </svg>
    {hover !== null && <div className="fs-tooltip" style={{ left: `${7 + (hover / (years.length - 1)) * 84}%` }}><strong>{years[hover]}</strong>{series.map((item) => <span key={item.name}><i style={{ background: item.color }} />{item.name}<b>{item.values[hover].toLocaleString("fr-FR")} {unit}</b></span>)}</div>}
    <div className="fs-legend">{series.map((item) => <span key={item.name}><i style={{ background: item.color }} />{item.name}</span>)}</div>
  </div>;
}
