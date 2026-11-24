import { Link } from "react-router-dom";
import {
  Thermometer,
  AlertTriangle,
  TrendingUp,
  Map as MapIcon,
} from "../components/Icon";

const climateThemes = [
  {
    to: "/geoportail",
    photo: "/images/satellite-africa.jpg",
    photoCredit: "© Live Science",
    icon: Thermometer,
    pill: "Observations",
    title: "Suivi des conditions climatiques",
    desc: "Précipitations, températures et tendances climatiques, sécheresses et stress hydrique, inondations et feux de végétation.",
  },
  {
    to: "/geoportail",
    photo: "/images/drought-texture.jpg",
    photoCredit: "© Pexels",
    icon: AlertTriangle,
    pill: "Risques",
    title: "Évaluation des risques climatiques",
    desc: "Exposition, vulnérabilité et adaptation, projections climatiques et scénarios futurs pour anticiper les phénomènes extrêmes.",
  },
  {
    to: "/geoportail",
    photo: "/images/country-mali.jpg",
    photoCredit: "© Britannica",
    icon: TrendingUp,
    pill: "Engagements",
    title: "Suivi des engagements climatiques",
    desc: "Émissions et absorptions de gaz à effet de serre, alerte précoce et appui au suivi des contributions et plans nationaux.",
  },
];

const thematiques = [
  "Précipitations, températures et tendances climatiques",
  "Sécheresses et stress hydrique",
  "Inondations et risques hydrométéorologiques",
  "Feux de végétation et risques d'incendie",
  "Projections climatiques et scénarios futurs",
  "Exposition, vulnérabilité et adaptation climatique",
  "Émissions et absorptions de gaz à effet de serre (GES)",
  "Alerte précoce et appui au suivi des engagements climatiques",
];

const alignement = [
  {
    label: "Cadre international",
    value: "Accord de Paris (2015).",
  },
  {
    label: "Objectifs mondiaux",
    value:
      "Limiter l'élévation de la température mondiale nettement en dessous de 2 °C et poursuivre les efforts pour la limiter à 1,5 °C ; renforcer les capacités d'adaptation et la résilience climatique.",
  },
  {
    label: "Engagements nationaux",
    value:
      "Contributions déterminées au niveau national (CDN) et Plans nationaux d'adaptation (PNA).",
  },
  {
    label: "Indicateurs de référence",
    value:
      "Émissions et absorptions de gaz à effet de serre (GES), indicateurs de suivi des CDN et indicateurs de l'Objectif mondial en matière d'adaptation (GGA).",
  },
  {
    label: "Approche de suivi",
    value:
      "Inventaires de GES, surveillance des variables et extrêmes climatiques, évaluation des risques, vulnérabilité et progrès en matière d'adaptation.",
  },
  {
    label: "Rapportage international",
    value:
      "Cadre de transparence renforcé (ETF), notamment les Rapports biennaux de transparence (BTR).",
  },
  {
    label: "Évaluation mondiale",
    value: "Bilan mondial de l'Accord de Paris (Global Stocktake).",
  },
  {
    label: "Horizons de référence",
    value:
      "2030 pour les CDN et les objectifs d'adaptation, avec des perspectives de long terme à l'horizon 2050 et au-delà.",
  },
];

