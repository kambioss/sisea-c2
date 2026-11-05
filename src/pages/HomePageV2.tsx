// Home page, version 2: a board of tiles. The first screen is a wall of
// pictures of the continent (and of the géoportail itself) with one text
// panel set into it; the page continues as tiles fitted edge to edge: a
// statement, a live preview of the géoportail's views, close-ups of its
// controls, the sources it rests on, and a footer made of tiles.

import { CSSProperties, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useTitle } from "../components/Layout";
import { useReveal } from "../components/useReveal";

type Frame = { src: string; w: number; h: number; label: string; alt: string };

const F = {
  lac: { src: "/home/lac-tchad.jpg", w: 1600, h: 1242, label: "Lac Tchad, vu par satellite", alt: "Le lac Tchad vu par le satellite Terra" },
  terre: { src: "/home/terre.jpg", w: 1400, h: 1391, label: "L'Afrique depuis l'espace", alt: "L'Afrique et l'Europe vues par le satellite DSCOVR" },
  pluie: { src: "/home/pluie-kounkane.jpg", w: 1600, h: 1200, label: "Kounkane, Sénégal", alt: "Saison des pluies à Kounkane, en Haute-Casamance" },
  niger: { src: "/home/niger.jpg", w: 1600, h: 971, label: "Fleuve Niger, Djenné", alt: "Le fleuve Niger près de Djenné, au Mali" },
  poussiere: { src: "/home/poussiere.jpg", w: 595, h: 1012, label: "Poussières du Sahara", alt: "Tempête de poussière du Sahara au-dessus de l'Atlantique" },
  station: { src: "/home/station.jpg", w: 1100, h: 1712, label: "Station météo, 1961", alt: "Relevé dans un abri météorologique en 1961" },
  kayes: { src: "/home/kayes.jpg", w: 1280, h: 960, label: "Savane près de Kayes, Mali", alt: "Savane sahélienne sur la route de Kayes" },
  kili: { src: "/home/kilimandjaro.jpg", w: 1400, h: 937, label: "Kilimandjaro, depuis Amboseli", alt: "Le Kilimandjaro vu depuis le parc d'Amboseli" },
  okavango: { src: "/home/okavango.jpg", w: 1400, h: 905, label: "Delta de l'Okavango", alt: "Zèbres dans le delta de l'Okavango, vus d'avion" },
  nouakchott: { src: "/home/nouakchott.jpg", w: 1400, h: 933, label: "Plage de Nouakchott", alt: "Marché aux poissons sur la plage de Nouakchott" },
  ouaga: { src: "/home/ouagadougou.jpg", w: 1400, h: 788, label: "Ouagadougou", alt: "Une rue de Ouagadougou près du marché Rood Woko" },
  gpAlertes: { src: "/home/gp-alertes.jpg", w: 1600, h: 1000, label: "Géoportail · alertes", alt: "Le géoportail affichant l'alerte sécheresse" },
  gpAnimee: { src: "/home/gp-animee.jpg", w: 1600, h: 1000, label: "Géoportail · carte animée", alt: "La carte animée des régions africaines" },
} satisfies Record<string, Frame>;

// Six columns of the hero sheet, each started at its own offset.
const SHEET: { offset: number; frames: Frame[] }[] = [
  { offset: 0, frames: [F.kili, F.station, F.niger, F.okavango, F.pluie] },
  { offset: -90, frames: [F.lac, F.okavango, F.pluie, F.ouaga, F.kayes] },
  { offset: -40, frames: [F.gpAlertes, F.terre, F.station, F.okavango, F.niger] },
  { offset: -130, frames: [F.poussiere, F.ouaga, F.niger, F.kili, F.lac] },
  { offset: -20, frames: [F.nouakchott, F.kayes, F.lac, F.poussiere, F.terre] },
  { offset: -70, frames: [F.gpAnimee, F.pluie, F.kili, F.terre, F.okavango] },
];
const STRIPS = ["#1e2b3c", "#1d63a0", "#f4c95d", "#c63b3b"];
const STRIP_INK = ["#fff", "#fff", "#1e2b3c", "#fff"];

const VIEWS = [
  { id: "climat", name: "Climat observé", hint: "Anomalies 2024", img: "/home/gp-climat.jpg", text: "Chaque pays coloré selon l'écart de sa température à la normale 1961-1990." },
  { id: "alertes", name: "Alerte sécheresse", hint: "Chaque mois", img: "/home/gp-alertes.jpg", text: "Quatre niveaux de vigilance calculés à partir des pluies des trois derniers mois." },
  { id: "fiche", name: "Fiche d'un pays", hint: "Clic sur la carte", img: "/home/gp-tendances.jpg", text: "Les bandes observées et projetées, les chiffres clés et les tendances d'un pays." },
  { id: "animee", name: "Carte animée", hint: "1901 → 2100", img: "/home/gp-animee.jpg", text: "Les 862 régions du continent, année après année, jusqu'à la fin du siècle." },
];

