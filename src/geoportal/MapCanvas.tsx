// OpenLayers map of the géoportail in Equal Earth projection (EPSG:8857):
// country choropleth, WMS rasters from GeoServer, and Esri basemaps.

import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import OlMap from "ol/Map";
import View from "ol/View";
import TileLayer from "ol/layer/Tile";
import ImageLayer from "ol/layer/Image";
import VectorLayer from "ol/layer/Vector";
import VectorSource from "ol/source/Vector";
import XYZ from "ol/source/XYZ";
import ImageWMS from "ol/source/ImageWMS";
import OlGeoJSON from "ol/format/GeoJSON";
import { Style, Fill, Stroke } from "ol/style";
import { get as getProjection, transformExtent, transform } from "ol/proj";
import { register } from "ol/proj/proj4";
import { createXYZ } from "ol/tilegrid";
import { defaults as defaultControls } from "ol/control";
import { DragBox } from "ol/interaction";
import { always } from "ol/events/condition";
import proj4 from "proj4";
import type Feature from "ol/Feature";
import type { Geometry } from "ol/geom";
import "ol/ol.css";

proj4.defs("EPSG:8857", "+proj=eqearth +lon_0=0 +x_0=0 +y_0=0 +datum=WGS84 +units=m +no_defs +type=crs");
for (const alias of ["urn:ogc:def:crs:OGC:1.3:CRS84", "CRS:84"]) {
  proj4.defs(alias, proj4.defs("EPSG:4326"));
}
register(proj4);
const EQUAL_EARTH = getProjection("EPSG:8857")!;
const EE_EXTENT: [number, number, number, number] = [-17243959.06, -8392927.6, 17243959.06, 8392927.6];
EQUAL_EARTH.setExtent(EE_EXTENT);
EQUAL_EARTH.setWorldExtent([-180, -90, 180, 90]);
const MERCATOR = getProjection("EPSG:3857")!;
const TILE_GRID = createXYZ({ extent: MERCATOR.getExtent()!, tileSize: 256, maxZoom: 18 });

export type BasemapId = "neutre" | "clair" | "sombre" | "satellite";

const ESRI = "https://server.arcgisonline.com/ArcGIS/rest/services";

export const BASEMAPS: Record<BasemapId, { label: string; tiles: string[]; labels: string[]; attribution: string }> = {
  neutre: {
    label: "Relief naturel · sans frontières",
    tiles: [`${ESRI}/World_Shaded_Relief/MapServer/tile/{z}/{y}/{x}`],
    labels: [],
    attribution: "Esri · USGS · CGIAR · GEBCO",
  },
  clair: {
    label: "Clair",
    tiles: [`${ESRI}/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}`],
    labels: [`${ESRI}/Canvas/World_Light_Gray_Reference/MapServer/tile/{z}/{y}/{x}`],
    attribution: "Esri, HERE, Garmin, © OpenStreetMap",
  },
  sombre: {
    label: "Sombre",
    tiles: [`${ESRI}/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}`],
    labels: [`${ESRI}/Canvas/World_Dark_Gray_Reference/MapServer/tile/{z}/{y}/{x}`],
    attribution: "Esri, HERE, Garmin, © OpenStreetMap",
  },
  satellite: {
    label: "Satellite",
    tiles: [`${ESRI}/World_Imagery/MapServer/tile/{z}/{y}/{x}`],
    labels: [`${ESRI}/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}`],
    attribution: "Esri · Maxar · Earthstar Geographics",
  },
};

export interface Overlay {
  id: string;
  label: string;
  description: string;
  layerName?: string;
  cqlFilter?: () => string;
}

export const OVERLAYS: Overlay[] = [
  {
    id: "firms",
    label: "Feux actifs FIRMS (3 jours)",
    description: "Détections VIIRS/MODIS, GeoServer GEOSSIA",
    layerName: "geossia:active_fire_point",
    cqlFilter: () => {
      const since = new Date(Date.now() - 3 * 86400000).toISOString().slice(0, 10);
      return `acq_date >= '${since}'`;
    },
  },
  {
    id: "flood_gauges",
    label: "Jauges d'inondation (Google Flood)",
    description: "Statut des jauges virtuelles Google Flood Forecasting",
    layerName: "geossia:flood_gauge_status",
  },
  {
    id: "flash_floods",
    label: "Crues éclair (Google Flood)",
    description: "Événements de crues éclair détectés par Google",
    layerName: "geossia:flash_flood_event",
  },
];

