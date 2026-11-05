// MapLibre map of the géoportail: country choropleth drawn in the browser
// from public/data/countries.geojson, a raster basemap, and optional WMS
// overlays from the GEOSSIA GeoServer (workspace "geossia").

import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import maplibregl, { GeoJSONSource, Map as MlMap } from "maplibre-gl";

export type BasemapId = "clair" | "sombre" | "satellite";

const ESRI = "https://server.arcgisonline.com/ArcGIS/rest/services";

// Esri basemaps (free with attribution; CARTO's raster tiles now need a key).
// `labels` is a transparent reference layer drawn above the choropleth.
export const BASEMAPS: Record<BasemapId, { label: string; tiles: string[]; labels: string[]; attribution: string }> = {
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
  layerName: string;
  cqlFilter?: () => string;
}

// FIRMS active fires (daily-appended point table): only the last 3 days.
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
];

const WMS_URL = ((import.meta.env.VITE_GEOSERVER_WMS_URL as string | undefined) ?? "/geoserver/geossia/wms").replace(/\/$/, "");

function wmsTiles(overlay: Overlay): string {
  const params = new URLSearchParams({
    SERVICE: "WMS",
    VERSION: "1.1.1",
    REQUEST: "GetMap",
    LAYERS: overlay.layerName,
    FORMAT: "image/png",
    TRANSPARENT: "true",
    SRS: "EPSG:3857",
    WIDTH: "512",
    HEIGHT: "512",
  });
  if (overlay.cqlFilter) params.set("CQL_FILTER", overlay.cqlFilter());
  // {bbox-epsg-3857} must stay unescaped for MapLibre to substitute it.
  const base = WMS_URL.startsWith("http") ? WMS_URL : `${window.location.origin}${WMS_URL}`;
  return `${base}?${params.toString()}&BBOX={bbox-epsg-3857}`;
}

export interface FeatureStyle {
  fill: string;
  // 0 = excluded or outside the value range, drawn faded.
  active: boolean;
}

export interface MapCanvasHandle {
  zoomIn(): void;
  zoomOut(): void;
  fitBounds(bbox: [number, number, number, number]): void;
  reset(): void;
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
  onSelect(iso3: string | null): void;
  onHover(info: { iso3: string; x: number; y: number } | null): void;
}

const AFRICA_BOUNDS: [number, number, number, number] = [-20, -36, 54, 38];