const SOURCES = [
  { name: "OSS", role: "Observatoire du Sahara et du Sahel, porteur du programme GEOSSIA", tint: "#1e2b3c", ink: "#fff" },
  { name: "CRU TS 4.09", role: "Températures mensuelles depuis 1901, Université d'East Anglia", tint: "#1d63a0", ink: "#fff" },
  { name: "CHIRPS v2", role: "Pluies satellitaires depuis 1981, Climate Hazards Center", tint: "#f4c95d", ink: "#1e2b3c" },
  { name: "CMIP6", role: "Projections climatiques, portail de la Banque mondiale", tint: "#c63b3b", ink: "#fff" },
  { name: "OMM", role: "Méthode et seuils de l'indice de précipitations standardisé", tint: "#dde3ea", ink: "#1e2b3c" },
  { name: "FIRMS", role: "Feux actifs détectés par satellite, NASA", tint: "#c6dbef", ink: "#1e2b3c" },
];

const CREDITS = [
  ["Kilimanjaro from Amboseli", "Sergey Pesterev, CC BY-SA 4.0", "https://commons.wikimedia.org/wiki/File:Kilimanjaro_from_Amboseli.jpg"],
  ["Cebras de Burchell, delta del Okavango", "Diego Delso, CC BY-SA 4.0", "https://commons.wikimedia.org/wiki/File:Cebras_de_Burchell_(Equus_quagga_burchellii),_vista_a%C3%A9rea_del_delta_del_Okavango,_Botsuana,_2018-08-01,_DD_30.jpg"],
  ["Fish market in Nouakchott", "Uzabiaga, CC BY-SA 4.0", "https://commons.wikimedia.org/wiki/File:Fish_market_in_Nouakchott_-_Mauritania.jpg"],
  ["Rood Woko Ouagadougou 2013", "Sputniktilt, CC BY-SA 3.0", "https://commons.wikimedia.org/wiki/File:Rood_Woko_Ouagadougou_2013.jpg"],
  ["Lake Chad (MODIS 2017-01-20)", "NASA GSFC, domaine public", "https://commons.wikimedia.org/wiki/File:Lake_Chad_(MODIS_2017-01-20).jpg"],
  ["Africa and Europe from a Million Miles Away", "NASA, domaine public", "https://commons.wikimedia.org/wiki/File:Africa_and_Europe_from_a_Million_Miles_Away.png"],
  ["Dust Storm off Western Sahara Coast", "NASA, domaine public", "https://commons.wikimedia.org/wiki/File:Dust_Storm_off_Western_Sahara_Coast_(14441).jpg"],
  ["Rain-Kounkane (2)", "Dorothy Voorhees, CC BY-SA 2.0", "https://commons.wikimedia.org/wiki/File:Rain-Kounkane_(2).jpg"],
  ["Niger River View, Djenne", "upyernoz, CC BY 2.0", "https://commons.wikimedia.org/wiki/File:Niger_River_View,_Djenne_(6861797).jpg"],
  ["Weather station in South Africa (1961)", "ESO, CC BY 4.0", "https://commons.wikimedia.org/wiki/File:Weather_station_in_South_Africa_(south-africa-1961-03).tiff"],
  ["Sahel forest near Kayes, Mali", "NOAA, domaine public", "https://commons.wikimedia.org/wiki/File:Sahel_forest_near_Kayes_Mali.jpg"],
];

export default function HomePageV2() {
  useTitle("Accueil");
  const root = useReveal();
  return (
    <div className="home3" ref={root}>
      <Sheet />
      <Statement />
      <Preview />
      <Controls />
      <Sources />
      <Action />
      <BoardFooter />
    </div>
  );
}

