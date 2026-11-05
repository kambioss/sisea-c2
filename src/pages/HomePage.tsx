// Home page: presents the platform. One motif runs through it, the warming
// stripe (one year, one band of colour): the hero folders, the photo frames,
// the list markers, the full-width band of Africa 1901-2024 and the closing
// wordmark are all bands taken from the same blue → red ramp.

import { CSSProperties, FormEvent, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useBundle, useTitle } from "../components/Layout";
import { useReveal } from "../components/useReveal";
import { COUNTRIES } from "../data/countries";
import { ANOMALY_RAMP, rampColor } from "../data/climateTrends";

const IMG = {
  terre: { src: "/home/terre.jpg", w: 1400, h: 1391, alt: "L'Afrique et l'Europe vues depuis l'espace par le satellite DSCOVR" },
  lac: { src: "/home/lac-tchad.jpg", w: 1600, h: 1242, alt: "Le lac Tchad vu par le satellite Terra en janvier 2017" },
  pluie: { src: "/home/pluie-kounkane.jpg", w: 1600, h: 1200, alt: "Saison des pluies à Kounkane, en Haute-Casamance" },
  niger: { src: "/home/niger.jpg", w: 1600, h: 971, alt: "Le fleuve Niger près de Djenné, au Mali" },
  poussiere: { src: "/home/poussiere.jpg", w: 595, h: 1012, alt: "Tempête de poussière du Sahara au-dessus de l'Atlantique, vue par satellite" },
  station: { src: "/home/station.jpg", w: 1100, h: 1712, alt: "Relevé dans un abri météorologique, Afrique du Sud, 1961" },
  kayes: { src: "/home/kayes.jpg", w: 1280, h: 960, alt: "Savane sahélienne sur la route de Bamako à Kayes" },
};
type ImgKey = keyof typeof IMG;

// Hero folders, back to front, each one a band of the warming ramp.
const FOLDERS = [
  { id: "observer", tab: "Observer", color: "#2171b5", ink: "#fff" },
  { id: "methode", tab: "Comprendre", color: "#6baed6", ink: "#08306b" },
  { id: "fonctions", tab: "Agir", color: "#fcbba1", ink: "#67000d" },
  { id: "ouvert", tab: "Partager", color: "#fb6a4a", ink: "#3b0007" },
  { id: "explorer", tab: "Explorer", color: "#cb181d", ink: "#fff" },
];

const LENSES = [
  { id: "climat", tab: "Climat", title: "Le climat observé", img: "lac" as ImgKey, ind: "tmean-anom", text: "Températures et pluies de chaque pays et de chaque région, comparées à la normale 1961-1990. On voit d'un coup d'œil où l'année a été plus chaude, plus sèche ou plus humide que d'habitude." },
  { id: "alertes", tab: "Alertes", title: "La sécheresse, mois par mois", img: "pluie" as ImgKey, ind: "drought-alert", text: "Chaque mois, le déficit de pluie des trois derniers mois est classé en quatre niveaux de vigilance, selon les seuils de l'OMM. Une carte pour repérer tôt les campagnes agricoles menacées." },
  { id: "tendances", tab: "Tendances", title: "Le siècle qui vient", img: "terre" as ImgKey, ind: "warming-trend", text: "Plus d'un siècle d'observations mis en regard des projections CMIP6 jusqu'en 2100, sous un scénario modéré et un scénario pessimiste. La carte animée fait défiler le continent année après année." },
];

const POINTS: { title: string; text: string; img: ImgKey }[] = [
  { title: "Pays et régions", text: "Les 55 pays et 862 régions administratives, sur fond clair, sombre ou satellite.", img: "terre" },
  { title: "Bandes de réchauffement", text: "Chaque année depuis 1901 en une couleur, pour chaque pays et chaque région.", img: "station" },
  { title: "Comparer et classer", text: "Le classement des pays, des filtres par sous-région et par plage de valeurs.", img: "niger" },
  { title: "Alerte sécheresse", text: "Quatre niveaux de vigilance, recalculés chaque mois à partir des pluies.", img: "poussiere" },
  { title: "Carte animée", text: "Le continent région par région, de 1901 à 2100, en un seul geste.", img: "lac" },
  { title: "Feux actifs", text: "Les feux détectés par satellite ces trois derniers jours, en surimpression.", img: "kayes" },
  { title: "Pluies depuis 1981", text: "Les indices de précipitations sur 1, 3 et 12 mois, issus de CHIRPS.", img: "pluie" },
  { title: "Projections à 2100", text: "Deux scénarios CMIP6 pour préparer l'adaptation sur le long terme.", img: "terre" },
  { title: "Données ouvertes", text: "Tous les indicateurs en téléchargement libre, avec leurs sources et méthodes.", img: "niger" },
];
const POINT_COLORS = ["#2171b5", "#fb6a4a", "#cb181d"];