export const MapCanvas = forwardRef<MapCanvasHandle, Props>(function MapCanvas({ level, styles, choroplethVisible, selected, basemap, overlays, onSelect, onHover }, ref) {
  const container = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MlMap | null>(null);
  const geojson = useRef<GeoJSON.FeatureCollection | null>(null);
  const [ready, setReady] = useState(false);
  const handlers = useRef({ onSelect, onHover });
  handlers.current = { onSelect, onHover };

  useImperativeHandle(ref, () => ({
    zoomIn: () => mapRef.current?.zoomIn(),
    zoomOut: () => mapRef.current?.zoomOut(),
    fitBounds: (bbox) => mapRef.current?.fitBounds([[bbox[0], bbox[1]], [bbox[2], bbox[3]]], { padding: { top: 90, bottom: 60, left: 60, right: 340 }, duration: 900, maxZoom: 4.6 }),
    reset: () => mapRef.current?.fitBounds([[AFRICA_BOUNDS[0], AFRICA_BOUNDS[1]], [AFRICA_BOUNDS[2], AFRICA_BOUNDS[3]]], { padding: 40, duration: 900 }),
  }));

  useEffect(() => {
    if (!container.current) return;
    const map = new maplibregl.Map({
      container: container.current,
      style: {
        version: 8,
        sources: { basemap: { type: "raster", tiles: BASEMAPS[basemap].tiles, tileSize: 256, attribution: BASEMAPS[basemap].attribution } },
        layers: [{ id: "basemap", type: "raster", source: "basemap" }],
      },
      bounds: [[AFRICA_BOUNDS[0], AFRICA_BOUNDS[1]], [AFRICA_BOUNDS[2], AFRICA_BOUNDS[3]]],
      fitBoundsOptions: { padding: 40 },
      attributionControl: { compact: true },
      dragRotate: false,
      pitchWithRotate: false,
    });
    mapRef.current = map;
    map.on("load", async () => {
      map.addSource("countries", { type: "geojson", data: { type: "FeatureCollection", features: [] }, promoteId: "id" });
      map.addLayer({
        id: "countries-fill",
        type: "fill",
        source: "countries",
        paint: {
          "fill-color": ["coalesce", ["get", "fill"], "#e6e9ef"],
          "fill-opacity": ["case", ["boolean", ["get", "active"], true], ["case", ["boolean", ["feature-state", "hover"], false], 0.95, 0.78], 0.18],
        },
      });
      map.addLayer({ id: "countries-line", type: "line", source: "countries", paint: { "line-color": "#ffffff", "line-width": ["interpolate", ["linear"], ["zoom"], 2, 0.4, 6, 1.2], "line-opacity": 0.9 } });
      map.addLayer({
        id: "countries-selected-fill",
        type: "fill",
        source: "countries",
        filter: ["==", ["get", "id"], ""],
        paint: { "fill-color": "#e0559b", "fill-opacity": 0.55 },
      });
      map.addLayer({
        id: "countries-selected",
        type: "line",
        source: "countries",
        filter: ["==", ["get", "id"], ""],
        paint: { "line-color": "#c2185b", "line-width": 2.4 },
      });
      map.addSource("labels", { type: "raster", tiles: BASEMAPS[basemap].labels, tileSize: 256 });
      map.addLayer({ id: "labels", type: "raster", source: "labels" });
      let hovered: string | null = null;
      map.on("mousemove", "countries-fill", (event) => {
        const feature = event.features?.[0];
        if (!feature) return;
        const iso3 = feature.properties?.id as string;
        if (hovered && hovered !== iso3) map.setFeatureState({ source: "countries", id: hovered }, { hover: false });
        hovered = iso3;
        map.setFeatureState({ source: "countries", id: iso3 }, { hover: true });
        map.getCanvas().style.cursor = "pointer";
        handlers.current.onHover({ iso3, x: event.point.x, y: event.point.y });
      });
      map.on("mouseleave", "countries-fill", () => {
        if (hovered) map.setFeatureState({ source: "countries", id: hovered }, { hover: false });
        hovered = null;
        map.getCanvas().style.cursor = "";
        handlers.current.onHover(null);
      });
      map.on("click", (event) => {
        const feature = map.queryRenderedFeatures(event.point, { layers: ["countries-fill"] })[0];
        handlers.current.onSelect((feature?.properties?.id as string | undefined) ?? null);
      });
      setReady(true);
    });
    return () => {
      map.remove();
      mapRef.current = null;
    };
    // The basemap is swapped in place below; the map itself is created once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Boundaries of the current level, each feature keyed by a common `id`.
  const [loadedLevel, setLoadedLevel] = useState<MapLevel | null>(null);
  useEffect(() => {
    if (!ready) return;
    let live = true;
    fetch(LEVEL_DATA[level].url)
      .then((response) => response.json() as Promise<GeoJSON.FeatureCollection>)
      .then((data) => {
        if (!live) return;
        for (const feature of data.features) feature.properties = { ...feature.properties, id: feature.properties?.[LEVEL_DATA[level].idField] };
        geojson.current = data;
        setLoadedLevel(level);
      });
    return () => {
      live = false;
    };
  }, [level, ready]);

  // Choropleth colours: written into the features' properties, so a single
  // data-driven paint expression covers every indicator and filter.
  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map || !geojson.current || loadedLevel !== level) return;
    for (const feature of geojson.current.features) {
      const style = styles[feature.properties?.id as string];
      feature.properties = { ...feature.properties, fill: style?.fill ?? "#e6e9ef", active: style?.active ?? false };
    }
    (map.getSource("countries") as GeoJSONSource).setData(geojson.current);
  }, [styles, ready, loadedLevel, level]);

  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map?.getLayer("countries-fill")) return;
    map.setPaintProperty("countries-fill", "fill-opacity", choroplethVisible
      ? ["case", ["boolean", ["get", "active"], true], ["case", ["boolean", ["feature-state", "hover"], false], 0.95, 0.78], 0.18]
      : 0);
  }, [choroplethVisible, ready]);

  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map) return;
    const filter: maplibregl.FilterSpecification = ["==", ["get", "id"], selected ?? ""];
    map.setFilter("countries-selected", filter);
    map.setFilter("countries-selected-fill", filter);
  }, [selected, ready]);

  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map) return;
    map.removeLayer("basemap");
    map.removeSource("basemap");
    map.addSource("basemap", { type: "raster", tiles: BASEMAPS[basemap].tiles, tileSize: 256, attribution: BASEMAPS[basemap].attribution });
    map.addLayer({ id: "basemap", type: "raster", source: "basemap" }, map.getStyle().layers[0]?.id);
    map.removeLayer("labels");
    map.removeSource("labels");
    map.addSource("labels", { type: "raster", tiles: BASEMAPS[basemap].labels, tileSize: 256 });
    map.addLayer({ id: "labels", type: "raster", source: "labels" });
  }, [basemap, ready]);

  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map) return;
    for (const overlay of OVERLAYS) {
      const id = `overlay-${overlay.id}`;
      const wanted = overlays.includes(overlay.id);
      if (wanted && !map.getSource(id)) {
        map.addSource(id, { type: "raster", tiles: [wmsTiles(overlay)], tileSize: 512, attribution: "GEOSSIA GeoServer" });
        map.addLayer({ id, type: "raster", source: id, paint: { "raster-opacity": 0.95 } }, "labels");
      } else if (!wanted && map.getSource(id)) {
        map.removeLayer(id);
        map.removeSource(id);
      }
    }
  }, [overlays, ready]);

  return <div ref={container} className="map-canvas" />;
});
