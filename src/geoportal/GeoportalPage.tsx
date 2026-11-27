import { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Icon, IconName } from "./Icon";
import { useBundle, useTitle } from "./context";
import { Sparkline, Stripes, StripeStrip } from "./charts";
import { ALERT_LEVELS, INDICATORS, NO_DATA, RegionZone, THEMES, ZoneData, colorFor, fmt, formatValue, indicatorById, legendFor, loadRegionBundle, monthLabel } from "../data/indicators";
import { COUNTRIES, COUNTRY_BY_ISO3, REGIONS, countryName, regionName } from "../data/countries";
import { BASEMAPS, BasemapId, FeatureStyle, GeeTileEntry, MapCanvas, MapCanvasHandle, OVERLAYS } from "./MapCanvas";
import { Chip, Help, RangeSlider } from "./controls";
import { TimelapseBar, TrendsDrawer } from "./ClimateTrends";
import { AnnualTable, Ssp, TrendVariable, annualLastYear, annualValue, formatAnnual, loadAnnual, rampColor, rampFor } from "../data/climateTrends";
import { RasterClimateLayer, useRasterClimateCatalog } from "../data/rasterClimate";
import { ProductDate, ProductFamily, ProductIndicator, ProductLegend, fetchLayerLegend, fetchProductDates, fetchProductLegend, useProductCatalog } from "../data/productCatalog";
import { FireAssessmentPanel, type FireAssessmentParams, type FireInitialParams } from "./FireAssessmentPanel";
import { FloodAssessmentPanel, type FloodAssessmentParams } from "./FloodAssessmentPanel";
import ComparePanel from "./ComparePanel";
import { addDownload } from "../services/downloadService";
import "./geoportal.css";
import { useAuth } from "../context/AuthContext";
import ossLogoBlue from "../oss-logo-blue.png";

const CesiumMap = lazy(() => import("./CesiumMap"));

interface IndicatorFamily {
  id: string;
  label: string;
  icon: IconName;
  description: string;
  indicators: string[];
}

const INDICATOR_FAMILIES: IndicatorFamily[] = [
  {
    id: "temperature",
    label: "Température",
    icon: "thermometer",
    description: "Anomalies observées et vitesse de réchauffement",
    indicators: ["tmean-anom", "tmax-anom", "tmin-anom", "warming-trend"],
  },
  {
    id: "precipitation",
    label: "Précipitations & sécheresse",
    icon: "alert",
    description: "Indices SPI, alertes et tendance pluviométrique",
    indicators: ["spi1", "spi3", "spi12", "drought-alert", "spi12-trend"],
  },
  {
    id: "projections",
    label: "Projections climatiques",
    icon: "trend",
    description: "Scénarios CMIP6 à l'horizon 2041-2060",
    indicators: ["proj-ssp245", "proj-ssp585"],
  },
];
const VISIBLE_INDICATOR_FAMILIES = INDICATOR_FAMILIES.filter((family) => !["temperature", "precipitation", "projections"].includes(family.id));

const INDICATOR_BY_ID = new Map(INDICATORS.map((i) => [i.id, i]));

type Subdivision = "pays" | "admin1" | "sousregions";
// One map unit: a country, or a level-1 region of a country.
interface Unit { id: string; name: string; iso3: string; subregion: string; bbox: [number, number, number, number] | null }
type Tool = "legend" | "basemap" | "overlays" | null;
type PanelTab = "layers" | "favorites" | "search";
interface SavedView {
  id?: string;
  name: string;
  indicator: string;
  country: string | null;
  rasterId?: string | null;
  productId?: string | null;
  productLayer?: string | null;
  period?: string;
  region?: string;
  subdivision?: Subdivision;
  basemap?: BasemapId;
  overlays?: string[];
  mode3d?: boolean;
}

function userInitials(name: string | null, email: string | null): string {
  const words = (name || "").trim().split(/\s+/).filter(Boolean);
  if (words.length >= 2) return `${words[0][0]}${words[words.length - 1][0]}`.toUpperCase();
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (email?.split("@")[0].slice(0, 2) || "U").toUpperCase();
}

const FAVORITES_KEY = "c2-geoportail-vues";
const CHIRPS_ANNUAL_SLD = `<StyledLayerDescriptor xmlns="http://www.opengis.net/sld" xmlns:ogc="http://www.opengis.net/ogc" version="1.0.0"><NamedLayer><Name>chirps_annual</Name><UserStyle><FeatureTypeStyle><Rule><RasterSymbolizer><Opacity>0.94</Opacity><ColorMap type="intervals"><ColorMapEntry color="#000000" opacity="0" quantity="-9990"/><ColorMapEntry color="#fff7bc" quantity="100"/><ColorMapEntry color="#fee391" quantity="250"/><ColorMapEntry color="#fec44f" quantity="500"/><ColorMapEntry color="#a1d99b" quantity="750"/><ColorMapEntry color="#41b6c4" quantity="1000"/><ColorMapEntry color="#2c7fb8" quantity="1500"/><ColorMapEntry color="#253494" quantity="2000"/><ColorMapEntry color="#081d58" quantity="100000"/></ColorMap></RasterSymbolizer></Rule></FeatureTypeStyle></UserStyle></NamedLayer></StyledLayerDescriptor>`;
const chirpsAnnualSldFor = (layerName: string) => CHIRPS_ANNUAL_SLD.replace("<Name>chirps_annual</Name>", `<Name>${layerName.includes(":") ? layerName : `geossia:${layerName}`}</Name>`);
const isChirpsAnnualLayer = (layerName?: string) => Boolean(layerName && /chirps[_-]annual[_-](?:19|20)\d{2}/i.test(layerName));
const CMIP6_SLD = `<StyledLayerDescriptor xmlns="http://www.opengis.net/sld" xmlns:ogc="http://www.opengis.net/ogc" version="1.0.0"><NamedLayer><Name>cmip6_tas</Name><UserStyle><FeatureTypeStyle><Rule><RasterSymbolizer><Opacity>0.88</Opacity><ColorMap type="intervals"><ColorMapEntry color="#000000" opacity="0" quantity="-9990"/><ColorMapEntry color="#fff7bc" quantity="1"/><ColorMapEntry color="#fec44f" quantity="1.5"/><ColorMapEntry color="#fe9929" quantity="2"/><ColorMapEntry color="#ec7014" quantity="3"/><ColorMapEntry color="#cc4c02" quantity="4"/><ColorMapEntry color="#993404" quantity="6"/><ColorMapEntry color="#662506" quantity="20"/></ColorMap></RasterSymbolizer></Rule></FeatureTypeStyle></UserStyle></NamedLayer></StyledLayerDescriptor>`;
const cmip6SldFor = (layerName: string) => CMIP6_SLD.replace("<Name>cmip6_tas</Name>", `<Name>geossia:${layerName}</Name>`);
const GDO_SLD = `<StyledLayerDescriptor xmlns="http://www.opengis.net/sld" xmlns:ogc="http://www.opengis.net/ogc" xmlns:xlink="http://www.w3.org/1999/xlink" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" version="1.0.0"><NamedLayer><Name>gdo_seasonal</Name><UserStyle><FeatureTypeStyle><Rule><RasterSymbolizer><ColorMap type="intervals"><ColorMapEntry color="#ffffff" opacity="0.35" quantity="0.5"/><ColorMapEntry color="#ffff00" quantity="1.5"/><ColorMapEntry color="#ffaa00" quantity="2.5"/><ColorMapEntry color="#ff0000" quantity="3.5"/><ColorMapEntry color="#e9ccf9" quantity="4.5"/><ColorMapEntry color="#c980c6" quantity="5.5"/><ColorMapEntry color="#833393" quantity="6.5"/><ColorMapEntry color="#5ab4ac" quantity="7.5"/><ColorMapEntry color="#000000" opacity="0" quantity="255"/></ColorMap></RasterSymbolizer></Rule></FeatureTypeStyle></UserStyle></NamedLayer></StyledLayerDescriptor>`;
const gdoSldFor = (layerName: string) => GDO_SLD.replace("<Name>gdo_seasonal</Name>", `<Name>geossia:${layerName}</Name>`);
const RSM_SLD = `<StyledLayerDescriptor xmlns="http://www.opengis.net/sld" xmlns:ogc="http://www.opengis.net/ogc" xmlns:xlink="http://www.w3.org/1999/xlink" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" version="1.0.0"><NamedLayer><Name>wapor_rsm</Name><UserStyle><FeatureTypeStyle><Rule><RasterSymbolizer><Opacity>0.88</Opacity><ColorMap type="intervals"><ColorMapEntry color="#000000" opacity="0" quantity="-9990"/><ColorMapEntry color="#8c510a" quantity="0.10"/><ColorMapEntry color="#d8b365" quantity="0.25"/><ColorMapEntry color="#f6e8c3" quantity="0.40"/><ColorMapEntry color="#c7eae5" quantity="0.60"/><ColorMapEntry color="#5ab4ac" quantity="0.80"/><ColorMapEntry color="#01665e" quantity="1.01"/></ColorMap></RasterSymbolizer></Rule></FeatureTypeStyle></UserStyle></NamedLayer></StyledLayerDescriptor>`;
const rsmSldFor = (layerName: string) => RSM_SLD.replace("<Name>wapor_rsm</Name>", `<Name>geossia:${layerName}</Name>`);
const SPI_SLD = `<StyledLayerDescriptor xmlns="http://www.opengis.net/sld" xmlns:ogc="http://www.opengis.net/ogc" xmlns:xlink="http://www.w3.org/1999/xlink" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" version="1.0.0"><NamedLayer><Name>spi_index</Name><UserStyle><FeatureTypeStyle><Rule><RasterSymbolizer><Opacity>0.9</Opacity><ColorMap type="intervals"><ColorMapEntry color="#000000" opacity="0" quantity="-9990"/><ColorMapEntry color="#760005" quantity="-2.0"/><ColorMapEntry color="#d73027" quantity="-1.5"/><ColorMapEntry color="#f46d43" quantity="-1.0"/><ColorMapEntry color="#fdae61" quantity="-0.5"/><ColorMapEntry color="#ffffbf" quantity="0.5"/><ColorMapEntry color="#abd9e9" quantity="1.0"/><ColorMapEntry color="#74add1" quantity="1.5"/><ColorMapEntry color="#4575b4" quantity="2.0"/><ColorMapEntry color="#313695" quantity="999"/></ColorMap></RasterSymbolizer></Rule></FeatureTypeStyle></UserStyle></NamedLayer></StyledLayerDescriptor>`;
const spiSldFor = (layerName: string) => layerName.includes("cmip6_tas_anomaly_")
  ? cmip6SldFor(layerName)
  : layerName.includes("fire_danger_ranking_")
    ? fireDangerSldFor(layerName)
    : SPI_SLD.replace("<Name>spi_index</Name>", `<Name>geossia:${layerName}</Name>`);
