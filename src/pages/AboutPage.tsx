import { Link } from "react-router-dom";
import { Icon } from "../components/Icon";
import { PageHero, useTitle } from "../components/Layout";

const STEPS = [
  { title: "Collecte", text: "Séries mensuelles CRU TS 4.09 (températures, 0,5°, 1901-2024), précipitations CHIRPS v2 (0,05°, depuis 1981) et projections CMIP6 de la Banque mondiale (CCKP, 0,25°)." },
  { title: "Agrégation", text: "Moyennes pondérées par la surface (cosinus de la latitude) sur les terres de chaque pays ; l'Afrique est la moyenne pondérée de ses pays." },
  { title: "Indicateurs", text: "Anomalies vs 1961-1990, SPI-1/3/12 selon la méthode OMM (loi gamma, référence 1991-2020), pentes de régression et changements projetés 2041-2060 vs 1995-2014." },
  { title: "Alertes", text: "Le SPI-3 du dernier mois disponible est classé selon les seuils OMM : vigilance (≤ −0,5), alerte (≤ −1), alerte maximale (≤ −1,5)." },
];

export default function AboutPage() {
  useTitle("À propos");
  return (
    <>
      <PageHero
        eyebrow="Composante 2"
        title="Climat & Alertes"
        lead="La composante 2 de GEOSSIA fournit aux décideurs, services météorologiques et acteurs de l'adaptation une lecture commune du climat africain : ce qui a changé, ce qui menace maintenant, et ce qui se prépare."
      />
      <section className="section tight">
        <div className="container about-grid">
          <div className="card">
            <h3>Objectifs</h3>
            <ul className="check-list">
              <li><Icon name="check" size={16} /> Suivre l'état du climat de chaque pays avec des indicateurs homogènes et comparables.</li>
              <li><Icon name="check" size={16} /> Signaler tôt les déficits de pluie pouvant évoluer en sécheresse agricole.</li>
              <li><Icon name="check" size={16} /> Mettre les tendances observées en regard des projections pour la planification de l'adaptation.</li>
              <li><Icon name="check" size={16} /> Diffuser des données ouvertes, documentées et réutilisables.</li>
            </ul>
          </div>
          <div className="card">
            <h3>Méthodologie</h3>
            <ol className="steps">
              {STEPS.map((s, i) => (
                <li key={s.title}><span>{i + 1}</span><div><strong>{s.title}</strong><p>{s.text}</p></div></li>
              ))}
            </ol>
          </div>
          <div className="card wide">
            <h3>Limites connues</h3>
            <p>Les valeurs nationales lissent les contrastes internes des grands pays. CRU revient à la climatologie là où aucune station n'est proche (Sahara central, Afrique centrale), ce qui atténue les anomalies dans ces zones. Le SPI n'est pas défini pour les mois où la pluie de référence est quasi nulle. Les projections CMIP6 sont des médianes d'ensemble et ne représentent pas l'incertitude entre modèles.</p>
            <div className="hero-actions">
              <Link to="/ressources" className="btn btn-dark">Sources et méthodes <Icon name="arrowRight" size={16} /></Link>
              <Link to="/geoportail" className="btn btn-ghost">Géoportail</Link>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
