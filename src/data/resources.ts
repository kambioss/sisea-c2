// Resource centre of Composante 2: the datasets behind each indicator, the
// methods they follow, and the bundles this site serves for download.

export type ResourceKind = "donnees" | "methode" | "outil" | "telechargement";

export interface Resource {
  id: string;
  kind: ResourceKind;
  title: string;
  publisher: string;
  description: string;
  url: string;
  format: string;
  tags: string[];
}

export const RESOURCE_KINDS: Array<{ id: ResourceKind | "all"; label: string }> = [
  { id: "all", label: "Tout" },
  { id: "donnees", label: "Jeux de données" },
  { id: "methode", label: "Méthodes" },
  { id: "outil", label: "Outils & portails" },
  { id: "telechargement", label: "Téléchargements" },
];

export const RESOURCES: Resource[] = [
  {
    id: "bundle",
    kind: "telechargement",
    title: "Indicateurs Climat & Alertes par pays",
    publisher: "GEOSSIA · OSS",
    description: "Toutes les valeurs affichées sur ce site : anomalies thermiques, SPI-1/3/12, niveaux d'alerte, tendances et projections, pour l'Afrique et ses 55 pays.",
    url: "/data/indicators.json",
    format: "JSON",
    tags: ["Climat", "Alertes", "Tendances"],
  },
  {
    id: "boundaries",
    kind: "telechargement",
    title: "Limites des pays africains",
    publisher: "GEOSSIA · OSS",
    description: "Contours simplifiés des 55 pays utilisés pour les cartes choroplèthes du géoportail (code ISO3).",
    url: "/data/countries.geojson",
    format: "GeoJSON",
    tags: ["Référentiel"],
  },
  {
    id: "cru",
    kind: "donnees",
    title: "CRU TS 4.09 — séries climatiques mensuelles",
    publisher: "Climatic Research Unit, University of East Anglia",
    description: "Températures minimales, maximales et moyennes mensuelles à 0,5° depuis 1901, interpolées à partir des stations.",
    url: "https://crudata.uea.ac.uk/cru/data/hrg/",
    format: "NetCDF",
    tags: ["Climat", "Température"],
  },
  {
    id: "chirps",
    kind: "donnees",
    title: "CHIRPS v2 — précipitations",
    publisher: "Climate Hazards Center, UC Santa Barbara",
    description: "Précipitations quasi globales à 0,05° depuis 1981 combinant satellites et stations : base du calcul des SPI.",
    url: "https://www.chc.ucsb.edu/data/chirps",
    format: "GeoTIFF · NetCDF",
    tags: ["Climat", "Pluie", "Alertes"],
  },
  {
    id: "cckp",
    kind: "donnees",
    title: "Climate Change Knowledge Portal — CMIP6",
    publisher: "Banque mondiale",
    description: "Projections CMIP6 réduites d'échelle à 0,25° et médianes d'ensemble par scénario SSP.",
    url: "https://climateknowledgeportal.worldbank.org/",
    format: "NetCDF · CSV",
    tags: ["Tendances", "Projections"],
  },
  {
    id: "spi-method",
    kind: "methode",
    title: "Indice de précipitations standardisé (SPI)",
    publisher: "OMM · Integrated Drought Management Programme",
    description: "Guide d'utilisation du SPI, indice recommandé par l'OMM pour la surveillance des sécheresses météorologiques.",
    url: "https://www.droughtmanagement.info/standardized-precipitation-index-spi/",
    format: "Guide",
    tags: ["Alertes", "Méthode"],
  },
  {
    id: "stripes",
    kind: "methode",
    title: "Bandes de réchauffement (warming stripes)",
    publisher: "Ed Hawkins, University of Reading",
    description: "Représentation des anomalies annuelles de température en bandes colorées, reprise dans les fiches pays de ce site.",
    url: "https://showyourstripes.info/",
    format: "Visualisation",
    tags: ["Tendances", "Communication"],
  },
  {
    id: "ipcc-atlas",
    kind: "outil",
    title: "Atlas interactif du GIEC",
    publisher: "GIEC — Groupe de travail I",
    description: "Exploration régionale des observations et projections climatiques de l'AR6, par région et par scénario.",
    url: "https://interactive-atlas.ipcc.ch/",
    format: "Portail",
    tags: ["Tendances", "Projections"],
  },
  {
    id: "gdo",
    kind: "outil",
    title: "Global Drought Observatory",
    publisher: "Copernicus Emergency Management Service",
    description: "Indicateurs de sécheresse et prévisions saisonnières opérationnels, utiles en complément des alertes SPI.",
    url: "https://drought.emergency.copernicus.eu/",
    format: "Portail · WMS",
    tags: ["Alertes", "Sécheresse"],
  },
  {
    id: "firms",
    kind: "outil",
    title: "NASA FIRMS — feux actifs",
    publisher: "NASA LANCE",
    description: "Détections de feux actifs MODIS et VIIRS en quasi temps réel, affichables en surcouche du géoportail.",
    url: "https://firms.modaps.eosdis.nasa.gov/",
    format: "Portail · API",
    tags: ["Alertes", "Feux"],
  },
  {
    id: "oss",
    kind: "outil",
    title: "Observatoire du Sahara et du Sahel",
    publisher: "OSS",
    description: "Organisation porteuse de GEOSSIA : programmes, publications et observatoires environnementaux régionaux.",
    url: "https://www.oss-online.org/",
    format: "Site",
    tags: ["Institution"],
  },
];