const STEPS = [
  { title: "Collecter", text: "Les températures de CRU TS depuis 1901, les pluies satellitaires CHIRPS depuis 1981, les projections CMIP6 jusqu'en 2100." },
  { title: "Condenser", text: "Des millions de points de grille ramenés à 55 pays et 862 régions, puis traduits en anomalies, indices et tendances." },
  { title: "Diffuser", text: "Une carte, des alertes mensuelles et des fichiers ouverts, lisibles par un décideur comme par un technicien." },
];

const CREDITS = [
  { title: "Africa and Europe from a Million Miles Away", by: "NASA", licence: "domaine public", page: "https://commons.wikimedia.org/wiki/File:Africa_and_Europe_from_a_Million_Miles_Away.png" },
  { title: "Lake Chad (MODIS 2017-01-20)", by: "Jeff Schmaltz, MODIS Land Rapid Response Team, NASA GSFC", licence: "domaine public", page: "https://commons.wikimedia.org/wiki/File:Lake_Chad_(MODIS_2017-01-20).jpg" },
  { title: "Dust Storm off Western Sahara Coast", by: "Jacques Descloitres, MODIS Rapid Response, NASA", licence: "domaine public", page: "https://commons.wikimedia.org/wiki/File:Dust_Storm_off_Western_Sahara_Coast_(14441).jpg" },
  { title: "Rain-Kounkane (2)", by: "Dorothy Voorhees", licence: "CC BY-SA 2.0", page: "https://commons.wikimedia.org/wiki/File:Rain-Kounkane_(2).jpg" },
  { title: "Niger River View, Djenne", by: "upyernoz", licence: "CC BY 2.0", page: "https://commons.wikimedia.org/wiki/File:Niger_River_View,_Djenne_(6861797).jpg" },
  { title: "Weather station in South Africa (1961)", by: "J. Dommaget et J. Boulon / ESO", licence: "CC BY 4.0", page: "https://commons.wikimedia.org/wiki/File:Weather_station_in_South_Africa_(south-africa-1961-03).tiff" },
  { title: "Sahel forest near Kayes, Mali", by: "NOAA", licence: "domaine public", page: "https://commons.wikimedia.org/wiki/File:Sahel_forest_near_Kayes_Mali.jpg" },
];

export default function HomePage() {
  useTitle("Accueil");
  const root = useReveal();

  return (
    <div className="home" ref={root}>
      <Hero />
      <Intro />
      <Showcase />
      <Method />
      <AfricaBand />
      <Features />
      <About />
      <Explore />
      <Close />
    </div>
  );
}

function Photo({ k, className, lazy = true }: { k: ImgKey; className?: string; lazy?: boolean }) {
  const i = IMG[k];
  return <img src={i.src} width={i.w} height={i.h} alt={i.alt} className={className} loading={lazy ? "lazy" : undefined} decoding="async" />;
}

function Hero() {
  return (
    <section className="h-hero">
      <div className="h-hero-copy">
        <h1>Climat &amp; Alertes</h1>
        <p>La plateforme de l'OSS qui suit le climat des 55 pays africains, signale les sécheresses chaque mois et projette les tendances jusqu'en 2100.</p>
      </div>
      <nav className="h-folders" aria-label="Parcourir la page">
        {FOLDERS.map((f, i) => (
          <a
            key={f.id}
            href={`#${f.id}`}
            className={i === FOLDERS.length - 1 ? "h-folder front" : "h-folder"}
            style={{ "--c": f.color, "--ink": f.ink, "--i": i, "--tab": `${4 + i * 19}%` } as CSSProperties}
          >
            <span className="h-tab">{f.tab}</span>
          </a>
        ))}
        <div className="h-front-body">
          <Link to="/geoportail" className="h-btn light">Ouvrir le géoportail</Link>
          <span>Gratuit, sans inscription, sur ordinateur et sur mobile.</span>
          <ul className="h-facts">
            <li><strong>55</strong><span>pays</span></li>
            <li><strong>862</strong><span>régions</span></li>
            <li><strong>1901 → 2100</strong><span>observations et projections</span></li>
          </ul>
          <img className="h-shot" src="/home/gp-alertes.jpg" width={1600} height={1000} alt="Le géoportail affichant le niveau d'alerte sécheresse des pays africains" />
        </div>
      </nav>
    </section>
  );
}