const WMS_URL = ((import.meta.env.VITE_GEOSERVER_WMS_URL as string | undefined) ?? "/geoserver/geossia/wms").replace(/\/$/, "");
const RASTER_CACHE_VERSION = "20261112-spi-africa-gaul2024-v1";

function ringSignedArea(ring: number[][]): number {
  let area = 0;
  for (let i = 0; i < ring.length - 1; i++) {
    area += ring[i][0] * ring[i + 1][1] - ring[i + 1][0] * ring[i][1];
  }
  return area / 2;
}

function asMaskHole(ring: number[][]): number[][] {
  return ringSignedArea(ring) > 0 ? [...ring].reverse() : ring;
}

function hexToRgba(color: string, alpha: number): string {
  if (color.startsWith("rgb(")) {
    return color.replace("rgb(", "rgba(").replace(")", `,${alpha})`);
  }
  const r = parseInt(color.slice(1, 3), 16);
  const g = parseInt(color.slice(3, 5), 16);
  const b = parseInt(color.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

export interface FeatureStyle {
  fill: string;
  active: boolean;
}

export interface GeeTileEntry {
  id: string;
  label: string;
  tileUrl: string;
}

export interface MapCanvasHandle {
  zoomIn(): void;
  zoomOut(): void;
  fitBounds(bbox: [number, number, number, number]): void;
  featureBounds(id: string): [number, number, number, number] | null;
  reset(): void;
  clearDrawnBbox(): void;
  showGeoJsonGeometry(geometry: Record<string, unknown>): void;
}

export type MapLevel = "countries" | "regions";

const LEVEL_DATA: Record<MapLevel, { url: string; idField: string }> = {
  countries: { url: "/data/countries.geojson", idField: "iso3" },
  regions: { url: "/data/regions.geojson", idField: "code" },
};

interface Props {
  level: MapLevel;
  styles: Record<string, FeatureStyle>;
  choroplethVisible: boolean;
  selected: string | null;
  basemap: BasemapId;
  overlays: string[];
  rasterLayer?: { layerName: string; style?: string; sldBody?: string } | null;
  rasterClipIds?: string[];
  geeTileLayers?: GeeTileEntry[];
  drawBbox?: boolean;
  onDrawBbox?(bbox: [number, number, number, number]): void;
  onSelect(iso3: string | null): void;
  onHover(info: { iso3: string; x: number; y: number } | null): void;
}

const AFRICA_BOUNDS: [number, number, number, number] = [-20, -36, 54, 38];

export const MapCanvas = forwardRef<MapCanvasHandle, Props>(function MapCanvas({ level, styles, choroplethVisible, selected, basemap, overlays, rasterLayer, rasterClipIds, geeTileLayers, drawBbox, onDrawBbox, onSelect, onHover }, ref) {
  const container = useRef<HTMLDivElement>(null);
  const mapRef = useRef<OlMap | null>(null);
  const vectorSource = useRef(new VectorSource<Feature<Geometry>>());
  const geojsonData = useRef<GeoJSON.FeatureCollection | null>(null);
  const basemapRef = useRef<TileLayer<XYZ> | null>(null);
  const labelRef = useRef<TileLayer<XYZ> | null>(null);
  const choroplethRef = useRef<VectorLayer<VectorSource<Feature<Geometry>>> | null>(null);
  const selectionRef = useRef<VectorLayer<VectorSource<Feature<Geometry>>> | null>(null);
  const rasterLayersRef = useRef<ImageLayer<ImageWMS>[]>([]);
  const maskRef = useRef<VectorLayer<VectorSource<Feature<Geometry>>> | null>(null);
  const overlayLayersRef = useRef<Map<string, ImageLayer<ImageWMS> | VectorLayer<VectorSource<Feature<Geometry>>>>>(new Map());
  const hoveredRef = useRef<Feature<Geometry> | null>(null);
  const dragBoxRef = useRef<DragBox | null>(null);
  const bboxSourceRef = useRef(new VectorSource<Feature<Geometry>>());
  const bboxLayerRef = useRef<VectorLayer<VectorSource<Feature<Geometry>>> | null>(null);
  const geeTileLayersRef = useRef<Map<string, TileLayer<XYZ>>>(new Map());
  const [ready, setReady] = useState(false);
  const [loadedLevel, setLoadedLevel] = useState<MapLevel | null>(null);
  const handlers = useRef({ onSelect, onHover, onDrawBbox });
  handlers.current = { onSelect, onHover, onDrawBbox };

  const wmsBase = WMS_URL.startsWith("http") ? WMS_URL : `${window.location.origin}${WMS_URL}`;

  useImperativeHandle(ref, () => ({
    zoomIn: () => mapRef.current?.getView().animate({ zoom: (mapRef.current.getView().getZoom() ?? 3) + 1, duration: 300 }),
    zoomOut: () => mapRef.current?.getView().animate({ zoom: (mapRef.current.getView().getZoom() ?? 3) - 1, duration: 300 }),
    fitBounds: (bbox) => mapRef.current?.getView().fit(transformExtent(bbox, "EPSG:4326", "EPSG:8857"), { padding: [90, 340, 60, 60], duration: 900, maxZoom: 6 }),
    featureBounds: (id) => {
      const feature = vectorSource.current.getFeatures().find((item) => item.get("id") === id);
      const extent = feature?.getGeometry()?.getExtent();
      return extent ? transformExtent(extent, "EPSG:8857", "EPSG:4326") as [number, number, number, number] : null;
    },
    reset: () => mapRef.current?.getView().fit(transformExtent(AFRICA_BOUNDS, "EPSG:4326", "EPSG:8857"), { padding: [40, 40, 40, 40], duration: 900 }),
    clearDrawnBbox: () => bboxSourceRef.current.clear(),
    showGeoJsonGeometry: (geometry) => {
      const map = mapRef.current;
      if (!map) return;
      const parsed = new OlGeoJSON().readFeature(
        { type: "Feature", geometry, properties: {} },
        { dataProjection: "EPSG:4326", featureProjection: map.getView().getProjection() },
      );
      const feature = (Array.isArray(parsed) ? parsed[0] : parsed) as Feature<Geometry> | undefined;
      if (!feature) return;
      const featureGeometry = feature.getGeometry();
      if (!featureGeometry) return;
      bboxSourceRef.current.clear();
      bboxSourceRef.current.addFeature(feature);
      map.getView().fit(featureGeometry.getExtent(), { padding: [90, 340, 60, 60], duration: 700, maxZoom: 9 });
    },
  }));

  // Map creation (once)
  useEffect(() => {
    if (!container.current) return;
    const basemapLayer = new TileLayer({
      source: new XYZ({ url: BASEMAPS["clair"].tiles[0], projection: "EPSG:3857", tileGrid: TILE_GRID, attributions: BASEMAPS["clair"].attribution }),
      zIndex: 0,
    });
    basemapRef.current = basemapLayer;

    const labelLayer = new TileLayer({
      source: new XYZ({ url: BASEMAPS["clair"].labels[0], projection: "EPSG:3857", tileGrid: TILE_GRID }),
      zIndex: 100,
    });
    labelRef.current = labelLayer;

    const choropleth = new VectorLayer({
      source: vectorSource.current,
      style: (feature) => {
        const fill = (feature as Feature<Geometry>).get("fill") || "#6b7076";
        const active = (feature as Feature<Geometry>).get("active") !== false;
        const hovered = (feature as Feature<Geometry>).get("hovered") === true;
        const opacity = active ? (hovered ? 0.95 : 0.78) : 0.18;
        return new Style({ fill: new Fill({ color: hexToRgba(fill, opacity) }) });
      },
      zIndex: 2,
    });
    choroplethRef.current = choropleth;

    const selection = new VectorLayer({
      source: vectorSource.current,
      style: (feature) => {
        if ((feature as Feature<Geometry>).get("id") !== "__SELECTED__") return undefined as unknown as Style;
        return new Style({
          stroke: new Stroke({ color: "#7ee0a8", width: 2.2 }),
          fill: new Fill({ color: "rgba(95,163,113,0.3)" }),
        });
      },
      zIndex: 50,
    });
    selectionRef.current = selection;

    const map = new OlMap({
      target: container.current,
      layers: [basemapLayer, choropleth, selection, labelLayer],
      view: new View({
        projection: "EPSG:8857",
        center: transform([17, 2], "EPSG:4326", "EPSG:8857"),
        zoom: 3,
      }),
      controls: defaultControls({ attribution: true, attributionOptions: { collapsible: true, collapsed: true }, zoom: false, rotate: false }),
    });

    const africaView = map.getView();
    africaView.fit(transformExtent(AFRICA_BOUNDS, "EPSG:4326", "EPSG:8857"), { padding: [40, 40, 40, 40] });
    // The continent-wide framing is the outer navigation limit: users may
    // zoom into countries, but cannot zoom out beyond Africa.
    africaView.setMinZoom(africaView.getZoom() ?? 3);

    const pickFeature = (pixel: number[]): Feature<Geometry> | null => {
      let hit: Feature<Geometry> | null = null;
      map.forEachFeatureAtPixel(pixel, (f) => { if (!hit) hit = f as Feature<Geometry>; }, { layerFilter: (l) => l === choropleth });
      return hit;
    };

    map.on("pointermove", (event) => {
      const prev = hoveredRef.current;
      const found = pickFeature(event.pixel);
      if (prev && prev !== found) { prev.set("hovered", false, true); prev.changed(); }
      if (found && found !== prev) { found.set("hovered", true, true); found.changed(); }
      hoveredRef.current = found;
      const target = map.getTargetElement();
      if (target) target.style.cursor = found ? "pointer" : "";
      if (found) {
        handlers.current.onHover({ iso3: found.get("id") as string, x: event.pixel[0], y: event.pixel[1] });
      } else {
        handlers.current.onHover(null);
      }
    });

    map.on("click", (event) => {
      const found = pickFeature(event.pixel);
      handlers.current.onSelect(found ? (found.get("id") as string) : null);
    });

    mapRef.current = map;
    setReady(true);
    return () => { map.setTarget(undefined); mapRef.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Load boundaries
  useEffect(() => {
    if (!ready) return;
    let live = true;
    fetch(LEVEL_DATA[level].url)
      .then((r) => r.json() as Promise<GeoJSON.FeatureCollection>)
      .then((data) => {
        if (!live) return;
        for (const f of data.features) f.properties = { ...f.properties, id: f.properties?.[LEVEL_DATA[level].idField] };
        geojsonData.current = data;
        const format = new OlGeoJSON({ dataProjection: "EPSG:4326", featureProjection: "EPSG:8857" });
        const features = format.readFeatures(data);
        vectorSource.current.clear();
        vectorSource.current.addFeatures(features);
        setLoadedLevel(level);
      });
    return () => { live = false; };
  }, [level, ready]);

  // Update choropleth colours
  useEffect(() => {
    if (!ready || loadedLevel !== level) return;
    for (const feature of vectorSource.current.getFeatures()) {
      const id = feature.get("id") as string;
      const s = styles[id];
      feature.set("fill", s?.fill ?? "#6b7076", true);
      feature.set("active", s?.active ?? false, true);
    }
    vectorSource.current.changed();
  }, [styles, ready, loadedLevel, level]);

  // Choropleth visibility
  useEffect(() => {
    if (!ready || !choroplethRef.current) return;
    choroplethRef.current.setVisible(choroplethVisible);
  }, [choroplethVisible, ready]);

  // Selected country highlight
  useEffect(() => {
    if (!ready) return;
    for (const f of vectorSource.current.getFeatures()) {
      f.set("id" === f.get("id") ? "__match__" : "id", f.get("id"), true);
    }
    if (selectionRef.current) {
      selectionRef.current.setStyle((feature) => {
        if ((feature as Feature<Geometry>).get("id") !== selected) return undefined as unknown as Style;
        return new Style({
          stroke: new Stroke({ color: "#7ee0a8", width: 2.2 }),
          fill: new Fill({ color: "rgba(95,163,113,0.3)" }),
        });
      });
      selectionRef.current.changed();
    }
  }, [selected, ready]);

  // WMS raster layers
  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map) return;
    for (const layer of rasterLayersRef.current) map.removeLayer(layer);
    rasterLayersRef.current = [];
    if (maskRef.current) { map.removeLayer(maskRef.current); maskRef.current = null; }

    if (!rasterLayer) return;
    const layerNames = rasterLayer.layerName.split(",");
    const rStyles = rasterLayer.style?.split(",") ?? [];
    const namedLayers = rasterLayer.sldBody?.match(/<NamedLayer>.*?<\/NamedLayer>/g) ?? [];
    const sldPrefix = rasterLayer.sldBody && namedLayers.length ? rasterLayer.sldBody.slice(0, rasterLayer.sldBody.indexOf(namedLayers[0]!)) : "";
    const lastNL = namedLayers[namedLayers.length - 1];
    const sldSuffix = rasterLayer.sldBody && lastNL ? rasterLayer.sldBody.slice(rasterLayer.sldBody.lastIndexOf(lastNL) + lastNL.length) : "";

    layerNames.forEach((name, index) => {
      const qualified = name.includes(":") ? name : `geossia:${name}`;
      const params: Record<string, string> = {
        LAYERS: qualified,
        FORMAT: "image/png",
        TRANSPARENT: "true",
        VERSION: "1.1.1",
        _v: RASTER_CACHE_VERSION,
      };
      if (rStyles[index] || rStyles[0]) params.STYLES = rStyles[index] || rStyles[0];
      if (rasterLayer.sldBody) {
        const named = namedLayers.find((e) => e.includes(`<Name>${qualified}</Name>`)) ?? (layerNames.length === 1 ? namedLayers[0] : undefined);
        params.SLD_BODY = named ? `${sldPrefix}${named}${sldSuffix}` : rasterLayer.sldBody;
      }
      const imgLayer = new ImageLayer({
        className: "raster-data-layer",
        source: new ImageWMS({
          url: wmsBase,
          params,
          serverType: "geoserver",
          ratio: 1,
        }),
        opacity: 1,
        zIndex: 3 + index,
      });
      map.addLayer(imgLayer);
      rasterLayersRef.current.push(imgLayer);
    });

    // Clip mask
    if (rasterClipIds?.length && geojsonData.current) {
      const wanted = new Set(rasterClipIds);
      const holes: number[][][] = [];
      for (const f of geojsonData.current.features) {
        if (!wanted.has(String(f.properties?.id))) continue;
        const geom = f.geometry;
        if (geom?.type === "Polygon") holes.push(asMaskHole(geom.coordinates[0] as number[][]));
        if (geom?.type === "MultiPolygon") for (const p of geom.coordinates) holes.push(asMaskHole(p[0] as number[][]));
      }
      const maskGeoJson: GeoJSON.FeatureCollection = {
        type: "FeatureCollection",
        features: [{ type: "Feature", properties: {}, geometry: { type: "Polygon", coordinates: [[[-180, -85], [180, -85], [180, 85], [-180, 85], [-180, -85]], ...holes] } }],
      };
      const maskSource = new VectorSource({
        features: new OlGeoJSON({ dataProjection: "EPSG:4326", featureProjection: "EPSG:8857" }).readFeatures(maskGeoJson),
      });
      const mask = new VectorLayer({
        source: maskSource,
        style: new Style({ fill: new Fill({ color: "rgba(238,243,240,0.97)" }) }),
        zIndex: 10 + layerNames.length,
      });
      map.addLayer(mask);
      maskRef.current = mask;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rasterLayer?.layerName, rasterLayer?.style, rasterLayer?.sldBody, rasterClipIds?.join(","), loadedLevel, ready]);

  // Basemap switching
  useEffect(() => {
    if (!ready || !basemapRef.current || !labelRef.current) return;
    const config = BASEMAPS[basemap];
    const tiles = config.tiles[0];
    const labels = config.labels[0];
    basemapRef.current.setVisible(Boolean(tiles));
    labelRef.current.setVisible(Boolean(labels));
    if (tiles) basemapRef.current.setSource(new XYZ({ url: tiles, projection: "EPSG:3857", tileGrid: TILE_GRID, attributions: config.attribution }));
    if (labels) labelRef.current.setSource(new XYZ({ url: labels, projection: "EPSG:3857", tileGrid: TILE_GRID }));
  }, [basemap, ready]);

  // Overlay WMS layers
  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map) return;
    for (const overlay of OVERLAYS) {
      const wanted = overlays.includes(overlay.id);
      const existing = overlayLayersRef.current.get(overlay.id);
      if (wanted && !existing && overlay.layerName) {
        const params: Record<string, string> = {
          LAYERS: overlay.layerName,
          FORMAT: "image/png",
          TRANSPARENT: "true",
          VERSION: "1.1.1",
          _v: RASTER_CACHE_VERSION,
        };
        if (overlay.cqlFilter) params.CQL_FILTER = overlay.cqlFilter();
        const layer = new ImageLayer({
          source: new ImageWMS({ url: wmsBase, params, serverType: "geoserver", ratio: 1 }),
          opacity: 0.95,
          zIndex: 90,
        });
        map.addLayer(layer);
        overlayLayersRef.current.set(overlay.id, layer);
      } else if (!wanted && existing) {
        map.removeLayer(existing);
        overlayLayersRef.current.delete(overlay.id);
      }
    }
  }, [overlays, ready]);

  // Draw-bbox mode: Shift+drag draws a rectangle, reports bbox in EPSG:4326
  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map) return;

    if (!bboxLayerRef.current) {
      bboxLayerRef.current = new VectorLayer({
        source: bboxSourceRef.current,
        style: new Style({
          stroke: new Stroke({ color: "#f59e0b", width: 2, lineDash: [6, 4] }),
          fill: new Fill({ color: "rgba(245,158,11,0.12)" }),
        }),
        zIndex: 200,
      });
      map.addLayer(bboxLayerRef.current);
    }

    if (drawBbox) {
      if (dragBoxRef.current) map.removeInteraction(dragBoxRef.current);
      const dragBox = new DragBox({ condition: always });
      dragBox.on("boxend", () => {
        const extent = dragBox.getGeometry().getExtent();
        const [w, s, e, n] = transformExtent(extent, map.getView().getProjection(), "EPSG:4326");
        const bbox: [number, number, number, number] = [
          Math.round(w * 1000) / 1000,
          Math.round(s * 1000) / 1000,
          Math.round(e * 1000) / 1000,
          Math.round(n * 1000) / 1000,
        ];
        bboxSourceRef.current.clear();
        const feat = new OlGeoJSON().readFeature(
          { type: "Feature", geometry: { type: "Polygon", coordinates: [[[bbox[0], bbox[1]], [bbox[2], bbox[1]], [bbox[2], bbox[3]], [bbox[0], bbox[3]], [bbox[0], bbox[1]]]] }, properties: {} },
          { dataProjection: "EPSG:4326", featureProjection: map.getView().getProjection() },
        );
        if (feat) bboxSourceRef.current.addFeature(feat as Feature<Geometry>);
        // One-shot drawing: remove the interaction immediately instead of
        // waiting for React to propagate drawBbox=false on the next render.
        map.removeInteraction(dragBox);
        if (dragBoxRef.current === dragBox) dragBoxRef.current = null;
        container.current?.classList.remove("draw-mode");
        handlers.current.onDrawBbox?.(bbox);
      });
      map.addInteraction(dragBox);
      dragBoxRef.current = dragBox;
      container.current?.classList.add("draw-mode");
    } else {
      if (dragBoxRef.current) {
        map.removeInteraction(dragBoxRef.current);
        dragBoxRef.current = null;
      }
      container.current?.classList.remove("draw-mode");
    }

    return () => {
      if (dragBoxRef.current) {
        map.removeInteraction(dragBoxRef.current);
        dragBoxRef.current = null;
      }
      container.current?.classList.remove("draw-mode");
    };
  }, [drawBbox, ready]);

  // GEE tile layers (XYZ from Earth Engine)
  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map) return;
    const wanted = new Map((geeTileLayers ?? []).map((entry) => [entry.id, entry]));
    // Remove stale layers
    for (const [id, layer] of geeTileLayersRef.current) {
      if (!wanted.has(id)) {
        map.removeLayer(layer);
        geeTileLayersRef.current.delete(id);
      }
    }
    // Add or update layers
    for (const [id, entry] of wanted) {
      const existing = geeTileLayersRef.current.get(id);
      if (existing) {
        const src = existing.getSource();
        if (src && src.getUrls()?.[0] !== entry.tileUrl) {
          src.setUrl(entry.tileUrl);
        }
      } else {
        const layer = new TileLayer({
          source: new XYZ({ url: entry.tileUrl, projection: "EPSG:3857", tileGrid: TILE_GRID, maxZoom: 18 }),
          opacity: 0.88,
          zIndex: 15,
        });
        map.addLayer(layer);
        geeTileLayersRef.current.set(id, layer);
      }
    }
  }, [geeTileLayers, ready]);

  return <div ref={container} className="map-canvas" />;
});