export default function HomePage() {
  return (
    <>
      {/* ===================== HERO (CCNUCC focus) ===================== */}
      <section className="hero">
        <div
          className="hero-bg"
          style={{ backgroundImage: "url(/images/hero-sahel.jpg)" }}
          aria-hidden="true"
        />
        <div className="container hero-inner">
          <div className="kicker light">
            <span className="accent">●</span> Convention-cadre des Nations unies sur les changements climatiques (CCNUCC)
          </div>
          <h1>
            Observatoire Climat &amp; Alertes
            <br />
            <em>Surveiller, anticiper, renforcer la résilience</em>.
          </h1>
          <p className="lead light">
            Surveiller les changements climatiques, anticiper les risques et
            renforcer la résilience des territoires. Des données, des
            indicateurs et des outils d'analyse au service des stratégies
            d'adaptation et d'atténuation, en cohérence avec l'Accord de Paris
            et la Convention-cadre des Nations unies sur les changements
            climatiques (CCNUCC).
          </p>
        </div>

        <div className="hero-scroll" aria-hidden="true">
          Défiler
        </div>
      </section>

      {/* ===================== TROIS ENTRÉES CLIMATIQUES (cartes photo) ===================== */}
      <section className="section">
        <div className="container">
          <div className="section-head">
            <h2>Trois façons d'<em>explorer</em> le climat.</h2>
            <p className="lead">
              L'Observatoire Climat &amp; Alertes de la Plateforme AFRICA met à votre
              disposition des données, des indicateurs et des outils d'analyse
              pour suivre les conditions climatiques, évaluer les risques et
              appuyer le suivi des engagements nationaux.
            </p>
          </div>

          <div className="theme-grid-3">
            {climateThemes.map((t, i) => {
              const Icon = t.icon;
              return (
                <Link key={i} to={t.to} className="theme-card-photo">
                  <div className="photo">
                    <img src={t.photo} alt={t.title} loading="lazy" />
                    <span className="photo-credit">{t.photoCredit}</span>
                  </div>
                  <span className="theme-icon-pill">
                    <span className="ico"><Icon size={14} /></span>
                    {t.pill}
                  </span>
                  <h3>{t.title}</h3>
                  <p>{t.desc}</p>
                </Link>
              );
            })}
          </div>
        </div>
      </section>

      {/* ===================== COMPOSANTE CLIMAT — DESCRIPTION ===================== */}
      <section className="welcome-section">
        <div className="welcome-photo">
          <img
            src="/images/hero-sahel.jpg"
            alt="Épisode de fortes pluies et d'inondations dans un paysage africain"
            loading="lazy"
          />
          <span className="photo-credit">© One Earth</span>
        </div>
        <div className="welcome-content">
          <div className="kicker">Observatoire Climat &amp; Alertes · Plateforme AFRICA</div>
          <h2>
            Suivre l'évolution du climat et renforcer la <em>résilience</em> des territoires.
          </h2>
          <p>
            Vous souhaitez suivre l'évolution du climat en Afrique, comprendre
            les tendances et les phénomènes extrêmes, évaluer les risques
            climatiques et suivre les progrès en matière d'adaptation et
            d'atténuation des changements climatiques ?
          </p>
          <p>
            L'Observatoire Climat &amp; Alertes de la Plateforme AFRICA vous accompagne dans
            cette démarche. Elle met à votre disposition des données, des
            indicateurs et des outils d'analyse pour suivre les conditions
            climatiques, identifier les territoires et les populations
            vulnérables, évaluer les risques de sécheresse, d'inondation et de
            feux de végétation, analyser les émissions et absorptions de gaz à
            effet de serre (GES) et appuyer les dispositifs d'alerte précoce.
          </p>
          <p>
            La Composante valorise les observations et projections climatiques
            ainsi que les informations issues des rapports nationaux,
            notamment les Rapports biennaux de transparence (BTR). En cohérence
            avec l'Accord de Paris et la Convention-cadre des Nations unies
            sur les changements climatiques (CCNUCC), elle fournit des
            connaissances utiles pour orienter les stratégies d'adaptation et
            d'atténuation, renforcer la résilience climatique et appuyer le
            suivi des engagements nationaux.
          </p>

          <div className="thematiques-list">
            <strong>Thématiques couvertes</strong>
            <ul>
              {thematiques.map((t, i) => (
                <li key={i}>{t}</li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* ===================== ALIGNEMENT AVEC LES CADRES INTERNATIONAUX ===================== */}
      <section className="section alignement-section">
        <div className="container">
          <div className="section-head">
            <div className="kicker">Alignement international</div>
            <h2>Alignement avec les <em>cadres internationaux</em>.</h2>
            <p className="lead">
              Une démarche cohérente avec l'Accord de Paris et la
              Convention-cadre des Nations unies sur les changements
              climatiques (CCNUCC), au service des engagements nationaux et du
              suivi mondial.
            </p>
          </div>

          <div className="alignement-grid">
            {alignement.map((a, i) => (
              <div key={i} className="alignement-item">
                <div className="alignement-label">{a.label}</div>
                <div className="alignement-value">{a.value}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ===================== CTA — SYSTÈME D'INFORMATION ===================== */}
      <section className="cta-fullbleed">
        <div
          className="cta-fullbleed-bg"
          style={{ backgroundImage: "url(/images/sahel-landscape.jpg)" }}
          aria-hidden="true"
        />
        <div className="cta-fullbleed-inner">
          <div className="kicker">Système d'Information sur le climat</div>
          <h2>
            Explorez le Système d'Information<br />
            <em>sur le climat en Afrique</em>.
          </h2>
          <p>
            Une plateforme intégrant observations, projections climatiques et
            informations issues des rapports nationaux pour orienter les
            stratégies d'adaptation et d'atténuation et appuyer le suivi des
            engagements climatiques.
          </p>
          <div className="cta-fullbleed-actions">
            <Link to="/geoportail" className="btn btn-orange lg">
              <MapIcon size={18} /> Explorer le système d'information
            </Link>
          </div>
        </div>
      </section>

      {/* ===================== IMAGE ATTRIBUTION ===================== */}
      <section className="section tight">
        <div className="container">
          <div className="img-attribution">
            <strong>Crédits images</strong>
            Photos : One Earth (Sahel), Pexels (sol craquelé), Britannica
            (Mopti, Mali), Dreamstime (village sahélien), Live Science (vue
            satellite), BBC (paysage sahélien). Sources ouvertes via{" "}
            <a href="https://unsplash.com">Unsplash</a>,{" "}
            <a href="https://commons.wikimedia.org">Wikimedia Commons</a> et{" "}
            <a href="https://www.nasa.gov">NASA Earth Observatory</a>.
          </div>
        </div>
      </section>
    </>
  );
}