function Intro() {
  const thumb = (k: ImgKey) => <span className="thumb"><Photo k={k} /></span>;
  return (
    <section className="h-intro">
      <h2 data-rv>Un continent, une lecture</h2>
      <p data-rv>
        Du lac Tchad {thumb("lac")} aux pluies de Casamance {thumb("pluie")}, du fleuve Niger {thumb("niger")} aux vents du Sahara {thumb("poussiere")}, un seul outil pour lire le climat africain.
      </p>
    </section>
  );
}

function Showcase() {
  const [lens, setLens] = useState(LENSES[0]);
  return (
    <section className="h-showcase" id="observer">
      <div className="h-plate" data-rv>
        {LENSES.map((l) => <Photo key={l.id} k={l.img} className={l.id === lens.id ? "on" : ""} />)}
      </div>
      <div className="h-show-text">
        <div className="h-lens" role="tablist" aria-label="Thèmes" data-rv>
          {LENSES.map((l) => (
            <button key={l.id} role="tab" aria-selected={l.id === lens.id} className={l.id === lens.id ? "on" : ""} onClick={() => setLens(l)}>{l.tab}</button>
          ))}
        </div>
        <div className="h-lens-body" key={lens.id}>
          <h2>{lens.title}</h2>
          <p>{lens.text}</p>
        </div>
        <div className="h-cells" data-rv>
          <Link to={`/geoportail?ind=${lens.ind}`} className="h-cell ink">Voir cette carte</Link>
          <Link to="/a-propos" className="h-cell tone">Lire la méthode</Link>
        </div>
      </div>
    </section>
  );
}