// CMIP6 is routed through this raster-SLD branch; its own palette is selected
// from the published layer name by spiSldFor above.
const isSpiProduct = (id?: string) => Boolean(id && (/^spi_\d+(month)?$/.test(id) || id.startsWith("cmip6_tas_") || id === "fire_danger"));
const isSpiRaster = (id?: string) => Boolean(id && ["raster-spi1", "raster-spi3", "raster-spi12"].includes(id));
const FAPAR_SLD = `<StyledLayerDescriptor xmlns="http://www.opengis.net/sld" xmlns:ogc="http://www.opengis.net/ogc" xmlns:xlink="http://www.w3.org/1999/xlink" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" version="1.0.0"><NamedLayer><Name>fapar</Name><UserStyle><FeatureTypeStyle><Rule><RasterSymbolizer><Opacity>0.9</Opacity><ColorMap type="intervals"><ColorMapEntry color="#000000" opacity="0" quantity="-9990"/><ColorMapEntry color="#f2f3ef" quantity="0.10"/><ColorMapEntry color="#e8e6c8" quantity="0.20"/><ColorMapEntry color="#d9e6a7" quantity="0.35"/><ColorMapEntry color="#b7d77a" quantity="0.50"/><ColorMapEntry color="#78c679" quantity="0.65"/><ColorMapEntry color="#41ab5d" quantity="0.80"/><ColorMapEntry color="#238443" quantity="0.90"/><ColorMapEntry color="#005a32" quantity="1.01"/></ColorMap></RasterSymbolizer></Rule></FeatureTypeStyle></UserStyle></NamedLayer></StyledLayerDescriptor>`;
const faparSldFor = (layerName: string) => FAPAR_SLD.replace("<Name>fapar</Name>", `<Name>geossia:${layerName}</Name>`);
const FIRE_SLD = `<StyledLayerDescriptor xmlns="http://www.opengis.net/sld" xmlns:ogc="http://www.opengis.net/ogc" xmlns:xlink="http://www.w3.org/1999/xlink" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" version="1.0.0"><NamedLayer><Name>fire_density</Name><UserStyle><FeatureTypeStyle><Rule><RasterSymbolizer><Opacity>0.95</Opacity><ColorMap type="intervals"><ColorMapEntry color="#000000" opacity="0" quantity="0.5"/><ColorMapEntry color="#fff176" quantity="1.5"/><ColorMapEntry color="#ffb300" quantity="2.5"/><ColorMapEntry color="#f57c00" quantity="5.5"/><ColorMapEntry color="#e53935" quantity="10.5"/><ColorMapEntry color="#b71c1c" quantity="20.5"/><ColorMapEntry color="#6a1b9a" quantity="99999"/></ColorMap></RasterSymbolizer></Rule></FeatureTypeStyle></UserStyle></NamedLayer></StyledLayerDescriptor>`;
const fireSldFor = (layerName: string) => FIRE_SLD.replace("<Name>fire_density</Name>", `<Name>geossia:${layerName}</Name>`);
const POPULATION_SLD = `<StyledLayerDescriptor xmlns="http://www.opengis.net/sld" xmlns:ogc="http://www.opengis.net/ogc" version="1.0.0"><NamedLayer><Name>population</Name><UserStyle><FeatureTypeStyle><Rule><RasterSymbolizer><Opacity>0.9</Opacity><ColorMap type="intervals"><ColorMapEntry color="#000000" opacity="0" quantity="0.001"/><ColorMapEntry color="#ffffcc" quantity="5"/><ColorMapEntry color="#ffeda0" quantity="25"/><ColorMapEntry color="#fed976" quantity="100"/><ColorMapEntry color="#feb24c" quantity="500"/><ColorMapEntry color="#fd8d3c" quantity="1000"/><ColorMapEntry color="#fc4e2a" quantity="5000"/><ColorMapEntry color="#e31a1c" quantity="15000"/><ColorMapEntry color="#b10026" quantity="999999"/></ColorMap></RasterSymbolizer></Rule></FeatureTypeStyle></UserStyle></NamedLayer></StyledLayerDescriptor>`;
const populationSldFor = (layerName: string) => POPULATION_SLD.replace("<Name>population</Name>", `<Name>geossia:${layerName}</Name>`);
const FIRE_DANGER_SLD = `<StyledLayerDescriptor xmlns="http://www.opengis.net/sld" xmlns:ogc="http://www.opengis.net/ogc" version="1.0.0"><NamedLayer><Name>fire_danger</Name><UserStyle><FeatureTypeStyle><Rule><RasterSymbolizer><Opacity>0.88</Opacity><ColorMap type="values"><ColorMapEntry color="#000000" opacity="0" quantity="-9999"/><ColorMapEntry color="#9cffc0" quantity="1"/><ColorMapEntry color="#cde24e" quantity="2"/><ColorMapEntry color="#e6ac00" quantity="3"/><ColorMapEntry color="#d97010" quantity="4"/><ColorMapEntry color="#ad060e" quantity="5"/><ColorMapEntry color="#3a0015" quantity="6"/></ColorMap></RasterSymbolizer></Rule></FeatureTypeStyle></UserStyle></NamedLayer></StyledLayerDescriptor>`;
const fireDangerSldFor = (layerName: string) => FIRE_DANGER_SLD.replace("<Name>fire_danger</Name>", `<Name>geossia:${layerName}</Name>`);
const AETI_SLD = `<StyledLayerDescriptor xmlns="http://www.opengis.net/sld" xmlns:ogc="http://www.opengis.net/ogc" xmlns:xlink="http://www.w3.org/1999/xlink" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" version="1.0.0"><NamedLayer><Name>wapor_aeti</Name><UserStyle><FeatureTypeStyle><Rule><RasterSymbolizer><Opacity>0.92</Opacity><ColorMap type="intervals"><ColorMapEntry color="#000000" opacity="0" quantity="-9990"/><ColorMapEntry color="#f7f3df" quantity="0.5"/><ColorMapEntry color="#e8d99b" quantity="1.5"/><ColorMapEntry color="#b8d88a" quantity="2.5"/><ColorMapEntry color="#68b96d" quantity="3.5"/><ColorMapEntry color="#1f8a5b" quantity="5"/><ColorMapEntry color="#2786a8" quantity="8"/><ColorMapEntry color="#084b78" quantity="100000"/></ColorMap></RasterSymbolizer></Rule></FeatureTypeStyle></UserStyle></NamedLayer></StyledLayerDescriptor>`;
const aetiSldFor = (layerName: string) => AETI_SLD.replace("<Name>wapor_aeti</Name>", `<Name>geossia:${layerName}</Name>`);
const FAPAR_ANOMALY_SLD = `<StyledLayerDescriptor xmlns="http://www.opengis.net/sld" xmlns:ogc="http://www.opengis.net/ogc" xmlns:xlink="http://www.w3.org/1999/xlink" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" version="1.0.0"><NamedLayer><Name>fapar_anomaly</Name><UserStyle><FeatureTypeStyle><Rule><RasterSymbolizer><Opacity>0.9</Opacity><ColorMap type="intervals"><ColorMapEntry color="#000000" opacity="0" quantity="-9990"/><ColorMapEntry color="#7f0000" quantity="-0.30"/><ColorMapEntry color="#b2182b" quantity="-0.20"/><ColorMapEntry color="#d6604d" quantity="-0.10"/><ColorMapEntry color="#f4a582" quantity="-0.05"/><ColorMapEntry color="#f7f7f7" quantity="0.05"/><ColorMapEntry color="#a6dba0" quantity="0.10"/><ColorMapEntry color="#5aae61" quantity="0.20"/><ColorMapEntry color="#1b7837" quantity="0.30"/><ColorMapEntry color="#00441b" quantity="999"/></ColorMap></RasterSymbolizer></Rule></FeatureTypeStyle></UserStyle></NamedLayer></StyledLayerDescriptor>`;
const faparAnomalySldFor = (layerName: string) => FAPAR_ANOMALY_SLD.replace("<Name>fapar_anomaly</Name>", `<Name>geossia:${layerName}</Name>`);
const TCI_SLD = `<StyledLayerDescriptor xmlns="http://www.opengis.net/sld" xmlns:ogc="http://www.opengis.net/ogc" xmlns:xlink="http://www.w3.org/1999/xlink" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" version="1.0.0"><NamedLayer><Name>tci</Name><UserStyle><FeatureTypeStyle><Rule><RasterSymbolizer><Opacity>0.92</Opacity><ColorMap type="intervals"><ColorMapEntry color="#000000" opacity="0" quantity="-9990"/><ColorMapEntry color="#7f0000" quantity="10"/><ColorMapEntry color="#d73027" quantity="20"/><ColorMapEntry color="#f46d43" quantity="30"/><ColorMapEntry color="#fdae61" quantity="40"/><ColorMapEntry color="#fee08b" quantity="50"/><ColorMapEntry color="#d9ef8b" quantity="60"/><ColorMapEntry color="#a6d96a" quantity="70"/><ColorMapEntry color="#66bd63" quantity="80"/><ColorMapEntry color="#1a9850" quantity="90"/><ColorMapEntry color="#006837" quantity="101"/></ColorMap></RasterSymbolizer></Rule></FeatureTypeStyle></UserStyle></NamedLayer></StyledLayerDescriptor>`;
const tciSldFor = (layerName: string) => {
  const namedLayer = TCI_SLD.match(/<NamedLayer>.*<\/NamedLayer>/)?.[0];
  if (!namedLayer) return TCI_SLD;
  const layers = layerName.split(",").map((name) => namedLayer.replace("<Name>tci</Name>", `<Name>${name.includes(":") ? name : `geossia:${name}`}</Name>`)).join("");
  return TCI_SLD.replace(namedLayer, layers);
};
const vegetationHealthSldFor = (layerName: string) => tciSldFor(layerName);

function mosaicDatesByInstant(dates: ProductDate[]): ProductDate[] {
  const groups = new Map<string, ProductDate[]>();
  for (const date of dates) {
    const key = `${date.reference_time ?? date.period_label}|${date.style ?? ""}`;
    groups.set(key, [...(groups.get(key) ?? []), date]);
  }
  return [...groups.values()].map((group) => group.length === 1 ? group[0] : {
    ...group[0],
    layer_name: group.map((date) => date.layer_name).join(","),
    title: `${group[0].title.replace(/\s+[—-]\s+[^—-]+$/, "")} — mosaïque Afrique (${group.length} tuiles)`,
  });
}
const GEOAI_PRODUCT_TO_RASTER: Record<string, string> = {
  rain_dekad: "raster-chirps-dekad",
  rain_monthly: "raster-chirps-monthly",
  spi_1month: "raster-spi1",
  spi_3month: "raster-spi3",
  spi_12month: "raster-spi12",
  rain_forecast_5d: "raster-gefs-5d",
  rain_forecast_10d: "raster-gefs-10d",
  rain_forecast_15d: "raster-gefs-15d",
  wapor_aeti: "raster-aeti",
  wapor_rsm: "raster-rsm",
  edgar_ghg_total: "raster-edgar-ghg",
  edgar_co2: "raster-edgar-co2",
  edgar_ch4: "raster-edgar-ch4",
  edgar_n2o: "raster-edgar-n2o",
};

/* Surcouches activées par le lien profond ?theme=… depuis la page Alertes. */
const THEME_OVERLAYS: Record<string, string[]> = {
  inondations: [],
  secheresse: [],
  feux: ["firms"],
};

function productTileBounds(layerName: string): [number, number, number, number] | null {
  const match = /_(\d+)(n|s)_(\d+)(e|w)_[a-f0-9]+$/i.exec(layerName);
  if (!match) return null;
  const south = Number(match[1]) * (match[2].toLowerCase() === "s" ? -1 : 1);
  const west = Number(match[3]) * (match[4].toLowerCase() === "w" ? -1 : 1);
  return [west, south, west + 10, south + 10];
}

function productIntersection(layerName: string, bbox: [number, number, number, number]): number {
  const tile = productTileBounds(layerName);
  return tile ? Math.max(0, Math.min(tile[2], bbox[2]) - Math.max(tile[0], bbox[0])) * Math.max(0, Math.min(tile[3], bbox[3]) - Math.max(tile[1], bbox[1])) : 0;
}

// Focus géographique déduit du message en langage naturel : pays nommé dans
// COUNTRIES, sinon subdivision admin1 (GAUL2024) dont le nom apparaît dans le
// prompt. Les noms génériques (nord, littoral, plateau…) sont exclus pour
// éviter les faux positifs ; à nom égal on retient la correspondance la plus
// longue et, si un pays est cité, restreinte à ce pays.
const GENERIC_REGION_WORDS = new Set([
  "nord", "sud", "est", "ouest", "centre", "centrale", "central", "plateau", "plateaux",
  "littoral", "maritime", "savane", "savanes", "collines", "montagnes", "bassin", "bassins",
]);

function normalizePlaceName(value: string): string {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("fr").replace(/[^a-z0-9]+/g, " ").trim();
}

interface FocusZone { id: string; bbox: [number, number, number, number] | null }
interface GeoAiChart { id?: string; kind?: string; title?: string; unit?: string; points?: [string, number][] }
interface GeoAiAnalysis { mode?: string; charts: GeoAiChart[] }
interface GeoAiResultLayer { layerName: string; title: string; territory?: string }

async function resolveFocus(prompt: string): Promise<FocusZone | null> {
  const normalized = normalizePlaceName(prompt);
  const regionAliases: Record<string, RegExp> = {
    north: /afrique du nord|north africa/,
    west: /afrique de l ouest|west africa/,
    central: /afrique centrale|centrale africa|central africa/,
    east: /afrique de l est|east africa/,
    southern: /afrique australe|southern africa/,
  };
  const requestedSubregion = REGIONS.find((item) => regionAliases[item.id]?.test(normalized) || new RegExp(`\\b${item.id}\\b`).test(normalized));
  if (requestedSubregion) {
    const members = COUNTRIES.filter((country) => country.region === requestedSubregion.id);
    const bbox = members.reduce<[number, number, number, number]>((box, country) => [
      Math.min(box[0], country.bbox[0]), Math.min(box[1], country.bbox[1]), Math.max(box[2], country.bbox[2]), Math.max(box[3], country.bbox[3]),
    ], [Infinity, Infinity, -Infinity, -Infinity]);
    return { id: requestedSubregion.id, bbox };
  }
  const requestedCountry = COUNTRIES.find((country) => normalized.includes(normalizePlaceName(country.name)) || new RegExp(`\\b${country.iso3.toLowerCase()}\\b`).test(normalized));
  let region: (FocusZone & { nameLength: number }) | null = null;
  try {
    const zones = await loadRegionBundle();
    for (const [id, zone] of Object.entries(zones)) {
      const name = normalizePlaceName(zone.name);
      if (name.length < 3 || GENERIC_REGION_WORDS.has(name) || !new RegExp(`\\b${name}\\b`).test(normalized)) continue;
      if (requestedCountry && zone.iso3 !== requestedCountry.iso3) continue;
      if (!region || name.length > region.nameLength) region = { id, bbox: zone.bbox, nameLength: name.length };
    }
  } catch { /* bundle de régions indisponible : on retombe sur le pays */ }
  if (region) return region;
  if (requestedCountry) return { id: requestedCountry.iso3, bbox: requestedCountry.bbox ?? null };
  return null;
}

