import { useState } from "react";
import { Link } from "react-router-dom";
import { Icon } from "../components/Icon";
import { PageHero, useBundle, useTitle } from "../components/Layout";
import { Segmented } from "../geoportal/controls";
import { INDICATORS, THEMES, Theme, formatValue, legendFor } from "../data/indicators";

export default function IndicatorsPage() {
  useTitle("Indicateurs");
  const { bundle } = useBundle();
  const [theme, setTheme] = useState<Theme | "all">("all");
  const list = INDICATORS.filter((i) => theme === "all" || i.theme === theme);
  const africa = bundle?.zones.AFR;

  return (
    <>
      <PageHero
        eyebrow="Catalogue"
        title="Indicateurs Climat & Alertes"
        lead="Onze indicateurs calculés pour l'Afrique et chacun de ses 55 pays, regroupés en trois familles. Chaque fiche indique la source, la fréquence, la méthode et la manière de lire la carte."
      >
        <Segmented<Theme | "all"> value={theme} options={[{ id: "all" as const, label: "Tous" }, ...THEMES.map((t) => ({ id: t.id, label: t.label }))]} onChange={setTheme} />
      </PageHero>
      <section className="section tight">
        <div className="container indicator-grid">
          {list.map((indicator) => (
            <article key={indicator.id} className="indicator-card">
              <header>
                <span className={`theme-tag ${indicator.theme}`}>{THEMES.find((t) => t.id === indicator.theme)?.label}</span>
                <span className="unit-tag">{indicator.unit}</span>
              </header>
              <h3>{indicator.name}</h3>
              <p>{indicator.description}</p>
              <div className="legend-strip">
                {legendFor(indicator).map((l) => <i key={l.label} style={{ background: l.color }} title={l.label} />)}
              </div>
              <dl className="meta">
                <div><dt>Source</dt><dd>{indicator.source}</dd></div>
                <div><dt>Fréquence</dt><dd>{indicator.frequency}</dd></div>
                <div><dt>Lecture</dt><dd>{indicator.howToRead}</dd></div>
                {africa && <div><dt>Afrique</dt><dd className="strong">{formatValue(indicator, indicator.value(africa))}</dd></div>}
              </dl>
              <Link to={`/geoportail?ind=${indicator.id}`} className="btn btn-ghost sm">
                Voir sur la carte <Icon name="arrowRight" size={15} />
              </Link>
            </article>
          ))}
        </div>
      </section>
    </>
  );
}