// "Many into one": scattered squares (raw grids) pulled into a ribbon
// (aggregation), then laid out in ordered rows coloured like the stripes.
function Method() {
  const squares = useMemo(() => {
    let seed = 7;
    const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    const out: { x: number; y: number; c: string }[] = [];
    for (let i = 0; i < 54; i++) out.push({ x: 6 + rnd() * 290, y: 6 + rnd() * 200, c: rnd() > 0.5 ? "#c6dbef" : "#d5dce7" });
    for (let i = 0; i < 42; i++) out.push({ x: 364 + (i % 14) * 16, y: 84 + Math.floor(i / 14) * 16, c: i % 3 ? "#6baed6" : "#2171b5" });
    for (let i = 0; i < 60; i++) {
      const col = i % 12;
      out.push({ x: 660 + col * 28, y: 28 + Math.floor(i / 12) * 34, c: ANOMALY_RAMP[Math.min(8, Math.floor((col / 11) * 8.99))] });
    }
    return out;
  }, []);
  return (
    <section className="h-method" id="methode">
      <div className="h-method-head">
        <h2 data-rv>De la mesure à la carte</h2>
        <p data-rv>Les jeux de données climatiques de référence sont immenses et techniques. La plateforme les rassemble, les condense et les rend lisibles à l'échelle qui compte pour décider : le pays et la région.</p>
      </div>
      <svg className="h-flow" viewBox="0 0 1000 216" role="img" aria-label="Des données dispersées, condensées puis ordonnées" data-rv>
        {squares.map((s, i) => <rect key={i} x={s.x} y={s.y} width={12} height={12} fill={s.c} />)}
      </svg>
      <ol className="h-steps">
        {STEPS.map((s) => (
          <li key={s.title} data-rv>
            <strong>{s.title}</strong>
            <p>{s.text}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}

function AfricaBand() {
  const { bundle } = useBundle();
  const series = bundle?.zones.AFR?.series.tmean_anom;
  const values = series?.values ?? [];
  const start = series?.start ?? 1901;
  const end = values.length ? start + values.length - 1 : 2024;
  return (
    <section className="h-band">
      <div className="h-band-head">
        <h2 data-rv>{end - start + 1} ans en une image</h2>
        <p data-rv>Chaque bande est une année de l'Afrique, de {start} à {end}. En bleu, les années plus froides que la normale ; en rouge, les plus chaudes. La plateforme dessine cette image pour chaque pays et chaque région.</p>
      </div>
      <div className="h-stripes" data-rv role="img" aria-label={`Bandes de réchauffement de l'Afrique, ${start}-${end}`}>
        {values.map((v, i) => <i key={i} style={{ background: v === null ? "#dfe5ee" : rampColor(ANOMALY_RAMP, v, 1.2) }} />)}
      </div>
      <div className="h-band-axis"><span>{start}</span><span>{end}</span></div>
    </section>
  );
}

function Features() {
  const [active, setActive] = useState(0);
  return (
    <section className="h-features" id="fonctions">
      <div className="h-feature-frame" data-rv>
        {POINTS.map((p, i) => <Photo key={i} k={p.img} className={i === active ? "on" : ""} />)}
      </div>
      <div className="h-feature-text">
        <h2 data-rv>Tout ce que fait la plateforme</h2>
        <ul className="h-points">
          {POINTS.map((p, i) => (
            <li
              key={p.title}
              data-rv
              className={i === active ? "on" : ""}
              onMouseEnter={() => setActive(i)}
              onFocus={() => setActive(i)}
              tabIndex={0}
              style={{ "--m": POINT_COLORS[i % 3] } as CSSProperties}
            >
              <strong><span className="mark" aria-hidden="true" />{p.title}</strong>
              <p>{p.text}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

function About() {
  return (
    <section className="h-about" id="ouvert">
      <div className="h-about-panel">
        <div className="h-about-left">
          <h2 data-rv>Un bien public africain</h2>
          <div className="h-about-photo" data-rv><Photo k="kayes" /></div>
        </div>
        <div className="h-about-right">
          <div data-rv>
            <h3>Porté par l'OSS</h3>
            <p>La plateforme est la composante Climat &amp; Alertes du programme GEOSSIA, conduit par l'Observatoire du Sahara et du Sahel avec ses pays membres et ses partenaires.</p>
          </div>
          <div data-rv>
            <h3>Ouverte et documentée</h3>
            <p>Les sources, les méthodes de calcul et les limites de chaque indicateur sont publiées. Les données se téléchargent librement et se réutilisent dans vos propres analyses.</p>
          </div>
          <div data-rv>
            <Link to="/a-propos" className="h-btn accent">Découvrir le projet</Link>
          </div>
        </div>
      </div>
    </section>
  );
}

function Explore() {
  const navigate = useNavigate();
  const sorted = useMemo(() => [...COUNTRIES].sort((a, b) => a.name.localeCompare(b.name, "fr")), []);
  const [iso3, setIso3] = useState("SEN");
  const submit = (e: FormEvent) => {
    e.preventDefault();
    navigate(`/geoportail?pays=${iso3}`);
  };
  return (
    <section className="h-explore" id="explorer">
      <h2 data-rv>Commencez par un pays</h2>
      <form className="h-sentence" onSubmit={submit} action="/geoportail" data-rv>
        <span>Voir</span>{" "}
        <label className="h-blank">
          <span className="sr-only">Pays</span>
          <select name="pays" value={iso3} onChange={(e) => setIso3(e.target.value)}>
            {sorted.map((c) => <option key={c.iso3} value={c.iso3}>{c.name}</option>)}
          </select>
        </label>{" "}
        <button type="submit">sur la carte</button>
      </form>
      <p data-rv>Le géoportail s'ouvre centré sur le pays choisi, avec sa fiche, ses régions et ses tendances climatiques.</p>
    </section>
  );
}

const MARK = [
  { l: "G", c: "#08306b", h: 100, ink: "#fff" },
  { l: "E", c: "#2171b5", h: 78, ink: "#fff" },
  { l: "O", c: "#6baed6", h: 88, ink: "#08306b" },
  { l: "S", c: "#c6dbef", h: 64, ink: "#08306b" },
  { l: "S", c: "#fcbba1", h: 82, ink: "#67000d" },
  { l: "I", c: "#fb6a4a", h: 70, ink: "#3b0007" },
  { l: "A", c: "#cb181d", h: 96, ink: "#fff" },
];

function Close() {
  return (
    <section className="h-close">
      <h2 className="h-mark" aria-label="GEOSSIA" data-rv>
        {MARK.map((m, i) => (
          <span key={i} style={{ background: m.c, height: `${m.h}%`, color: m.ink, "--i": i } as CSSProperties} aria-hidden="true">{m.l}</span>
        ))}
      </h2>
      <p className="h-credits">
        Photographies :{" "}
        {CREDITS.map((c, i) => (
          <span key={c.page}>
            <a href={c.page} target="_blank" rel="noreferrer">{c.title}</a>, {c.by}, {c.licence}{i < CREDITS.length - 1 ? " · " : "."}
          </span>
        ))}
      </p>
    </section>
  );
}