const BUILTIN_LEGENDS: Record<string, { color: string; label: string }[]> = {
  cmip6Temperature: [
    { color: "#fff7bc", label: "≤ 1,0 °C · Réchauffement faible" },
    { color: "#fec44f", label: "1,0 à 1,5 °C · Réchauffement modéré" },
    { color: "#fe9929", label: "1,5 à 2,0 °C · Réchauffement marqué" },
    { color: "#ec7014", label: "2,0 à 3,0 °C · Réchauffement élevé" },
    { color: "#cc4c02", label: "3,0 à 4,0 °C · Réchauffement très élevé" },
    { color: "#993404", label: "4,0 à 6,0 °C · Réchauffement extrême" },
    { color: "#662506", label: "> 6,0 °C · Réchauffement exceptionnel" },
  ],
  chirpsAnnual: [
    { color: "#fff7bc", label: "0 à 100 mm · Très faible" },
    { color: "#fee391", label: "100 à 250 mm · Faible" },
    { color: "#fec44f", label: "250 à 500 mm · Modérée" },
    { color: "#a1d99b", label: "500 à 750 mm · Assez élevée" },
    { color: "#41b6c4", label: "750 à 1 000 mm · Élevée" },
    { color: "#2c7fb8", label: "1 000 à 1 500 mm · Très élevée" },
    { color: "#253494", label: "1 500 à 2 000 mm · Forte" },
    { color: "#081d58", label: "> 2 000 mm · Très forte" },
  ],
  spi: [
    { color: "#760005", label: "≤ −2,0 · Sécheresse extrême" },
    { color: "#d73027", label: "−2,0 à −1,5 · Sécheresse sévère" },
    { color: "#f46d43", label: "−1,5 à −1,0 · Sécheresse modérée" },
    { color: "#fdae61", label: "−1,0 à −0,5 · Légèrement sec" },
    { color: "#ffffbf", label: "−0,5 à 0,5 · Normal" },
    { color: "#abd9e9", label: "0,5 à 1,0 · Légèrement humide" },
    { color: "#74add1", label: "1,0 à 1,5 · Humidité modérée" },
    { color: "#4575b4", label: "1,5 à 2,0 · Très humide" },
    { color: "#313695", label: "≥ 2,0 · Humidité extrême" },
  ],
  aeti: [
    { color: "#f7f3df", label: "0 – 0,5 · Très faible" },
    { color: "#e8d99b", label: "0,5 – 1,5 · Faible" },
    { color: "#b8d88a", label: "1,5 – 2,5 · Modérée" },
    { color: "#68b96d", label: "2,5 – 3,5 · Assez élevée" },
    { color: "#1f8a5b", label: "3,5 – 5 · Élevée" },
    { color: "#2786a8", label: "5 – 8 · Très élevée" },
    { color: "#084b78", label: "≥ 8 · Exceptionnelle" },
  ],
  vhi: [
    { color: "#67000d", label: "0 – 10 · Stress extrême" },
    { color: "#cb181d", label: "10 – 20 · Stress sévère" },
    { color: "#fc4e2a", label: "20 – 30 · Stress modéré" },
    { color: "#fd8d3c", label: "30 – 40 · Stress léger" },
    { color: "#ffffb2", label: "40 – 50 · Normal bas" },
    { color: "#d9f0a3", label: "50 – 60 · Normal" },
    { color: "#78c679", label: "60 – 70 · Favorable" },
    { color: "#31a354", label: "70 – 80 · Bon" },
    { color: "#006837", label: "80 – 100 · Très bon" },
  ],
  svi: [
    { color: "#67000d", label: "≤ −2,0 · Exceptionnellement bas" },
    { color: "#cb181d", label: "−2,0 à −1,5 · Très bas" },
    { color: "#fc4e2a", label: "−1,5 à −1,0 · Sécheresse modérée" },
    { color: "#fdae61", label: "−1,0 à −0,5 · Sous la normale" },
    { color: "#ffffbf", label: "−0,5 à 0,5 · Normal" },
    { color: "#a6d96a", label: "0,5 à 1,0 · Au-dessus" },
    { color: "#31a354", label: "1,0 à 1,5 · Nettement au-dessus" },
    { color: "#006837", label: "≥ 1,5 · Exceptionnellement haut" },
  ],
  evi: [
    { color: "#f7fcb1", label: "0 – 0,1 · Sol nu / eau" },
    { color: "#d9f0a3", label: "0,1 – 0,2 · Végétation très clairsemée" },
    { color: "#addd8e", label: "0,2 – 0,3 · Végétation éparse" },
    { color: "#78c679", label: "0,3 – 0,4 · Végétation modérée" },
    { color: "#41ab5d", label: "0,4 – 0,5 · Végétation moyenne-dense" },
    { color: "#238443", label: "0,5 – 0,7 · Végétation dense" },
    { color: "#005a32", label: "0,7 – 1,0 · Végétation très dense" },
  ],
  fapar: [
    { color: "#f2f3ef", label: "0 à 0,10 · Très faible absorption" },
    { color: "#e8e6c8", label: "0,10 à 0,20 · Faible" },
    { color: "#d9e6a7", label: "0,20 à 0,35 · Modérée" },
    { color: "#b7d77a", label: "0,35 à 0,50 · Moyenne" },
    { color: "#78c679", label: "0,50 à 0,65 · Assez élevée" },
    { color: "#41ab5d", label: "0,65 à 0,80 · Élevée" },
    { color: "#238443", label: "0,80 à 0,90 · Très élevée" },
    { color: "#005a32", label: "0,90 à 1,00 · Maximale" },
  ],
  faparAnomaly: [
    { color: "#7f0000", label: "≤ −0,30 · Forte anomalie négative" },
    { color: "#b2182b", label: "−0,30 à −0,20 · Très déficitaire" },
    { color: "#d6604d", label: "−0,20 à −0,10 · Déficitaire" },
    { color: "#f4a582", label: "−0,10 à −0,05 · Légèrement déficitaire" },
    { color: "#f7f7f7", label: "−0,05 à 0,05 · Proche de la normale" },
    { color: "#a6dba0", label: "0,05 à 0,10 · Légèrement excédentaire" },
    { color: "#5aae61", label: "0,10 à 0,20 · Excédentaire" },
    { color: "#1b7837", label: "0,20 à 0,30 · Très excédentaire" },
    { color: "#00441b", label: "≥ 0,30 · Forte anomalie positive" },
  ],
  fireDensity: [
    { color: "#fff176", label: "0 à 1 · Très faible densité" },
    { color: "#ffb300", label: "1 à 2 · Faible densité" },
    { color: "#f57c00", label: "2 à 5 · Densité modérée" },
    { color: "#e53935", label: "5 à 10 · Forte densité" },
    { color: "#b71c1c", label: "10 à 20 · Très forte densité" },
    { color: "#6a1b9a", label: "> 20 · Densité extrême" },
  ],
  population: [
    { color: "#ffffcc", label: "0 à 5 · Très faible densité" },
    { color: "#ffeda0", label: "5 à 25 · Faible densité" },
    { color: "#fed976", label: "25 à 100 · Densité modérée" },
    { color: "#feb24c", label: "100 à 500 · Densité élevée" },
    { color: "#fd8d3c", label: "500 à 1 000 · Forte densité" },
    { color: "#fc4e2a", label: "1 000 à 5 000 · Très forte densité" },
    { color: "#e31a1c", label: "5 000 à 15 000 · Métropole" },
    { color: "#b10026", label: "> 15 000 · Mégapole" },
  ],
  gdoSeasonal: [
    { color: "#ffff00", label: "1 · Sec, période retour ≥ 6 ans" },
    { color: "#ffaa00", label: "2 · Sec, période retour ≥ 12 ans" },
    { color: "#ff0000", label: "3 · Sec, période retour ≥ 24 ans" },
    { color: "#e9ccf9", label: "4 · Humide, période retour ≥ 6 ans" },
    { color: "#c980c6", label: "5 · Humide, période retour ≥ 12 ans" },
    { color: "#833393", label: "6 · Humide, période retour ≥ 24 ans" },
    { color: "#5ab4ac", label: "7 · Signal sec et humide simultané" },
  ],
};

function resolveBuiltinLegend(indicatorId: string, title: string): { color: string; label: string }[] | null {
  if (indicatorId.startsWith("cmip6_tas_") || /Température\s+—\s+SSP/i.test(title)) return BUILTIN_LEGENDS.cmip6Temperature;
  if (indicatorId === "rain_year" || /pluie annuelle.*CHIRPS/i.test(title)) return BUILTIN_LEGENDS.chirpsAnnual;
  if (/^spi[_-]?\d/i.test(indicatorId) || /^SPI(?:[- ]?\d+)?(?:\s*mois)?$/i.test(title.trim())) return BUILTIN_LEGENDS.spi;
  if (/^vhi/i.test(indicatorId) || /^VHI/i.test(title)) return BUILTIN_LEGENDS.vhi;
  if (/^svi$/i.test(indicatorId) || /\bSVI\b/.test(title)) return BUILTIN_LEGENDS.svi;
  if (/^evi$/i.test(indicatorId) || /\bEVI\b.*\bcourant\b/i.test(title)) return BUILTIN_LEGENDS.evi;
  if (/fapar[_-]?anomaly/i.test(indicatorId) || /anomalie\s+fapar/i.test(title)) return BUILTIN_LEGENDS.faparAnomaly;
  if (/fapar/i.test(indicatorId) || /\bfapar\b/i.test(title)) return BUILTIN_LEGENDS.fapar;
  if (/fire[_-]?density/i.test(indicatorId) || /densité\s+de\s+feux\s+actifs/i.test(title)) return BUILTIN_LEGENDS.fireDensity;
  if (/aeti/i.test(indicatorId) || /Évapotranspiration réelle/i.test(title)) return BUILTIN_LEGENDS.aeti;
  if (/^gdo_fcst/i.test(indicatorId) || /prévision\s+sécheresse/i.test(title)) return BUILTIN_LEGENDS.gdoSeasonal;
  if (/population/i.test(indicatorId) || /densité\s+de\s+population/i.test(title)) return BUILTIN_LEGENDS.population;
  return null;
}

function LegendLabel({ children }: { children: string }) {
  const [range, ...descriptionParts] = children.split("·");
  const description = descriptionParts.join("·").trim();
  if (!description) return <span className="legend-text legend-text--single">{children}</span>;
  return (
    <span className="legend-text">
      <span className="legend-range">{range.trim()}</span>
      <span className="legend-description">{description}</span>
    </span>
  );
}

function DatabaseLegend({ legend, fallbackUrl, title, indicatorId }: { legend: ProductLegend | null; fallbackUrl: string | null; title: string; indicatorId?: string }) {
  const builtin = resolveBuiltinLegend(indicatorId ?? "", title);
  const entries = builtin ?? (legend?.style?.classes ?? legend?.style?.stops ?? []);
  const [fallbackBroken, setFallbackBroken] = useState(false);
  useEffect(() => { setFallbackBroken(false); }, [fallbackUrl]);
  if (entries.length) {
    return (
      <ul className={`legend legend--${builtin ? "classes" : (legend?.type ?? "classes")}`}>
        {entries.map((item, index) => {
          const label = "label" in item && item.label?.trim()
            ? item.label
            : "value" in item
              ? (legend?.type === "continuous" ? `${(item as { value: string | number }).value}${legend.unit ? ` ${legend.unit}` : ""}` : String((item as { value: string | number }).value))
              : "";
          return (
            <li key={`${index}`}>
              <i style={{ background: item.color, opacity: "opacity" in item ? ((item as { opacity?: number }).opacity ?? 1) : 1 }} />
              <LegendLabel>{label}</LegendLabel>
            </li>
          );
        })}
      </ul>
    );
  }
  return fallbackUrl && !fallbackBroken
    ? <img className="raster-legend" src={fallbackUrl} alt={`Légende ${title}`} onError={() => setFallbackBroken(true)} />
    : <p className="legend-empty">Légende non renseignée dans le catalogue.</p>;
}

const TUTORIAL_STEPS: Array<{ icon: IconName; title: string; text: string; tips: string[]; action?: "indicators" | "countries" | "views" }> = [
  {
    icon: "layers",
    title: "Choisir un indicateur",
    text: "Ouvrez Indicateurs, puis choisissez une donnée climatique ou environnementale. La carte, la date et la légende se synchronisent automatiquement.",
    tips: ["Commencez par un seul indicateur.", "Changez ensuite la date pour comparer les périodes."],
    action: "indicators",
  },
  {
    icon: "search",
    title: "Cibler un territoire",
    text: "Utilisez Pays pour rechercher un État, ou les onglets Pays, Régions et Sous-rég. ONU dans le panneau pour changer d’échelle.",
    tips: ["Cliquez sur un pays pour cadrer la carte.", "Cliquez à nouveau sur Afrique pour revenir à la vue continentale."],
    action: "countries",
  },
  {
    icon: "list",
    title: "Lire la carte",
    text: "Le bouton Légende en bas à droite explique les couleurs et les seuils. Le titre en haut rappelle l’indicateur, l’unité et la période affichée.",
    tips: ["Les zones transparentes correspondent généralement à l’absence de données.", "Survolez ou sélectionnez un territoire pour obtenir son contexte."],
  },
  {
    icon: "star",
    title: "Enregistrer une vue",
    text: "Une vue mémorise la couche, la date, le territoire, le fond de carte et le mode 2D/3D. Retrouvez-la ensuite dans Vues.",
    tips: ["Donnez d’abord à la carte la configuration souhaitée.", "Cliquez sur Enregistrer la vue actuelle."],
    action: "views",
  },
  {
    icon: "download",
    title: "Télécharger les données",
    text: "Sélectionnez une couche raster et un pays, puis cliquez sur l’icône de téléchargement à droite. La demande est préparée sur la page Téléchargements.",
    tips: ["Le téléchargement est découpé à l’emprise du pays.", "Le bouton GeoTIFF apparaît lorsque le fichier est prêt."],
  },
  {
    icon: "help",
    title: "Interroger GeoAI",
    text: "Ouvrez GeoAI pour demander une couche, une date ou une analyse en langage naturel. Vérifiez toujours la couche et la période affichées après la réponse.",
    tips: ["Exemple : « Affiche le SPI 3 mois au Sénégal ».", "Exemple : « Compare la pluie des deux dernières décades »."]
  },
];

function GeoportalTutorial({ step, onStep, onClose, onOpenIndicators, onOpenCountries, onOpenViews }: { step: number; onStep: (step: number) => void; onClose: () => void; onOpenIndicators: () => void; onOpenCountries: () => void; onOpenViews: () => void }) {
  const item = TUTORIAL_STEPS[step];
  const openAction = () => {
    if (item.action === "indicators") onOpenIndicators();
    if (item.action === "countries") onOpenCountries();
    if (item.action === "views") onOpenViews();
    onClose();
  };
  return (
    <div className="tutorial-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section className="tutorial-card" role="dialog" aria-modal="true" aria-labelledby="tutorial-title">
        <header>
          <span className="tutorial-icon"><Icon name={item.icon} size={22} /></span>
          <div><small>Tutoriel pratique · {step + 1}/{TUTORIAL_STEPS.length}</small><h2 id="tutorial-title">{item.title}</h2></div>
          <button className="icon-btn" onClick={onClose} aria-label="Fermer le tutoriel"><Icon name="close" size={17} /></button>
        </header>
        <div className="tutorial-progress" aria-hidden="true"><i style={{ width: `${((step + 1) / TUTORIAL_STEPS.length) * 100}%` }} /></div>
        <p>{item.text}</p>
        <ul>{item.tips.map((tip) => <li key={tip}>{tip}</li>)}</ul>
        {item.action && <button className="tutorial-practice" onClick={openAction}>Essayer maintenant</button>}
        <footer>
          <button className="btn btn-ghost sm" onClick={() => onStep(step - 1)} disabled={step === 0}>Précédent</button>
          {step < TUTORIAL_STEPS.length - 1
            ? <button className="btn btn-dark sm" onClick={() => onStep(step + 1)}>Suivant</button>
            : <button className="btn btn-dark sm" onClick={onClose}>Terminer</button>}
        </footer>
      </section>
    </div>
  );
}

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

