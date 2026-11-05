import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Icon } from "../components/Icon";
import { useBundle, useTitle } from "../components/Layout";
import { INDICATORS, Indicator, colorFor, formatValue, legendFor } from "../data/indicators";
import { countryName } from "../data/countries";
import { BasemapId, FeatureStyle, MapCanvas } from "./MapCanvas";

const DATASETS = [
  {
    id: "cru", label: "CRU TS 4.09 — températures", provider: "University of East Anglia",
    coverage: "1901–2024 · annuel · pays", reference: "Anomalies vs 1961–1990",
    indicators: ["tmean-anom", "tmax-anom", "tmin-anom", "warming-trend"],
    quantities: ["Anomalie annuelle", "Tendance par décennie"], periods: ["Dernière année complète", "1981–2024"],
  },
  {
    id: "chirps", label: "CHIRPS v2 — précipitations", provider: "Climate Hazards Center, UCSB",
    coverage: "1981–présent · mensuel · pays", reference: "SPI calibré sur 1991–2020",
    indicators: ["spi1", "spi3", "spi12", "drought-alert", "spi12-trend"],
    quantities: ["SPI standardisé", "Niveau d’alerte OMM", "Tendance par décennie"], periods: ["1 mois", "3 mois", "12 mois", "1981–présent"],
  },
  {
    id: "cmip6", label: "CMIP6 CCKP — projections", provider: "World Bank Climate Change Knowledge Portal",
    coverage: "2041–2060 · médiane multi-modèles · pays", reference: "Changement vs 1995–2014",
    indicators: ["proj-ssp245", "proj-ssp585"],
    quantities: ["SSP2-4.5", "SSP5-8.5"], periods: ["2041–2060"],
  },
] as const;

function firstIndicator(dataset: string): Indicator {
  const ids = DATASETS.find((item) => item.id === dataset)?.indicators ?? DATASETS[0].indicators;
  return INDICATORS.find((item) => ids.includes(item.id as never)) ?? INDICATORS[0];
}

export default function ScientificGeoportalPage() {
  useTitle("Géoportail scientifique");
  const { bundle, error } = useBundle();
  const [dataset, setDataset] = useState("cru");
  const [indicatorId, setIndicatorId] = useState("tmean-anom");
  const [quantity, setQuantity] = useState<string>(DATASETS[0].quantities[0]);
  const [period, setPeriod] = useState<string>(DATASETS[0].periods[0]);
  const [basemap, setBasemap] = useState<BasemapId>("clair");
  const [selected, setSelected] = useState<string | null>(null);
  const [visible, setVisible] = useState(true);

  const datasetDefinition = DATASETS.find((item) => item.id === dataset) ?? DATASETS[0];
  const available = INDICATORS.filter((item) => datasetDefinition.indicators.includes(item.id as never));
  const indicator = available.find((item) => item.id === indicatorId) ?? firstIndicator(dataset);
  const styles = useMemo(() => {
    const result: Record<string, FeatureStyle> = {};
    for (const [iso3, zone] of Object.entries(bundle?.zones ?? {})) {
      if (iso3 === "AFR") continue;
      result[iso3] = { fill: colorFor(indicator, indicator.value(zone)), active: true };
    }
    return result;
  }, [bundle, indicator]);
  const legend = legendFor(indicator);
  const selectedZone = selected ? bundle?.zones[selected] : null;

  function changeDataset(value: string) {
    setDataset(value);
    setIndicatorId(firstIndicator(value).id);
    const definition = DATASETS.find((item) => item.id === value) ?? DATASETS[0];
    setQuantity(definition.quantities[0]);
    setPeriod(definition.periods[0]);
  }

  function changeQuantity(value: string) {
    setQuantity(value);
    if (dataset === "cmip6") setIndicatorId(value === "SSP5-8.5" ? "proj-ssp585" : "proj-ssp245");
    if (dataset === "cru" && value === "Tendance par décennie") setIndicatorId("warming-trend");
    if (dataset === "cru" && value === "Anomalie annuelle" && indicator.id === "warming-trend") setIndicatorId("tmean-anom");
    if (dataset === "chirps" && value === "Niveau d’alerte OMM") setIndicatorId("drought-alert");
    if (dataset === "chirps" && value === "Tendance par décennie") setIndicatorId("spi12-trend");
    if (dataset === "chirps" && value === "SPI standardisé" && ["drought-alert", "spi12-trend"].includes(indicator.id)) setIndicatorId("spi3");
  }

  return (
    <main className="scientific-gp">
      <header className="science-ribbon">
        <Link className="science-home" to="/geoportail" aria-label="Retour au géoportail">
          <Icon name="globe" size={25} />
          <span><b>AFRICA</b><small>Climate Explorer</small></span>
        </Link>
        <label><span>Jeu de données</span><select value={dataset} onChange={(e) => changeDataset(e.target.value)}>{DATASETS.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label>
        <label><span>Variable</span><select value={indicator.id} onChange={(e) => setIndicatorId(e.target.value)}>{available.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
        <label><span>Mesure / scénario</span><select value={quantity} onChange={(e) => changeQuantity(e.target.value)}>{datasetDefinition.quantities.map((item) => <option key={item}>{item}</option>)}</select></label>
        <label><span>Période</span><select value={period} onChange={(e) => setPeriod(e.target.value)}>{datasetDefinition.periods.map((item) => <option key={item}>{item}</option>)}</select></label>
      </header>

      <section className="science-map-stage">
        <MapCanvas level="countries" styles={styles} choroplethVisible={visible} selected={selected} basemap={basemap} overlays={[]} onSelect={setSelected} onHover={() => undefined} />
        {!bundle && <div className="science-loading">{error ? `Données indisponibles : ${error}` : "Chargement des indicateurs…"}</div>}

        <aside className="science-options">
          <div className="science-dataset-facts"><small>Producteur</small><strong>{datasetDefinition.provider}</strong></div>
          <div className="science-dataset-facts"><small>Couverture</small><strong>{datasetDefinition.coverage}</strong></div>
          <div className="science-dataset-facts science-dataset-facts--wide"><small>Référence scientifique</small><strong>{datasetDefinition.reference}</strong></div>
        </aside>

        <aside className="science-legend">
          <button className="science-edit" onClick={() => setVisible((value) => !value)} title="Afficher ou masquer la variable"><Icon name={visible ? "check" : "close"} size={15} /></button>
          <span>{indicator.unit}</span>
          <div className="science-gradient" style={{ background: `linear-gradient(to top, ${legend.map((item) => item.color).join(",")})` }} />
          <div className="science-ticks">{legend.slice().reverse().map((item) => <small key={item.label}>{item.label}</small>)}</div>
        </aside>

        <nav className="science-tools" aria-label="Outils cartographiques">
          <button onClick={() => setBasemap((value) => value === "clair" ? "satellite" : "clair")} title="Changer le fond"><Icon name="layers" /></button>
          <button title="Télécharger"><Icon name="download" /></button>
          <button title="Partager"><Icon name="arrowUpRight" /></button>
          <button title="Informations"><Icon name="info" /></button>
        </nav>

        {selected && selectedZone && (
          <div className="science-selection">
            <button onClick={() => setSelected(null)}><Icon name="close" size={14} /></button>
            <small>{countryName(selected)}</small>
            <strong>{formatValue(indicator, indicator.value(selectedZone))}</strong>
          </div>
        )}
      </section>

      <footer className="science-caption">
        <strong>{datasetDefinition.label} — {indicator.name}</strong>
        <span>{quantity} · {period} · {datasetDefinition.reference}</span>
      </footer>
    </main>
  );
}