function Sheet() {
  const ref = useRef<HTMLElement>(null);
  // Frames and captions pushed below the sheet by the column offsets are cut
  // off anyway; take them out so they cannot show through or be read out.
  useEffect(() => {
    const sheet = ref.current;
    if (!sheet) return;
    const fit = () => {
      const bottom = sheet.getBoundingClientRect().bottom;
      sheet.querySelectorAll<HTMLElement>(".b-frame").forEach((f) => {
        f.style.visibility = "";
        if (f.getBoundingClientRect().top >= bottom) f.style.visibility = "hidden";
        const cap = f.querySelector("figcaption");
        if (cap) cap.style.visibility = cap.getBoundingClientRect().bottom > bottom ? "hidden" : "";
      });
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(sheet);
    return () => ro.disconnect();
  }, []);
  let n = 0;
  return (
    <section className="b-sheet" ref={ref}>
      <Panel />
      <div className="b-cols">
        {SHEET.map((col, c) => (
          <div key={c} className="b-col" style={{ marginTop: col.offset } as CSSProperties}>
            {col.frames.map((f, i) => {
              const k = n++;
              return (
                <div key={i} className="b-frame-wrap">
                  <figure className="b-frame" style={{ "--d": `${k * 45}ms` } as CSSProperties}>
                    <img src={f.src} width={f.w} height={f.h} alt={f.alt} loading={k < 8 ? undefined : "lazy"} decoding="async" />
                    <figcaption style={{ background: STRIPS[k % 4], color: STRIP_INK[k % 4] }}>{f.label}</figcaption>
                  </figure>
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </section>
  );
}

function Panel() {
  return (
    <div className="b-panel">
      <h1>GEOSSIA Climat &amp; Alertes</h1>
      <p>Suivre le climat des 55 pays africains, voir venir les sécheresses et préparer 2100.</p>
      <Link to="/geoportail" className="b-btn">Ouvrir le géoportail</Link>
      <nav className="b-panel-links" aria-label="Raccourcis">
        <a href="#vues">Les vues</a>
        <Link to="/ressources">Ressources</Link>
        <Link to="/a-propos">À propos</Link>
      </nav>
    </div>
  );
}

function Statement() {
  return (
    <section className="b-statement">
      <div className="b-board b-statement-board">
        <div className="b-tile dark b-slogan" data-rv><h2>Voir venir le climat</h2></div>
        <div className="b-tile pale b-figure" data-rv><strong>55</strong><span>pays suivis, et 862 régions</span></div>
        <div className="b-tile photo" data-rv><img src="/home/niger.jpg" width={1600} height={971} alt="Le fleuve Niger près de Djenné" loading="lazy" decoding="async" /></div>
      </div>
      <div className="b-long" data-rv>
        <p>Les données sur le climat africain existent, mais elles sont dispersées entre des archives de stations, des satellites et des modèles que peu de gens ont le temps de lire. GEOSSIA Climat &amp; Alertes, la composante 2 du programme GEOSSIA de l'Observatoire du Sahara et du Sahel, les rassemble et les traduit dans une même langue pour tout le continent : les mêmes méthodes, les mêmes seuils que l'OMM et les mêmes couleurs sur chaque carte. Un ministre, un prévisionniste et un agronome regardent enfin le même tableau, du mois écoulé jusqu'à la fin du siècle.</p>
      </div>
    </section>
  );
}

function Preview() {
  const [view, setView] = useState(VIEWS[0]);
  return (
    <section className="b-preview" id="vues">
      <div className="b-preview-head" data-rv>
        <h2>Quatre façons de lire la carte</h2>
        <p>Choisissez une vue à droite : c'est ce que vous trouverez en ouvrant le géoportail.</p>
      </div>
      <div className="b-demo" data-rv>
        <div className="b-demo-screen" data-ui>
          {VIEWS.map((v) => <img key={v.id} src={v.img} width={1600} height={1000} alt={`Le géoportail : ${v.name.toLowerCase()}`} loading="lazy" decoding="async" className={v.id === view.id ? "on" : ""} />)}
        </div>
        <div className="b-demo-side" role="radiogroup" aria-label="Vue du géoportail">
          {VIEWS.map((v) => (
            <button key={v.id} role="radio" aria-checked={v.id === view.id} className={v.id === view.id ? "on" : ""} onClick={() => setView(v)}>
              <span>{v.name}</span>
              <small>{v.hint}</small>
            </button>
          ))}
          <p className="b-demo-text" key={view.id}>{view.text}</p>
          <Link to={`/geoportail?ind=${view.id === "alertes" ? "drought-alert" : view.id === "animee" ? "warming-trend" : "tmean-anom"}${view.id === "fiche" ? "&pays=SEN" : ""}`} className="b-demo-link">Ouvrir cette vue</Link>
        </div>
      </div>
    </section>
  );
}

// Close-ups: real controls of the géoportail, enlarged and cropped by their tiles.
function Controls() {
  return (
    <section className="b-controls">
      <div className="b-board b-controls-board">
        <div className="b-tile pale t-head" data-rv><h2>Des outils simples, à portée de main</h2></div>
        <div className="b-tile t-a" style={{ background: "#c6dbef" }} data-rv>
          <div className="zoom" data-ui><span className="ui-seg"><i>Pays</i><i className="on">Régions</i><i>Sous-rég.</i></span></div>
          <Caption name="Pays ou régions" text="Passez des 55 pays aux 862 régions en un clic." />
        </div>
        <div className="b-tile t-b" style={{ background: "#1e2b3c", color: "#fff" }} data-rv>
          <div className="zoom" data-ui><span className="ui-play">▶</span><span className="ui-year">1987</span></div>
          <Caption name="Carte animée" text="Lecture de 1901 à 2100." />
        </div>
        <div className="b-tile t-c" style={{ background: "#fdecc8" }} data-rv>
          <div className="zoom" data-ui><span className="ui-level" style={{ background: "#f4c95d" }}>Vigilance</span><span className="ui-level" style={{ background: "#ee8a3c" }}>Alerte</span><span className="ui-level" style={{ background: "#c63b3b", color: "#fff" }}>Alerte maximale</span></div>
          <Caption name="Niveaux d'alerte" text="Les seuils de l'OMM, mis à jour chaque mois." />
        </div>
        <div className="b-tile t-d" style={{ background: "#dde3ea" }} data-rv>
          <div className="zoom" data-ui><span className="ui-seg"><i className="on">SSP2-4.5</i><i>SSP5-8.5</i></span></div>
          <Caption name="Deux scénarios" text="Modéré ou pessimiste, jusqu'en 2100." />
        </div>
        <div className="b-tile t-e" style={{ background: "#f6d5d2" }} data-rv>
          <div className="zoom" data-ui><span className="ui-ramp" /></div>
          <Caption name="Une seule palette" text="Les mêmes couleurs pour tous les pays." />
        </div>
        <div className="b-tile t-f" style={{ background: "#1d63a0", color: "#fff" }} data-rv>
          <div className="zoom" data-ui><span className="ui-file">indicators.json ↓</span></div>
          <Caption name="Données ouvertes" text="Tout se télécharge, librement." />
        </div>
        <div className="b-tile t-g" style={{ background: "#eef2f7" }} data-rv>
          <div className="zoom" data-ui><span className="ui-toggle"><i /></span><span className="ui-fire">Feux actifs</span></div>
          <Caption name="Couches en plus" text="Feux des trois derniers jours, fond satellite." />
        </div>
      </div>
    </section>
  );
}

function Caption({ name, text }: { name: string; text: string }) {
  return (
    <div className="b-cap">
      <strong>{name}</strong>
      <span>{text}</span>
    </div>
  );
}

function Sources() {
  return (
    <section className="b-sources">
      <h2 data-rv>Ce sur quoi elle repose</h2>
      <ul>
        {SOURCES.map((s) => (
          <li key={s.name} style={{ background: s.tint, color: s.ink }} data-rv>
            <strong>{s.name}</strong>
            <span>{s.role}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function Action() {
  return (
    <section className="b-action">
      <div className="b-tile photo b-flank" aria-hidden="true"><img src="/home/okavango.jpg" width={1400} height={905} alt="" loading="lazy" decoding="async" /></div>
      <div className="b-tile b-cta" data-rv>
        <h2>Ouvrez la carte de l'Afrique</h2>
        <p>Choisissez un indicateur, cliquez sur un pays : sa fiche, ses régions et ses tendances s'affichent aussitôt.</p>
        <Link to="/geoportail" className="b-btn light">Lancer le géoportail</Link>
        <img className="b-cta-shot" src="/home/gp-climat.jpg" width={1600} height={1000} alt="Le géoportail sur la carte des anomalies de température" loading="lazy" decoding="async" />
      </div>
      <div className="b-tile b-flank" style={{ background: "#f4c95d" }} aria-hidden="true" />
    </section>
  );
}

function BoardFooter() {
  return (
    <footer className="b-foot">
      <div className="b-tile dark b-foot-name"><span>GEOSSIA</span><small>Climat &amp; Alertes · Composante 2</small></div>
      <div className="b-tile pale b-foot-links">
        <h3>Explorer</h3>
        <Link to="/geoportail">Géoportail</Link>
        <Link to="/ressources">Ressources</Link>
        <Link to="/a-propos">À propos</Link>
      </div>
      <div className="b-tile pale b-foot-links">
        <h3>Données</h3>
        <a href="/data/indicators.json" download>Indicateurs (JSON)</a>
        <a href="/data/countries.geojson" download>Limites des pays</a>
        <Link to="/a-propos">Méthodologie</Link>
      </div>
      <div className="b-tile b-foot-oss" style={{ background: "#1d63a0", color: "#fff" }}>
        <h3>Un programme de</h3>
        <a href="https://www.oss-online.org" target="_blank" rel="noreferrer">Observatoire du Sahara et du Sahel</a>
        <span>© 2026</span>
      </div>
      <div className="b-tile pale b-foot-credits">
        <p>Photographies : {CREDITS.map(([t, by, url], i) => <span key={url}><a href={url} target="_blank" rel="noreferrer">{t}</a>, {by}{i < CREDITS.length - 1 ? " · " : "."}</span>)}</p>
      </div>
    </footer>
  );
}