function GeoAiAnalysisCard({ analysis, onClose }: { analysis: GeoAiAnalysis; onClose: () => void }) {
  const chart = analysis.mode === "change"
    ? analysis.charts.find((item) => item.kind === "diverging_bar") ?? analysis.charts[0]
    : analysis.charts.find((item) => item.id === "landcover-composition") ?? analysis.charts[0];
  const points = (chart?.points ?? []).filter((point) => Number.isFinite(point[1]));
  const max = Math.max(1, ...points.map((point) => Math.abs(point[1])));
  return (
    <section className="geoai-analysis-card" aria-label="Graphique de l’analyse GeoAI">
      <header><div><small>Analyse GeoAI</small><strong>{chart?.title ?? "Statistiques territoriales"}</strong></div><button onClick={onClose} aria-label="Fermer">×</button></header>
      <div className="geoai-analysis-bars">
        {points.map(([label, value]) => (
          <div className="geoai-analysis-row" key={label}>
            <span title={label}>{label}</span>
            <i><b className={value < 0 ? "negative" : ""} style={{ width: `${Math.max(1, Math.abs(value) / max * 100)}%` }} /></i>
            <strong>{value.toLocaleString("fr-FR", { maximumFractionDigits: 1 })} {chart?.unit ?? ""}</strong>
          </div>
        ))}
      </div>
      <footer>{analysis.mode === "change" ? "Variation entre les millésimes demandés" : "Répartition du millésime affiché — aucune évolution déduite"}</footer>
    </section>
  );
}

export default function GeoportalPage() {
  useTitle("Géoportail");
  const navigate = useNavigate();
  const { bundle, error } = useBundle();
  const [params, setParams] = useSearchParams();
  const alertContext = Boolean(params.get("theme") && (params.get("focus") || params.get("bbox")));
  const indicator = indicatorById(params.get("ind"));
  const selected = params.get("pays");
  const mapRef = useRef<MapCanvasHandle>(null);
  const currentUser = useAuth();

  const [panelOpen, setPanelOpen] = useState(true);
  const [indicatorVisible, setIndicatorVisible] = useState(false);
  const [rasterId, setRasterId] = useState<string | null>(() =>
    params.get("raster")
    ?? (!params.get("theme") && !params.get("product") ? "raster-gefs-5d" : null),
  );
  const [period, setPeriod] = useState(() => params.get("date") || "");
  const [panelTab, setPanelTab] = useState<PanelTab>("layers");
  const [subdivision, setSubdivision] = useState<Subdivision>("pays");
  const [region, setRegion] = useState<string>("all");
  const [draftExcluded, setDraftExcluded] = useState<string[]>([]);
  const [draftRange, setDraftRange] = useState<[number, number]>(indicator.domain);
  const [applied, setApplied] = useState<{ excluded: string[]; range: [number, number] }>({ excluded: [], range: indicator.domain });
  const [excludeQuery, setExcludeQuery] = useState("");
  const [tool, setTool] = useState<Tool>("legend");
  const [basemap, setBasemap] = useState<BasemapId>("neutre");
  const [overlays, setOverlays] = useState<string[]>([]);
  const [hover, setHover] = useState<{ iso3: string; x: number; y: number } | null>(null);
  const [territoryOpen, setTerritoryOpen] = useState(false);
  const [favorites, setFavorites] = useState<SavedView[]>(readFavorites);
  const [search, setSearch] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [dismissedCountryCard, setDismissedCountryCard] = useState<string | null>(null);
  // Climate trends (as in the main portal's Results panel): drawer for the
  // selected zone, and the animated map 1901-2100.
  const [trendsOpen, setTrendsOpen] = useState(false);
  const [trendVar, setTrendVar] = useState<TrendVariable>("tmp");
  const [trendSsp, setTrendSsp] = useState<Ssp | "obs">("ssp245");
  const [timelapse, setTimelapse] = useState<{ variable: TrendVariable; ssp: Ssp; year: number; playing: boolean } | null>(null);
  const [annual, setAnnual] = useState<AnnualTable | null>(null);
  const [fireAssessOpen, setFireAssessOpen] = useState(false);
  const [floodAssessOpen, setFloodAssessOpen] = useState(false);
  const [fireInitParams, setFireInitParams] = useState<FireInitialParams | null>(null);
  const [compareMode, setCompareMode] = useState(false);
  const [drawnBbox, setDrawnBbox] = useState<[number, number, number, number] | null>(null);
  const [drawingZone, setDrawingZone] = useState(false);
  const [geeTileLayers, setGeeTileLayers] = useState<GeeTileEntry[]>([]);
  const activeAssessment = fireAssessOpen ? "fire" : floodAssessOpen ? "flood" : null;
  const drawBboxActive = activeAssessment !== null && drawingZone;
  const [mode3d, setMode3d] = useState(() => params.get("mode") === "3d");
  const [shareDone, setShareDone] = useState(false);
  const [tutorialStep, setTutorialStep] = useState<number | null>(null);
  const [geoAiAnalysis, setGeoAiAnalysis] = useState<GeoAiAnalysis | null>(null);
  const [geoAiResultLayer, setGeoAiResultLayer] = useState<GeoAiResultLayer | null>(null);
  const [hiddenLayerIds, setHiddenLayerIds] = useState<Set<string>>(() => new Set());
  const [expandedLayerIds, setExpandedLayerIds] = useState<Set<string>>(() => new Set());

  // Lien profond depuis la page Alertes : ?focus=lon,lat (avec &bbox=ouest,sud,est,nord
  // pour une zone) épingle le lieu et cadre la vue au montage du géoportail ;
  // &theme=<risque> active en prime la couche thématique correspondante.
  useEffect(() => {
    const theme = params.get("theme");
    if (theme && THEME_OVERLAYS[theme]?.length) {
      const wanted = THEME_OVERLAYS[theme];
      setOverlays((prev) => (wanted.some((id) => !prev.includes(id)) ? [...new Set([...prev, ...wanted])] : prev));
      setTool("legend");
    }
    const focus = params.get("focus");
    const bboxParam = params.get("bbox");
    if (!focus && !bboxParam) return;
    const [lon, lat] = (focus ?? "").split(",").map(Number);
    const bbox = bboxParam?.split(",").map(Number);
    const validBbox = Boolean(bbox && bbox.length === 4 && bbox.every((value) => Number.isFinite(value)));
    if (Number.isFinite(lon) && Number.isFinite(lat)) {
      mapRef.current?.focusAlert(lon, lat, validBbox ? (bbox as [number, number, number, number]) : undefined);
    } else if (validBbox) {
      mapRef.current?.fitBounds(bbox as [number, number, number, number]);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

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

  const rasterCatalog = useRasterClimateCatalog();
  const rasterIndicator = rasterCatalog.layers.find((item) => item.id === rasterId) ?? null;
  const [rasterDbLegend, setRasterDbLegend] = useState<ProductLegend | null>(null);

  useEffect(() => {
    let live = true;
    if (!rasterIndicator?.datasetId) {
      setRasterDbLegend(null);
      return () => { live = false; };
    }
    setRasterDbLegend(null);
    fetchLayerLegend(rasterIndicator.datasetId)
      .then((legend) => { if (live) setRasterDbLegend(legend); })
      .catch(() => { if (live) setRasterDbLegend(null); });
    return () => { live = false; };
  }, [rasterIndicator?.datasetId]);

  // Product catalog from the DB (migration 0045): families, indicators, dates.
  const productCatalog = useProductCatalog();
  const [productIndicatorId, setProductIndicatorId] = useState<string | null>(null);
  const [productDates, setProductDates] = useState<ProductDate[]>([]);
  const [productDateLayer, setProductDateLayer] = useState<string>("");
  const [productLoading, setProductLoading] = useState(false);
  const [productLegend, setProductLegend] = useState<ProductLegend | null>(null);

  const activeProductIndicator = useMemo((): ProductIndicator | null => {
    if (!productIndicatorId) return null;
    for (const f of productCatalog.families) {
      const found = f.indicators.find((i) => i.id === productIndicatorId);
      if (found) return found;
    }
    return null;
  }, [productIndicatorId, productCatalog.families]);

  useEffect(() => {
    let live = true;
    if (!productIndicatorId) {
      setProductLegend(null);
      return () => { live = false; };
    }
    setProductLegend(null);
    fetchProductLegend(productIndicatorId)
      .then((legend) => { if (live) setProductLegend(legend); })
      .catch(() => { if (live) setProductLegend(null); });
    return () => { live = false; };
  }, [productIndicatorId]);

  const activeProductDate = productDates.find((d) => d.layer_name === productDateLayer) ?? null;

  const periodOptions = useMemo(() => {
    if (activeProductIndicator && productDates.length)
      return productDates.map((d) => ({ value: d.layer_name, label: productForecastLabel(activeProductIndicator, d) }));
    if (rasterIndicator)
      return rasterIndicator.periods.map((item) => ({ value: item.id, label: item.label }));
    if (!indicatorVisible) return [];
    return availablePeriods(indicator.id, bundle?.zones.AFR);
  }, [indicator.id, indicatorVisible, bundle, rasterIndicator, activeProductIndicator, productDates]);

  const rasterPeriod = rasterIndicator?.periods.find((item) => item.id === period) ?? rasterIndicator?.periods[0] ?? null;
  const vegetationHealthAfricaWide = ["raster-tci", "raster-vci", "raster-vhi"].includes(rasterIndicator?.id ?? "")
    || Boolean(activeProductIndicator?.id && /^(tci|vci|vhi|svi|evi)/.test(activeProductIndicator.id));
  // Historical SPI layers predate the mandatory GAUL 2024 archive cutline.
  // Apply the same Africa mask to every SPI-1/3/12 date on display; current
  // and future acquisitions are also clipped before archival by the provider.
  const spiAfricaWide = ["raster-spi1", "raster-spi3", "raster-spi12"].includes(rasterIndicator?.id ?? "")
    || Boolean(activeProductIndicator?.id && /^spi_(1|3|12)$/.test(activeProductIndicator.id));
  const populationAfricaWide = activeProductIndicator?.id === "population" || activeProductIndicator?.id === "worldpop_population";

  const selectProductIndicator = (id: string, requestedLayer?: string | null) => {
    setProductIndicatorId(id);
    setRasterId(null);
    setIndicatorVisible(false);
    setProductDates([]);
    setProductDateLayer("");
    setProductLoading(true);
    setProductLegend(null);
    fetchProductDates(id).then((dates) => {
      const displayedDates = /^(tci|vci|vhi|svi|evi)/.test(id) ? mosaicDatesByInstant(dates) : dates;
      setProductDates(displayedDates);
      setProductLoading(false);
      if (displayedDates.length) {
        const selectedDate = displayedDates.find((item) => item.layer_name === requestedLayer) ?? displayedDates[0];
        setProductDateLayer(selectedDate.layer_name);
        setPeriod(selectedDate.layer_name);
      }
    }).catch(() => { setProductLoading(false); });
  };

  useEffect(() => {
    const sharedProduct = params.get("product");
    if (!sharedProduct || productIndicatorId || !productCatalog.families.some((family) => family.indicators.some((item) => item.id === sharedProduct))) return;
    selectProductIndicator(sharedProduct, params.get("date"));
  }, [productCatalog.families]); // eslint-disable-line react-hooks/exhaustive-deps

  const shareMapView = async () => {
    const shareUrl = new URL(window.location.href);
    if (activeProductIndicator) {
      shareUrl.searchParams.set("product", activeProductIndicator.id);
      shareUrl.searchParams.delete("raster");
    } else if (rasterIndicator) {
      shareUrl.searchParams.set("raster", rasterIndicator.id);
      shareUrl.searchParams.delete("product");
    }
    if (period && period !== "latest") shareUrl.searchParams.set("date", period);
    else shareUrl.searchParams.delete("date");
    if (mode3d) shareUrl.searchParams.set("mode", "3d");
    else shareUrl.searchParams.delete("mode");
    const url = shareUrl.toString();
    const copyUrl = async () => {
      if (navigator.clipboard?.writeText && window.isSecureContext) {
        await navigator.clipboard.writeText(url);
        return true;
      }
      const field = document.createElement("textarea");
      field.value = url;
      field.setAttribute("readonly", "");
      field.style.position = "fixed";
      field.style.opacity = "0";
      document.body.appendChild(field);
      field.select();
      const copied = document.execCommand("copy");
      field.remove();
      return copied;
    };
    try {
      if (navigator.share) {
        try {
          await navigator.share({ title: "Vue cartographique GEOSSIA", url });
        } catch (error) {
          if ((error as DOMException).name === "AbortError") return;
          if (!(await copyUrl())) window.prompt("Copiez le lien de cette vue :", url);
        }
      } else if (!(await copyUrl())) {
        window.prompt("Copiez le lien de cette vue :", url);
      }
      setShareDone(true);
      window.setTimeout(() => setShareDone(false), 1800);
    } catch (error) {
      if ((error as DOMException).name !== "AbortError") setShareDone(false);
    }
  };

  const selectProductDate = (layerName: string) => {
    setProductDateLayer(layerName);
    setPeriod(layerName);
  };

  const clearProduct = () => {
    setProductIndicatorId(null);
    setProductDates([]);
    setProductDateLayer("");
    setProductLegend(null);
  };

  // Replay map actions returned by GeoAI. Try the product catalog first (it
  // knows every indicator by id); fall back to the raster definitions map.
  useEffect(() => {
    if (!rasterCatalog.layers.length && !productCatalog.families.length) return;
    const apply = async (request: unknown) => {
      const envelope = request && typeof request === "object" && !Array.isArray(request)
        ? request as { actions?: unknown[]; question?: string }
        : { actions: request as unknown[], question: "" };
      if (!Array.isArray(envelope.actions)) return;
      for (const item of envelope.actions) {
        if (!item || typeof item !== "object") continue;
        const typed = item as { type?: string; overlay_id?: string };
        if (typed.type === "query_result") {
          const queryAction = item as { result?: Record<string, unknown>; map_layer?: string; territory_id?: string };
          const jobResult = queryAction.result;
          const manifest = jobResult?.result && typeof jobResult.result === "object" ? jobResult.result as Record<string, unknown> : jobResult;
          const analysis = manifest?.result && typeof manifest.result === "object" ? manifest.result as Record<string, unknown> : manifest;
          const charts = Array.isArray(analysis?.charts) ? analysis.charts as GeoAiChart[] : [];
          if (charts.length) setGeoAiAnalysis({ mode: String(analysis?.analysis_mode ?? ""), charts });
          const mapLayers = (analysis?.map_layers && typeof analysis.map_layers === "object"
            ? analysis.map_layers
            : manifest?.map_layers && typeof manifest.map_layers === "object" ? manifest.map_layers : {}) as Record<string, unknown>;
          const qualified = queryAction.map_layer ?? Object.values(mapLayers).find((value): value is string => typeof value === "string");
          if (qualified) {
            setGeoAiResultLayer({
              layerName: qualified,
              title: String(manifest?.question ?? jobResult?.question ?? envelope.question ?? "Résultat de l’analyse GeoAI"),
              territory: queryAction.territory_id,
            });
            setTool("legend");
          }
        }
        if (typed.type === "toggle_overlay" && typed.overlay_id) {
          setOverlays((prev) => prev.includes(typed.overlay_id!) ? prev : [...prev, typed.overlay_id!]);
        }
        if (typed.type === "fire_assessment") {
          const fa = item as {
            sensor?: string; bbox?: number[];
            before_start?: string; before_end?: string;
            after_start?: string; after_end?: string;
          };
          if (fa.bbox && fa.bbox.length === 4) {
            setDrawnBbox(fa.bbox as [number, number, number, number]);
          }
          if (fa.before_start && fa.after_start) {
            setFireInitParams({
              sensor: (fa.sensor as "sentinel2" | "landsat" | "modis") ?? "sentinel2",
              bbox: fa.bbox?.length === 4 ? fa.bbox as [number, number, number, number] : undefined,
              before_start: fa.before_start,
              before_end: fa.before_end,
              after_start: fa.after_start,
              after_end: fa.after_end,
            });
          }
          setFireAssessOpen(true);
        }
      }
      // Keep the map and the natural-language request in sync: when a country
      // or an admin1 region is named, select it and zoom to its boundary while
      // showing the raster. This focus is intentionally independent from a
      // show_layer action: the model may say that the layer is already shown.
      const prompt = (envelope.question ?? "").toLocaleLowerCase("fr");
      const mapAction = envelope.actions.find((item) => item && typeof item === "object" && (item as { territory_id?: string }).territory_id) as { territory_id?: string } | undefined;
      const focus = await resolveFocus(mapAction?.territory_id ? `${prompt} ${mapAction.territory_id}` : prompt);
      const next = new URLSearchParams(params);
      if (focus) {
        next.set("pays", focus.id);
        setParams(next, { replace: true });
        if (focus.bbox) mapRef.current?.fitBounds(focus.bbox);
      }
      // The agent may emit several show_layer actions for the same request
      // (dataset id and product id). Try each until one actually applies —
      // the first may match nothing in either catalog.
      const showActions = envelope.actions.filter((item) => item && typeof item === "object" && (item as { type?: string }).type === "show_layer") as { indicator_id?: string; layer_name?: string }[];
      const action: { indicator_id?: string; layer_name?: string } | undefined = showActions[0];
      if (!action) {
        sessionStorage.removeItem("c2-geoai-actions");
        return;
      }
      if (!focus) {
        next.delete("pays");
        setParams(next, { replace: true });
        mapRef.current?.fitBounds([-25, -36, 60, 38]);
      }
      // Try product catalog first
      const productMatch = action.indicator_id
        ? (() => {
            for (const candidate of showActions) {
              for (const f of productCatalog.families) {
                const found = f.indicators.find((i) => i.id === candidate.indicator_id);
                if (found && found.dates_count > 0) return { found, action: candidate };
              }
            }
            return null;
          })()
        : null;
      if (productMatch) {
        {
          const action = productMatch.action;
          const found = productMatch.found;
          {
            // Resolve the dates here instead of calling selectProductIndicator:
            // the agent may request a precise published tile/date that is not
            // the first entry returned by the catalogue.
            setProductIndicatorId(found.id);
            setRasterId(null);
            setIndicatorVisible(false);
            setProductLoading(true);
            fetchProductDates(found.id).then((dates) => {
              const samePeriod = dates.filter((date) => !action.layer_name || date.reference_time === dates.find((item) => item.layer_name === action.layer_name)?.reference_time);
              const geographic = focus?.bbox ? samePeriod
                .map((date) => ({ date, area: productIntersection(date.layer_name, focus.bbox as [number, number, number, number]) }))
                .filter((entry) => entry.area > 0)
                .sort((a, b) => b.area - a.area)[0]?.date : null;
              let requested = geographic ?? dates.find((date) => date.layer_name === action.layer_name) ?? dates[0];
              let displayedDates = dates;
              if (!focus && requested) {
                const sameInstant = dates.filter((date) => date.reference_time === requested!.reference_time && date.style === requested!.style);
                if (sameInstant.length > 1) {
                  requested = {
                    ...requested,
                    layer_name: sameInstant.map((date) => date.layer_name).join(","),
                    style: requested.style ? sameInstant.map(() => requested!.style).join(",") : requested.style,
                  };
                  displayedDates = [requested, ...dates.filter((date) => date.reference_time !== requested!.reference_time)];
                }
              }
              setProductDates(displayedDates);
              setProductDateLayer(requested?.layer_name ?? "");
              setPeriod(requested?.layer_name ?? "latest");
              setProductLoading(false);
            }).catch(() => setProductLoading(false));
            setPanelTab("layers");
            setPanelOpen(true);
            sessionStorage.removeItem("c2-geoai-actions");
            return;
          }
        }
      }
      const layerMatch = (() => {
        for (const candidate of showActions) {
          const match = rasterCatalog.layers.find((item) => item.periods.some((entry) => entry.layerName === candidate.layer_name))
            ?? rasterCatalog.layers.find((item) => item.id === GEOAI_PRODUCT_TO_RASTER[candidate.indicator_id ?? ""] || item.datasetId === candidate.indicator_id);
          if (match) return { layer: match, action: candidate };
        }
        return null;
      })();
      if (!layerMatch) return;
      const layer = layerMatch.layer;
      const selectedPeriod = layer.periods.find((entry) => entry.layerName === layerMatch.action.layer_name) ?? layer.periods[0];
      setRasterId(layer.id);
      setIndicatorVisible(false);
      setPeriod(selectedPeriod?.id ?? "latest");
      setPanelTab("layers");
      setPanelOpen(true);
      sessionStorage.removeItem("c2-geoai-actions");
    };
    const pending = sessionStorage.getItem("c2-geoai-actions");
    if (pending) {
      // A queued GeoAI action is a one-shot command. Keeping it in storage
      // caused a previous fire-assessment request to reopen every time the
      // product catalog changed, effectively locking the indicator select.
      sessionStorage.removeItem("c2-geoai-actions");
      try { void apply(JSON.parse(pending)).catch(() => { /* focus régional indisponible : ignorer */ }); } catch { /* malformed command: ignore */ }
    }
    const listener = (event: Event) => void apply((event as CustomEvent).detail).catch(() => { /* focus régional indisponible : ignorer */ });
    window.addEventListener("c2:geoai-actions", listener);
    return () => window.removeEventListener("c2:geoai-actions", listener);
  }, [rasterCatalog.layers, productCatalog.families]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (rasterIndicator && !rasterIndicator.periods.some((item) => item.id === period)) setPeriod(rasterIndicator.periods[0]?.id ?? "latest");
  }, [rasterIndicator, period]);

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
  const regionLevel = subdivision === "admin1" || timelapse !== null || Boolean(selected?.includes("."));
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
    if (id && !id.includes(".")) {
      setSubdivision("pays");
      setRegion("all");
    }
    update({ pays: id });
    setDismissedCountryCard(null);
    if (!id) return;
    const bbox = id.includes(".") ? regionZones?.[id]?.bbox : COUNTRY_BY_ISO3.get(id)?.bbox;
    if (bbox) mapRef.current?.fitBounds(bbox);
  };

  const values = useMemo(() => {
    const out: Record<string, number | null> = {};
    if (!bundle) return out;
    for (const unit of units) {
      const zone = unit.id.includes(".") ? regionZones?.[unit.id] : bundle.zones[unit.id];
      out[unit.id] = zone ? indicatorValueAt(indicator, zone, period) : null;
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
  }, [bundle, regionZones, units, indicator, subdivision, period]);

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
        out[unit.id] = { fill: v === null ? NO_DATA : rampColor(ramp, v, range), active: true };
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
    setRasterId(null);
    setProductDateLayer("");
    setTimelapse({ variable: trendVar, ssp: trendSsp === "obs" ? "ssp245" : trendSsp, year: 1901, playing: false });
  };

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

  const toggleIndicator = (id: string, checked: boolean) => {
    setRasterId(null);
    clearProduct();
    if (id !== indicator.id) update({ ind: id });
    setIndicatorVisible(checked);
  };

  const selectRaster = (id: string) => {
    const next = rasterCatalog.layers.find((item) => item.id === id);
    clearProduct();
    setRasterId(id);
    setIndicatorVisible(false);
    setPeriod(next?.periods[0]?.id ?? "latest");
  };

  const clearIndicatorSelection = () => {
    clearProduct();
    setRasterId(null);
    setIndicatorVisible(false);
    setPeriod("");
    setFireAssessOpen(false);
    setFloodAssessOpen(false);
    setDrawingZone(false);
    setGeeTileLayers([]);
    setDrawnBbox(null);
    mapRef.current?.clearDrawnBbox();
  };

  const clear = () => {
    setDraftExcluded([]);
    setDraftRange(indicator.domain);
    setApplied({ excluded: [], range: indicator.domain });
    setRegion("all");
    setSubdivision("pays");
  };

  const saveView = () => {
    const layerLabel = activeProductIndicator?.label_fr ?? rasterIndicator?.name ?? (indicatorVisible ? indicator.short : "Vue cartographique");
    const placeLabel = selected ? zoneName(selected) : region !== "all" ? regionName(region) : "Afrique";
    const view: SavedView = {
      id: `view-${Date.now()}`,
      name: `${layerLabel} · ${placeLabel}`,
      indicator: indicator.id,
      country: selected,
      rasterId: rasterIndicator?.id ?? null,
      productId: activeProductIndicator?.id ?? null,
      productLayer: activeProductDate?.layer_name ?? null,
      period,
      region,
      subdivision,
      basemap,
      overlays,
      mode3d,
    };
    const next = [view, ...favorites.filter((f) => !(f.name === view.name && f.period === view.period))].slice(0, 8);
    setFavorites(next);
    writeFavorites(next);
  };

  const restoreView = (view: SavedView) => {
    setFireAssessOpen(false);
    setFloodAssessOpen(false);
    setDrawingZone(false);
    setGeeTileLayers([]);
    setRegion(view.region ?? "all");
    setSubdivision(view.subdivision ?? "pays");
    setBasemap(view.basemap ?? "clair");
    setOverlays(view.overlays ?? []);
    setMode3d(view.mode3d ?? false);
    update({ pays: view.country });
    if (view.productId) {
      selectProductIndicator(view.productId, view.productLayer);
    } else if (view.rasterId) {
      clearProduct();
      setRasterId(view.rasterId);
      setIndicatorVisible(false);
      setPeriod(view.period ?? "");
    } else {
      clearProduct();
      setRasterId(null);
      update({ ind: view.indicator, pays: view.country });
      setIndicatorVisible(true);
      setPeriod(view.period ?? "latest");
    }
    if (view.country) {
      const bbox = view.country.includes(".") ? regionZones?.[view.country]?.bbox : COUNTRY_BY_ISO3.get(view.country)?.bbox;
      if (bbox) mapRef.current?.fitBounds(bbox);
    } else {
      mapRef.current?.reset();
    }
    setPanelTab("layers");
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

  const openTab = (id: PanelTab) => {
    if (panelOpen && panelTab === id) setPanelOpen(false);
    else {
      setPanelTab(id);
      setPanelOpen(true);
    }
  };

  const signatureZone = selectedZone ?? africa;
  const visibleRasterLayer = activeProductDate ? {
    layerName: activeProductDate.layer_name,
    style: isChirpsAnnualLayer(activeProductDate.layer_name) ? undefined : activeProductDate.style ?? undefined,
    sldBody: isChirpsAnnualLayer(activeProductDate.layer_name) ? chirpsAnnualSldFor(activeProductDate.layer_name)
      : activeProductIndicator?.id.startsWith("gdo_fcst_") ? gdoSldFor(activeProductDate.layer_name)
      : activeProductIndicator?.id === "wapor_rsm" ? rsmSldFor(activeProductDate.layer_name)
      : activeProductIndicator?.id === "wapor_aeti" ? aetiSldFor(activeProductDate.layer_name)
      : isSpiProduct(activeProductIndicator?.id) ? spiSldFor(activeProductDate.layer_name)
      : activeProductIndicator?.id === "fapar" ? faparSldFor(activeProductDate.layer_name)
      : activeProductIndicator?.id === "fapar_anomaly" ? faparAnomalySldFor(activeProductDate.layer_name)
      : activeProductIndicator?.id.startsWith("tci_") ? tciSldFor(activeProductDate.layer_name)
      : activeProductIndicator?.id.startsWith("vci_") || activeProductIndicator?.id.startsWith("vhi_") ? vegetationHealthSldFor(activeProductDate.layer_name)
      : activeProductIndicator?.id === "fire_density" ? fireSldFor(activeProductDate.layer_name)
      : activeProductIndicator?.id === "population" || activeProductIndicator?.id === "worldpop_population" ? populationSldFor(activeProductDate.layer_name) : undefined,
  } : rasterPeriod ? {
    layerName: rasterPeriod.layerName,
    style: rasterIndicator?.style,
    sldBody: rasterIndicator?.id === "raster-rsm" ? rsmSldFor(rasterPeriod.layerName)
      : rasterIndicator?.id === "raster-aeti" ? aetiSldFor(rasterPeriod.layerName)
      : isSpiRaster(rasterIndicator?.id) ? spiSldFor(rasterPeriod.layerName)
      : rasterIndicator?.id === "raster-fapar" ? faparSldFor(rasterPeriod.layerName)
      : rasterIndicator?.id === "raster-fapar-anomaly" ? faparAnomalySldFor(rasterPeriod.layerName)
      : rasterIndicator?.id === "raster-tci" ? tciSldFor(rasterPeriod.layerName)
      : rasterIndicator?.id === "raster-vci" || rasterIndicator?.id === "raster-vhi" ? vegetationHealthSldFor(rasterPeriod.layerName) : undefined,
  } : null;
  const mapChoroplethVisible = !rasterIndicator && !activeProductDate && (indicatorVisible || Boolean(timelapse));
  const primaryLayerId = geoAiResultLayer
    ? "geoai"
    : activeProductDate
      ? "product"
      : rasterIndicator
        ? "raster"
        : mapChoroplethVisible
          ? "choropleth"
          : null;
  const layerManagerItems = [
    { id: "labels", label: "Noms des localités" },
    ...(primaryLayerId ? [{ id: primaryLayerId, label: geoAiResultLayer?.title ?? activeProductIndicator?.label_fr ?? rasterIndicator?.name ?? indicator.short }] : []),
    ...overlays.map((id) => ({ id: `overlay:${id}`, label: OVERLAYS.find((item) => item.id === id)?.label ?? id })),
    ...geeTileLayers.map((layer) => ({ id: `gee:${layer.id}`, label: layer.label })),
  ];
  const isLayerShown = (id: string) => !hiddenLayerIds.has(id);
  const toggleManagedLayer = (id: string) => setHiddenLayerIds((current) => {
    const next = new Set(current);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    return next;
  });
  const toggleManagedLegend = (id: string) => setExpandedLayerIds((current) => {
    const next = new Set(current);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    return next;
  });
  const visibleOverlays = overlays.filter((id) => isLayerShown(`overlay:${id}`));
  const visibleGeeTileLayers = geeTileLayers.filter((layer) => isLayerShown(`gee:${layer.id}`));
  const primaryLayerShown = primaryLayerId ? isLayerShown(primaryLayerId) : true;
  // Stable geographic reference, including when a source raster is shown.
  const showLocalities = isLayerShown("labels");

  return (
    <div className="gp">

      <div className="gp-workspace">

      {panelOpen && (
        <section className="gp-panel">
          <div className="gp-brandline">
            <img src={ossLogoBlue} alt="OSS" />
            <strong>Climat &amp; Alertes</strong>
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
            {signatureZone && (
              <div className="territory-strip" title={`Bandes de réchauffement ${signatureZone.series.tmean_anom.start}-${signatureZone.series.tmean_anom.start + signatureZone.series.tmean_anom.values.length - 1} · ${territoryLabel}`}>
                <StripeStrip values={signatureZone.series.tmean_anom.values} label={`Bandes de réchauffement · ${territoryLabel}`} />
              </div>
            )}
          </div>

          {panelTab === "layers" && (
            <div className="panel-body layers">
              <div className="panel-scroll">
                <IndicatorCatalog
                  indicator={indicator}
                  indicatorVisible={indicatorVisible}
                  onToggle={toggleIndicator}
                  period={period}
                  periods={periodOptions}
                  onPeriod={(v) => { if (activeProductIndicator) selectProductDate(v); else setPeriod(v); }}
                  rasterLayers={rasterCatalog.layers}
                  rasterIndicator={rasterIndicator}
                  onRaster={selectRaster}
                  productFamilies={productCatalog.families}
                  productIndicator={activeProductIndicator}
                  productLoading={productLoading}
                  onProduct={selectProductIndicator}
                  onClear={clearIndicatorSelection}
                  activeAssessment={activeAssessment}
                  onAssessment={(type) => {
                    setFireAssessOpen(type === "fire");
                    setFloodAssessOpen(type === "flood");
                    setDrawingZone(false);
                    if (!type) { setDrawnBbox(null); mapRef.current?.clearDrawnBbox(); }
                  }}
                />

                {activeAssessment && (
                  <section className="pgroup assess-inline">
                    <div className="pgroup-head"><span>Zone d'étude</span></div>
                    <p className="field-note assess-hint">
                      Cliquez sur « Dessiner », puis <strong>glissez sur la carte</strong>, ou importez une zone GeoJSON/KML.
                    </p>
                    {drawnBbox && (
                      <div className="assess-bbox-display">
                        <span>{drawnBbox[0]}°, {drawnBbox[1]}° — {drawnBbox[2]}°, {drawnBbox[3]}°</span>
                        <button className="btn btn-ghost sm" onClick={() => { setDrawnBbox(null); mapRef.current?.clearDrawnBbox(); }}>
                          <Icon name="close" size={12} />
                        </button>
                      </div>
                    )}
                    {!drawnBbox && selected && (
                      <div className="assess-bbox-display">
                        <span>{countryName(selected)}</span>
                        <small>(bbox du pays)</small>
                      </div>
                    )}
                    {activeAssessment === "fire" ? (
                      <FireAssessmentPanel
                        selectedCountryBbox={drawnBbox ?? (selected ? COUNTRY_BY_ISO3.get(selected)?.bbox ?? null : null)}
                        initialParams={fireInitParams}
                        onStartDraw={() => { setDrawingZone(true); setDrawnBbox(null); mapRef.current?.clearDrawnBbox(); }}
                        onZoneUpload={(bbox, geometry) => { setDrawingZone(false); setDrawnBbox(bbox); mapRef.current?.showGeoJsonGeometry(geometry); }}
                        onSubmit={(p: FireAssessmentParams) => {
                          sessionStorage.setItem("c2-fire-assessment", JSON.stringify(p));
                          window.dispatchEvent(new CustomEvent("c2:fire-assessment", { detail: p }));
                        }}
                        onGeeResult={setGeeTileLayers}
                        onClose={() => { setFireAssessOpen(false); setDrawingZone(false); setFireInitParams(null); setDrawnBbox(null); setGeeTileLayers([]); mapRef.current?.clearDrawnBbox(); }}
                      />
                    ) : (
                      <FloodAssessmentPanel
                        selectedCountryBbox={drawnBbox ?? (selected ? COUNTRY_BY_ISO3.get(selected)?.bbox ?? null : null)}
                        onSubmit={(p: FloodAssessmentParams) => {
                          sessionStorage.setItem("c2-flood-assessment", JSON.stringify(p));
                          window.dispatchEvent(new CustomEvent("c2:flood-assessment", { detail: p }));
                        }}
                        onGeeResult={setGeeTileLayers}
                        onClose={() => { setFloodAssessOpen(false); setDrawingZone(false); setDrawnBbox(null); setGeeTileLayers([]); mapRef.current?.clearDrawnBbox(); }}
                      />
                    )}
                  </section>
                )}

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
                <p className="field-note">Aucune vue enregistrée. Une vue retient la couche, la date, le territoire et l’affichage de la carte dans ce navigateur.</p>
              ) : (
                <ul className="list">
                  {favorites.map((f, index) => (
                    <li key={f.id ?? `${f.name}-${index}`}>
                      <button onClick={() => restoreView(f)}>
                        <strong>{f.name}</strong>
                        <small>{f.period && f.period !== "latest" ? f.period : "Dernière date disponible"}</small>
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
        {mode3d ? (
          <Suspense fallback={<div className="map-status">Chargement du globe 3D…</div>}>
            <CesiumMap basemap={basemap} rasterLayer={primaryLayerShown ? visibleRasterLayer : null} showLocalities={showLocalities} />
          </Suspense>
        ) : (
          <MapCanvas ref={mapRef} level={regionLevel ? "regions" : "countries"} styles={styles} choroplethVisible={primaryLayerShown && mapChoroplethVisible} rasterLayer={primaryLayerShown ? visibleRasterLayer : null} analysisLayer={primaryLayerShown ? geoAiResultLayer?.layerName : undefined} rasterClipIds={vegetationHealthAfricaWide || spiAfricaWide || populationAfricaWide ? undefined : selected ? [selected] : region !== "all" || applied.excluded.length > 0 ? units.filter((unit) => isActive(unit.id)).map((unit) => unit.id) : undefined} geeTileLayers={visibleGeeTileLayers} selected={selected} basemap={basemap} overlays={visibleOverlays} drawBbox={drawBboxActive} alertContext={alertContext} showLocalities={showLocalities} onDrawBbox={(bbox) => { setDrawnBbox(bbox); setDrawingZone(false); }} onSelect={selectCountry} onHover={setHover} />
        )}
        {!bundle && <div className="map-status">{error ? `Indicateurs indisponibles : ${error}` : "Chargement…"}</div>}

        <nav className="map-nav" aria-label="Navigation du géoportail">
          <Link to="/" className="map-nav-home" title="GEOSSIA — retour à l'accueil"><Icon name="home" size={15} /><span>Accueil</span></Link>
          <span className="map-nav-sep" />
          {tabs.map((item) => (
            <button key={item.id} className={panelOpen && panelTab === item.id ? "on" : ""} onClick={() => openTab(item.id)} title={item.label}>
              <Icon name={item.icon} size={15} /><span>{item.label}</span>
            </button>
          ))}
          <span className="map-nav-sep" />
          <button className={trendsOpen ? "on" : ""} onClick={() => (trendsOpen ? setTrendsOpen(false) : openTrends())} title="Tendances climatiques">
            <Icon name="trend" size={15} /><span>Tendances</span>
          </button>
          <button className={timelapse ? "on" : ""} onClick={() => (timelapse ? setTimelapse(null) : openTimelapse())} title="Carte animée">
            <Icon name="history" size={15} /><span>Animée</span>
          </button>
          <button className={compareMode ? "on" : ""} onClick={() => {
            setCompareMode((current) => {
              const next = !current;
              if (next) {
                setTimelapse(null);
                setTool(null);
                setTrendsOpen(false);
              }
              return next;
            });
          }} title="Comparer deux couches">
            <Icon name="compare" size={15} /><span>Comparer</span>
          </button>
          <span className="map-nav-sep" />
          <button className="map-nav-alert" onClick={() => update({ ind: "drought-alert" })} title="Alertes sécheresse">
            <Icon name="bell" size={15} />
            {alertCount > 0 && <span className="badge num">{alertCount}</span>}
          </button>
          <button onClick={() => setTutorialStep(0)} title="Tutoriel pratique" aria-label="Ouvrir le tutoriel pratique"><Icon name="help" size={15} /></button>
        </nav>

        {tutorialStep !== null && (
          <GeoportalTutorial
            step={tutorialStep}
            onStep={setTutorialStep}
            onClose={() => setTutorialStep(null)}
            onOpenIndicators={() => { setPanelTab("layers"); setPanelOpen(true); }}
            onOpenCountries={() => { setPanelTab("search"); setPanelOpen(true); }}
            onOpenViews={() => { setPanelTab("favorites"); setPanelOpen(true); }}
          />
        )}

        <div className="map-top-actions" aria-label="Actions de la carte">
          <div className="map-account">
            {currentUser.authenticated ? (
              <>
                <button
                  type="button"
                  className="map-account-trigger authenticated"
                  title="Afficher les informations du compte"
                  aria-label="Afficher les informations du compte"
                  aria-expanded={accountOpen}
                  onClick={() => setAccountOpen((open) => !open)}
                >
                  {userInitials(currentUser.name, currentUser.email)}
                </button>
                {accountOpen && (
                  <div className="map-account-popover" role="dialog" aria-label="Informations du compte">
                    <div className="map-account-identity">
                      <span>{userInitials(currentUser.name, currentUser.email)}</span>
                      <div>
                        <strong>{currentUser.name || "Utilisateur"}</strong>
                        <small>{currentUser.email || "Adresse e-mail non renseignée"}</small>
                      </div>
                    </div>
                    <div className="map-account-status"><i /> Compte connecté</div>
                  </div>
                )}
              </>
            ) : (
              <Link className="map-account-trigger" to="/login" title="Se connecter" aria-label="Se connecter">
                <Icon name="user" size={20} />
              </Link>
            )}
          </div>
          <button className={mode3d ? "on" : ""} onClick={() => setMode3d((value) => !value)} title={mode3d ? "Revenir à la carte 2D" : "Afficher le globe Cesium 3D"}>
            <span>{mode3d ? "2D" : "3D"}</span>
          </button>
          <button
            className="map-download-icon"
            aria-label="Ouvrir la page des téléchargements"
            title={selected ? `Télécharger les données pour ${countryName(selected.split(".")[0])}` : "Sélectionnez d'abord un pays"}
            disabled={!selected}
            onClick={() => {
              const countryIso3 = selected?.split(".")[0] ?? null;
              const layerName = activeProductDate?.layer_name ?? rasterPeriod?.layerName;
              const bbox = countryIso3
                ? mapRef.current?.featureBounds(countryIso3) ?? COUNTRY_BY_ISO3.get(countryIso3)?.bbox ?? null
                : null;
              if (!layerName || !bbox || !countryIso3) return;
              const periodLabel = activeProductIndicator && activeProductDate
                ? productForecastLabel(activeProductIndicator, activeProductDate)
                : rasterPeriod?.label;
              const layerLabel = activeProductIndicator?.label_fr ?? rasterIndicator?.name ?? "Couche raster";
              addDownload({
                label: `${layerLabel}${periodLabel ? ` · ${periodLabel}` : ""} — ${countryName(countryIso3)}`,
                type: "raster",
                layerName: layerName.includes(":") ? layerName : `geossia:${layerName}`,
                bbox,
                params: { pays: countryName(countryIso3), iso3: countryIso3 },
              });
              navigate("/telecharger");
            }}
          >
            <Icon name="download" size={17} />
          </button>
          <button onClick={shareMapView} title="Partager cette vue cartographique" aria-label="Partager cette vue cartographique">
            <Icon name={shareDone ? "check" : "share"} size={17} />
          </button>
        </div>

        <button className="map-collapse" onClick={() => setPanelOpen((v) => !v)} aria-label={panelOpen ? "Masquer le panneau" : "Afficher le panneau"}>
          <Icon name={panelOpen ? "chevronLeft" : "chevronRight"} size={16} />
        </button>

        {timelapse ? (
          <div className="map-headline">
            <h1>{timelapse.variable.startsWith("spi") ? `${timelapse.variable.toUpperCase().replace("SPI", "SPI-")} moyen annuel` : "Anomalie annuelle de température"} · <span className="num">{timelapse.year}</span></h1>
            <small>{timelapse.variable.startsWith("spi") ? "Carte animée · CHIRPS, référence 1991-2020" : "Carte animée · vs 1961-1990 · CRU TS 4.09 puis CMIP6"}</small>
          </div>
        ) : (
        <div className="map-headline">
          <h1>{activeProductIndicator?.label_fr ?? rasterIndicator?.name ?? indicator.name}</h1>
          {activeProductIndicator ? (
            <small>{activeProductIndicator.unit ? `${activeProductIndicator.unit} · ` : ""}{activeProductDate ? productForecastLabel(activeProductIndicator, activeProductDate) : "chargement…"} · {activeProductIndicator.dates_count} date(s)</small>
          ) : rasterIndicator ? (
            <small>{rasterIndicator.group} · {rasterPeriod?.label ?? "chargement…"} · {rasterIndicator.unit}</small>
          ) : africa && (
            <small>
              {THEMES.find((t) => t.id === indicator.theme)?.label} · Afrique : <span className="num">{formatValue(indicator, indicatorValueAt(indicator, africa, period))}</span>
              {period !== "latest" ? ` · ${periodOptions.find((item) => item.value === period)?.label ?? period}` : indicator.theme === "alertes" ? ` · ${monthLabel(africa.alerts.spi_month)}` : indicator.theme === "climat" && indicator.unit === "°C" ? ` · ${africa.climate.year}` : ""}
            </small>
          )}
        </div>
        )}

        {hover && bundle && !rasterIndicator && (
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

        {selected && selected !== dismissedCountryCard && selectedZone && !rasterIndicator && !trendsOpen && <CountryCard title={zoneName(selected)} subtitle={zoneSub(selected)} zone={selectedZone} onClose={() => setDismissedCountryCard(selected)} onTrends={openTrends} />}

        {geoAiAnalysis && !trendsOpen && <GeoAiAnalysisCard analysis={geoAiAnalysis} onClose={() => setGeoAiAnalysis(null)} />}

        {!compareMode && tool === "legend" && !trendsOpen && !timelapse && (
          <aside className="map-card legend-card layer-manager" aria-label="Gestionnaire des couches actives">
            <div className="layer-manager__head">
              <strong>Légende</strong>
              <span className="layer-manager__count">{layerManagerItems.length}</span>
              <button type="button" onClick={() => setTool(null)} aria-label="Fermer la légende">×</button>
            </div>
            {layerManagerItems.length === 0 && <p className="legend-empty">Aucune couche active</p>}
            {layerManagerItems.map((item) => {
              const shown = isLayerShown(item.id);
              const expanded = expandedLayerIds.has(item.id);
              const overlayId = item.id.startsWith("overlay:") ? item.id.slice(8) : null;
              return (
                <section className={`layer-manager__item${shown ? "" : " is-hidden"}`} key={item.id}>
                  <div className="layer-manager__row">
                    <button type="button" className="layer-manager__eye" onClick={() => toggleManagedLayer(item.id)} aria-label={shown ? "Masquer la couche" : "Afficher la couche"} aria-pressed={shown}>
                      <Icon name={shown ? "eye" : "eyeOff"} size={15} />
                    </button>
                    <button type="button" className="layer-manager__toggle" onClick={() => toggleManagedLegend(item.id)} aria-expanded={expanded}>
                      <span>{item.label}</span><b aria-hidden="true">{expanded ? "−" : "+"}</b>
                    </button>
                    {(overlayId || item.id.startsWith("gee:") || item.id === "geoai") && (
                      <button type="button" className="layer-manager__remove" onClick={() => {
                        if (overlayId) setOverlays((current) => current.filter((id) => id !== overlayId));
                        else if (item.id.startsWith("gee:")) setGeeTileLayers((current) => current.filter((layer) => `gee:${layer.id}` !== item.id));
                        else setGeoAiResultLayer(null);
                      }} aria-label="Retirer la couche">×</button>
                    )}
                  </div>
                  {expanded && (
                    <div className="layer-manager__legend">
                      {item.id === "geoai" && geoAiResultLayer && <><div className="legend-period">{geoAiResultLayer.territory ? `Territoire analysé : ${geoAiResultLayer.territory}` : "Résultat spatial GeoAI"}</div><img className="raster-legend" src={analysisLegendUrl(geoAiResultLayer.layerName)} alt="Légende GeoAI" /></>}
                      {item.id === "product" && activeProductDate && <><div className="legend-period">{activeProductIndicator ? productForecastLabel(activeProductIndicator, activeProductDate) : activeProductDate.period_label}</div><DatabaseLegend legend={productLegend} fallbackUrl={productLegendUrl(activeProductDate)} title={activeProductIndicator?.label_fr ?? ""} indicatorId={activeProductIndicator?.id} /></>}
                      {item.id === "raster" && rasterIndicator && <><div className="legend-period">{rasterIndicator.description}</div><DatabaseLegend legend={rasterDbLegend} fallbackUrl={rasterLegendUrl(rasterIndicator, rasterPeriod)} title={rasterIndicator.name} indicatorId={rasterIndicator.datasetId} /></>}
                      {item.id === "choropleth" && <><ul className="legend">{legendFor(indicator).map((entry) => <li key={entry.label}><i style={{ background: entry.color }} /><LegendLabel>{entry.label}</LegendLabel></li>)}<li><i style={{ background: NO_DATA }} /><LegendLabel>Pas de donnée</LegendLabel></li></ul><p className="legend-note">{indicator.howToRead}</p></>}
                      {overlayId === "firms" && <><ul className="legend legend--classes"><li><i style={{ background: "#f4511e" }} /><LegendLabel>Détection active VIIRS ou MODIS</LegendLabel></li></ul><div className="legend-footer">Source : NASA FIRMS · 3 derniers jours</div></>}
                      {overlayId && overlayId !== "firms" && <p className="legend-note">{OVERLAYS.find((entry) => entry.id === overlayId)?.description}</p>}
                      {item.id.startsWith("gee:") && <p className="legend-note">Couche de résultat calculée à la demande.</p>}
                      {item.id === "labels" && <p className="legend-note">Villes et localités de référence du fond cartographique.</p>}
                    </div>
                  )}
                </section>
              );
            })}
          </aside>
        )}

        {trendsOpen && (
          <TrendsDrawer code={selected ?? "AFR"} title={selected ? `${zoneName(selected)}${selected.includes(".") ? ` · ${countryName(selected.split(".")[0])}` : ""}` : "Afrique"} variable={trendVar} ssp={trendSsp} onVariable={setTrendVar} onSsp={setTrendSsp} onClose={() => setTrendsOpen(false)} />
        )}

        {!compareMode && timelapse && (
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

        {!compareMode && tool === "basemap" && (
          <div className="map-card tool-card">
            <div className="map-card-head"><strong>Fond de carte</strong></div>
            {(Object.keys(BASEMAPS) as BasemapId[]).map((id) => (
              <button key={id} className={basemap === id ? "tool-option on" : "tool-option"} onClick={() => setBasemap(id)}>
                <span
                  className={`basemap-thumb ${id}`}
                  style={{ backgroundImage: `url(${BASEMAPS[id].tiles[0].replace("{z}", "2").replace("{x}", "2").replace("{y}", "2")})` }}
                />
                <span className="basemap-label">{BASEMAPS[id].label}</span>
              </button>
            ))}
          </div>
        )}

        {compareMode && (
          <ComparePanel basemap={basemap} productFamilies={productCatalog.families} onExit={() => setCompareMode(false)} />
        )}

        {!compareMode && <div className="map-toolbar">
          <div className="toolbar-group">
            <button className={tool === "legend" ? "on" : ""} onClick={() => setTool(tool === "legend" ? null : "legend")} title="Légende" aria-label="Légende"><Icon name="list" size={16} /></button>
            <button onClick={() => { mapRef.current?.reset(); update({ pays: null }); }} title="Vue d'ensemble" aria-label="Vue d'ensemble"><Icon name="globe" size={16} /></button>
            <button className={tool === "basemap" ? "on" : ""} onClick={() => setTool(tool === "basemap" ? null : "basemap")} title="Fond de carte" aria-label="Fond de carte"><Icon name="palette" size={16} /></button>
          </div>
          <div className="toolbar-group">
            <button onClick={() => mapRef.current?.zoomOut()} aria-label="Dézoomer"><Icon name="minus" size={16} /></button>
            <button onClick={() => mapRef.current?.zoomIn()} aria-label="Zoomer"><Icon name="plus" size={16} /></button>
          </div>
        </div>}
      </section>
      </div>
    </div>
  );
}

interface PeriodOption { value: string; label: string }

function PeriodSelectOptions({ periods, groupByYear }: { periods: PeriodOption[]; groupByYear: boolean }) {
  if (!groupByYear) return periods.map((item) => <option key={item.value} value={item.value}>{item.label}</option>);

  const years = new globalThis.Map<string, PeriodOption[]>();
  const ungrouped: PeriodOption[] = [];
  periods.forEach((item) => {
    const matches = item.label.match(/(?:19|20)\d{2}/g);
    const year = matches?.[matches.length - 1];
    if (!year) {
      ungrouped.push(item);
      return;
    }
    const entries = years.get(year) ?? [];
    entries.push(item);
    years.set(year, entries);
  });

  return (
    <>
      {ungrouped.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
      {Array.from(years.entries()).map(([year, entries]) => (
        <optgroup key={year} label={year}>
          {entries.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
        </optgroup>
      ))}
    </>
  );
}

function productForecastLabel(indicator: ProductIndicator, date: ProductDate): string {
  // Historical annual CHIRPS rows have neither reference_time nor a useful
  // period_label. Never expose the internal GeoServer hash to users.
  const annualLayer = date.layer_name.match(/chirps[_-]annual[_-]((?:19|20)\d{2})(?:_|$)/i);
  if (annualLayer) return annualLayer[1];
  if (indicator.id.startsWith("cmip6_tas_")) {
    const horizon = date.layer_name.match(/(20\d{2})_(20\d{2})/);
    if (horizon) return `${horizon[1]}–${horizon[2]}`;
    const year = date.reference_time?.slice(0, 4);
    if (year) return `${year}–${Number(year) + 19}`;
  }
  if (date.period_start && date.period_end && date.forecast_horizon_days) {
    const issued = new Date(date.period_start);
    const valid = new Date(date.period_end);
    if (Number.isFinite(issued.getTime()) && Number.isFinite(valid.getTime())) {
      const fmt = (value: Date) => new Intl.DateTimeFormat("fr-FR", {
        day: "2-digit", month: "2-digit", year: "numeric", timeZone: "UTC",
      }).format(value);
      return `Du ${fmt(issued)} au ${fmt(valid)} · échéance J+${date.forecast_horizon_days}`;
    }
  }
  const spiMatch = /^spi[_-](\d+)$/.exec(indicator.id);
  if (spiMatch && date.reference_time) {
    const window = Number(spiMatch[1]);
    const end = new Date(date.reference_time);
    if (Number.isFinite(end.getTime())) {
      const fmtMonth = (d: Date) => new Intl.DateTimeFormat("fr-FR", { month: "short", year: "numeric", timeZone: "UTC" }).format(d);
      if (window <= 1) return fmtMonth(end);
      const start = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth() - window + 1, 1));
      return `${fmtMonth(start)} – ${fmtMonth(end)}`;
    }
  }
  const rainForecast = /^rain_fcst_(5|10|15)d$/.exec(indicator.id);
  if (rainForecast && date.reference_time) {
    const start = new Date(date.reference_time);
    if (Number.isFinite(start.getTime())) {
      const days = Number(rainForecast[1]);
      const end = new Date(start);
      end.setUTCDate(end.getUTCDate() + days - 1);
      const format = (value: Date) => new Intl.DateTimeFormat("fr-FR", {
        day: "2-digit", month: "2-digit", year: "numeric", timeZone: "UTC",
      }).format(value);
      return `Prévision du ${format(start)} au ${format(end)}`;
    }
  }
  // Older CHIRPS catalogue rows predate period_label/reference_time. Their
  // technical GeoServer name still contains the canonical YYYY_MM period;
  // never expose that internal layer identifier in the date selector.
  const gdoMatch = /^gdo_fcst_(1|3|6)m$/.exec(indicator.id);
  if (gdoMatch && date.reference_time) {
    const months = Number(gdoMatch[1]);
    const start = new Date(date.reference_time);
    if (Number.isFinite(start.getTime())) {
      const first = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), 1));
      const last = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + months, 0));
      const fmt = (v: Date) => new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "UTC" }).format(v);
      return `${fmt(first)} – ${fmt(last)}`;
    }
    return date.period_label || date.layer_name;
  }
  if (indicator.temporal_step === "week" && date.reference_time) {
    const end = new Date(date.reference_time);
    if (Number.isFinite(end.getTime())) {
      const start = new Date(end);
      start.setUTCDate(start.getUTCDate() - 6);
      const fmt = (d: Date) => new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "short", timeZone: "UTC" }).format(d);
      return `Semaine du ${fmt(start)} au ${fmt(end)} ${end.getUTCFullYear()}`;
    }
  }
  if (indicator.temporal_step === "dekad" && date.reference_time) {
    const d = new Date(date.reference_time);
    if (Number.isFinite(d.getTime())) {
      const day = d.getUTCDate();
      const dekad = day <= 10 ? 1 : day <= 20 ? 2 : 3;
      const fmtM = new Intl.DateTimeFormat("fr-FR", { month: "long", year: "numeric", timeZone: "UTC" }).format(d);
      return `${dekad}${dekad === 1 ? "re" : "e"} décade · ${fmtM}`;
    }
  }
  if (indicator.temporal_step === "16day" && date.reference_time) {
    const start = new Date(date.reference_time);
    if (Number.isFinite(start.getTime())) {
      const end = new Date(start);
      end.setUTCDate(end.getUTCDate() + 15);
      const fmt = (d: Date) => new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "short", timeZone: "UTC" }).format(d);
      return `${fmt(start)} – ${fmt(end)} ${start.getUTCFullYear()}`;
    }
  }
  if (indicator.temporal_step === "month") {
    const parts = date.layer_name.match(/(?:^|_)((?:19|20)\d{2})_(0[1-9]|1[0-2])(?:_|$)/);
    if (parts) return `${parts[2]}/${parts[1]}`;
    if (date.reference_time) {
      const instant = new Date(date.reference_time);
      if (Number.isFinite(instant.getTime())) return new Intl.DateTimeFormat("fr-FR", {
        month: "2-digit", year: "numeric", timeZone: "UTC",
      }).format(instant);
    }
  }
  if (indicator.temporal_step === "year") {
    const year = date.reference_time?.slice(0, 4) ?? date.layer_name.match(/(?:19|20)\d{2}/)?.[0];
    if (year) return year;
  }
  return date.period_label || date.reference_time?.slice(0, 10) || date.layer_name;
}

const LEGEND_WMS = ((import.meta.env.VITE_GEOSERVER_WMS_URL as string | undefined) ?? "/geoserver/geossia/wms").replace(/\/$/, "");
function analysisLegendUrl(layerName: string): string {
  const params = new URLSearchParams({ SERVICE: "WMS", VERSION: "1.1.1", REQUEST: "GetLegendGraphic", FORMAT: "image/png", LAYER: layerName.includes(":") ? layerName : `geossia:${layerName}`, TRANSPARENT: "true" });
  return `${LEGEND_WMS}?${params.toString()}`;
}
function rasterLegendUrl(layer: RasterClimateLayer, period: { layerName: string } | null): string | null {
  if (!period) return null;
  const params = new URLSearchParams({ SERVICE: "WMS", VERSION: "1.1.1", REQUEST: "GetLegendGraphic", FORMAT: "image/png", LAYER: period.layerName.includes(":") ? period.layerName : `geossia:${period.layerName}`, TRANSPARENT: "true" });
  if (layer.style) params.set("STYLE", layer.style);
  return `${LEGEND_WMS}?${params.toString()}`;
}

function productLegendUrl(date: ProductDate): string | null {
  if (!date.layer_name) return null;
  const params = new URLSearchParams({ SERVICE: "WMS", VERSION: "1.1.1", REQUEST: "GetLegendGraphic", FORMAT: "image/png", LAYER: date.layer_name.includes(":") ? date.layer_name : `geossia:${date.layer_name}`, TRANSPARENT: "true" });
  if (date.style) params.set("STYLE", date.style);
  return `${LEGEND_WMS}?${params.toString()}`;
}

function IndicatorCatalog({ indicator, indicatorVisible, onToggle, period, periods, onPeriod, rasterLayers, rasterIndicator, onRaster, productFamilies, productIndicator, productLoading, onProduct, onClear, activeAssessment, onAssessment }: { indicator: typeof INDICATORS[0]; indicatorVisible: boolean; onToggle: (id: string, checked: boolean) => void; period: string; periods: PeriodOption[]; onPeriod: (value: string) => void; rasterLayers: RasterClimateLayer[]; rasterIndicator: RasterClimateLayer | null; onRaster: (id: string) => void; productFamilies: ProductFamily[]; productIndicator: ProductIndicator | null; productLoading: boolean; onProduct: (id: string) => void; onClear: () => void; activeAssessment: "fire" | "flood" | null; onAssessment: (type: "fire" | "flood" | null) => void }) {
  const productCount = productFamilies.reduce((n, f) => n + f.indicators.length, 0);
  const totalCount = VISIBLE_INDICATOR_FAMILIES.reduce((count, family) => count + family.indicators.length, 0) + productCount;

  const currentValue = activeAssessment ? `assess:${activeAssessment}` : productIndicator ? `product:${productIndicator.id}` : rasterIndicator?.id ?? (indicatorVisible ? indicator.id : "");

  const handleChange = (value: string) => {
    if (!value) {
      onClear();
      return;
    }
    if (value.startsWith("assess:")) {
      onAssessment(value.slice(7) as "fire" | "flood");
      return;
    }
    onAssessment(null);
    if (value.startsWith("product:")) onProduct(value.slice(8));
    else if (value.startsWith("raster-")) onRaster(value);
    else onToggle(value, true);
  };

  return (
    <>
      <div className="catalog-head">
        <span className="catalog-title">Catalogue des indicateurs</span>
        <small className="catalog-count">{totalCount} variables</small>
      </div>
      <div className="catalog-selects">
        <label>
          <span><Icon name="layers" size={14} /> Indicateur</span>
          <select value={currentValue} onChange={(event) => handleChange(event.target.value)}>
            <option value="">Aucun indicateur</option>
            {VISIBLE_INDICATOR_FAMILIES.map((family) => (
              <optgroup key={family.id} label={`${family.label} · ${family.indicators.length}`}>
                {family.indicators.map((id) => INDICATOR_BY_ID.get(id)).filter(Boolean).map((ind) => (
                  <option key={ind!.id} value={ind!.id}>{ind!.name}</option>
                ))}
              </optgroup>
            ))}
            {productFamilies.map((family) => (
              <optgroup key={`pf-${family.id}`} label={`${family.label_fr} · ${family.indicators.length}`}>
                {family.indicators.map((ind) => (
                  <option key={ind.id} value={`product:${ind.id}`} disabled={!ind.dates_count}>
                    {ind.label_fr}{ind.dates_count ? "" : " — à venir"}
                  </option>
                ))}
              </optgroup>
            ))}
            {(() => {
              const covered = productFamilies.length > 0 ? new Set(["raster-chirps-dekad", "raster-chirps-monthly", "raster-gefs-5d", "raster-gefs-10d", "raster-gefs-15d", "raster-spi1", "raster-spi3", "raster-spi12", "raster-spi-forecast-5d", "raster-spi-forecast-10d", "raster-spi-forecast-15d", "raster-fapar", "raster-fapar-anomaly", "raster-aeti", "raster-rsm", "raster-vhi", "raster-vci", "raster-tci", "raster-edgar-ghg", "raster-edgar-co2", "raster-edgar-ch4", "raster-edgar-n2o", "raster-gfed-co2"]) : new Set<string>();
              return ["Émissions", "Sécheresse agricole"].map((group) => {
                const entries = rasterLayers.filter((item) => item.group === group && !covered.has(item.id));
                return entries.length ? <optgroup key={group} label={`${group} · ${entries.length}`}>{entries.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</optgroup> : null;
              });
            })()}
            <optgroup label="Évaluations terrain · 2">
              <option value="assess:fire">Évaluation post-feu (dNBR)</option>
              <option value="assess:flood">Évaluation d'inondation</option>
            </optgroup>
          </select>
        </label>
        <label>
          <span><Icon name="calendar" size={14} /> Date</span>
          <select value={period} onChange={(event) => onPeriod(event.target.value)} disabled={!currentValue || periods.length === 0 || productLoading}>
            {!period && <option value="">Aucune date</option>}
            {productLoading && <option value="">Chargement…</option>}
            <PeriodSelectOptions periods={periods} groupByYear={productIndicator?.temporal_step === "month"} />
          </select>
        </label>
      </div>
      {activeAssessment ? (
        <div className="cat-selected-info assess-info">
          <strong>{activeAssessment === "fire" ? "Évaluation post-feu (dNBR)" : "Évaluation d'inondation"}</strong>
          <p>{activeAssessment === "fire" ? "Calcul de sévérité de brûlage par différence d'indice NBR pré/post-feu." : "Détection de zones inondées par comparaison d'images avant/pendant."}</p>
          <small className="assess-draw-hint-inline">Dessinez la zone sur la carte ou importez un GeoJSON/KML</small>
        </div>
      ) : productIndicator ? (
        <div className="cat-selected-info">
          <strong>{productIndicator.label_fr}</strong>
          <p>{productIndicator.unit ? `Unité : ${productIndicator.unit}` : ""}{productIndicator.temporal_step ? ` · Pas de temps : ${productIndicator.temporal_step}` : ""}</p>
          <small>Catalogue produits · {productIndicator.dates_count} date(s) publiée(s)</small>
        </div>
      ) : rasterIndicator ? (
        <div className="cat-selected-info">
          <strong>{rasterIndicator.name}</strong>
          <p>{rasterIndicator.description}</p>
          <small>{rasterIndicator.source} · {rasterIndicator.periods.length} période(s)</small>
        </div>
      ) : indicatorVisible && indicator && (
        <div className="cat-selected-info">
          <strong>{indicator.short}</strong>
          <p>{indicator.description}</p>
          <small>{indicator.source} · {indicator.frequency}</small>
        </div>
      )}
    </>
  );
}

function availablePeriods(indicatorId: string, zone?: ZoneData): PeriodOption[] {
  if (!zone) return [{ value: "latest", label: "Dernière date disponible" }];
  if (indicatorId === "tmean-anom") {
    return [{ value: "latest", label: `${zone.climate.year} (dernière donnée)` }, ...zone.series.tmean_anom.values.slice(0, -1).map((_, index) => ({ value: `year:${zone.series.tmean_anom.start + index}`, label: String(zone.series.tmean_anom.start + index) })).reverse()];
  }
  if (["spi1", "spi3", "spi12", "drought-alert"].includes(indicatorId)) {
    const key = indicatorId === "drought-alert" ? "spi3" : indicatorId as "spi1" | "spi3" | "spi12";
    const series = zone.series.spi_recent?.[key] ?? (key === "spi3" ? zone.series.spi3_recent : null);
    if (!series?.end) return [{ value: "latest", label: "Dernière période disponible" }];
    const end = new Date(`${series.end}-01T00:00:00Z`);
    const history = series.values.slice(0, -1).map((_, index) => {
      const monthsBack = series.values.length - 1 - index;
      const date = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth() - monthsBack, 1));
      const key = `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
      return { value: `month:${key}`, label: monthLabel(key) };
    }).filter((item) => item.value >= "month:2025-01").reverse();
    return [{ value: "latest", label: `${monthLabel(zone.alerts.spi_month)} (dernière donnée)` }, ...history];
  }
  return [{ value: "latest", label: indicatorId === "spi1" ? `${monthLabel(zone.alerts.spi_month)} (dernière donnée)` : "Dernière période disponible" }];
}

function indicatorValueAt(indicator: typeof INDICATORS[0], zone: ZoneData, period: string): number | null {
  if (period.startsWith("year:") && indicator.id === "tmean-anom") {
    return zone.series.tmean_anom.values[Number(period.slice(5)) - zone.series.tmean_anom.start] ?? null;
  }
  if (period.startsWith("month:") && ["spi1", "spi3", "spi12", "drought-alert"].includes(indicator.id)) {
    const key = indicator.id === "drought-alert" ? "spi3" : indicator.id as "spi1" | "spi3" | "spi12";
    const series = zone.series.spi_recent?.[key] ?? (key === "spi3" ? zone.series.spi3_recent : null);
    if (!series?.end) return null;
    const wanted = new Date(`${period.slice(6)}-01T00:00:00Z`);
    const end = new Date(`${series.end}-01T00:00:00Z`);
    const offset = (end.getUTCFullYear() - wanted.getUTCFullYear()) * 12 + end.getUTCMonth() - wanted.getUTCMonth();
    const spi = series.values[series.values.length - 1 - offset] ?? null;
    if (spi === null || indicator.id !== "drought-alert") return spi;
    return spi <= -1.5 ? 3 : spi <= -1 ? 2 : spi <= -0.5 ? 1 : 0;
  }
  return indicator.value(zone);
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
