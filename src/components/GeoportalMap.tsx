import { useEffect, useRef, useState, useImperativeHandle, forwardRef } from "react";
import OlMap from "ol/Map";
import View from "ol/View";
import TileLayer from "ol/layer/Tile";
import VectorLayer from "ol/layer/Vector";
import VectorSource from "ol/source/Vector";
import GeoJSON from "ol/format/GeoJSON";
import OSM from "ol/source/OSM";
import XYZ from "ol/source/XYZ";
import { Style, Fill, Stroke, Text as OlText } from "ol/style";
import { get as getProjection, transformExtent } from "ol/proj";
import { register } from "ol/proj/proj4";
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
export type CountryAlert = {
  code: string;
  name: string;
  spi3: number;
  level: number;
  since: string;
  trend: number[];
};

export type LayerKey = "osm" | "satellite" | "topo" | "spi3" | "firms";

export type GeoportalMapHandle = {
  zoom: (delta: number) => void;
  reset: () => void;
};

const LEVEL_FILL: Record<number, string> = {
  1: "rgba(95, 163, 113, 0.55)",
  2: "rgba(201, 168, 106, 0.65)",
  3: "rgba(212, 162, 76, 0.75)",
  4: "rgba(156, 47, 28, 0.85)",
};

const LEVEL_STROKE: Record<number, string> = {
  1: "#2d5a3d",
  2: "#8a6a1b",
  3: "#8a5a1b",
  4: "#5c1a10",
};

const LEVEL_LABEL: Record<number, string> = {
  1: "Normal",
  2: "Veille",
  3: "Alerte",
  4: "Alerte sévère",
};

const CENTER_WEST_AFRICA = transformExtent([-9, 6, 15, 20], "EPSG:4326", "EPSG:8857");
const INITIAL_ZOOM = 4.6;

type GeoportalMapProps = {
  alerts: CountryAlert[];
  layers: Record<LayerKey, boolean>;
  selectedCode?: string;
  onSelect?: (code: string) => void;
};

export const GeoportalMap = forwardRef<GeoportalMapHandle, GeoportalMapProps>(
  function GeoportalMap({ alerts, layers, selectedCode, onSelect }, ref) {
    const mapRef = useRef<HTMLDivElement | null>(null);
    const mapInstance = useRef<OlMap | null>(null);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const baseLayersRef = useRef<Record<string, TileLayer<any>>>({});
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const countriesLayerRef = useRef<any>(null);
    const [popupData, setPopupData] = useState<{
      code: string;
      name: string;
      spi3: number;
      level: number;
      since: string;
      x: number;
      y: number;
    } | null>(null);

    const alertByCode = new Map<string, CountryAlert>(alerts.map((a) => [a.code, a]));

    const buildStyle = (code: string, isSelected: boolean) => {
      const alert = alertByCode.get(code);
      const level = alert?.level ?? 1;
      // Hide labels for tiny countries (GM, CV) — they'd overlap
      const showLabel = !["GM", "CV"].includes(code);
      return new Style({
        fill: new Fill({ color: LEVEL_FILL[level] }),
        stroke: new Stroke({
          color: isSelected ? "#1f3a26" : LEVEL_STROKE[level],
          width: isSelected ? 3 : 1.2,
        }),
        text: showLabel ? new OlText({
          text: code,
          font: "600 11px 'JetBrains Mono', monospace",
          fill: new Fill({ color: level >= 3 ? "#fff" : "#1a201a" }),
          stroke: new Stroke({ color: "rgba(255,255,255,0.6)", width: 3 }),
        }) : undefined,
      });
    };

    useImperativeHandle(ref, () => ({
      zoom: (delta: number) => {
        const view = mapInstance.current?.getView();
        if (view) {
          view.animate({
            zoom: (view.getZoom() ?? INITIAL_ZOOM) + delta,
            duration: 250,
          });
        }
      },
      reset: () => {
        const view = mapInstance.current?.getView();
        if (view) {
          view.animate({
            center: [(CENTER_WEST_AFRICA[0] + CENTER_WEST_AFRICA[2]) / 2, (CENTER_WEST_AFRICA[1] + CENTER_WEST_AFRICA[3]) / 2],
            zoom: INITIAL_ZOOM,
            duration: 600,
          });
        }
      },
    }));

    // Initialize map once
    useEffect(() => {
      if (!mapRef.current || mapInstance.current) return;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const baseLayers: Record<string, TileLayer<any>> = {
        osm: new TileLayer({
          source: new OSM({
            attributions: "© OpenStreetMap contributors",
          }),
          visible: layers.osm,
        }),
        satellite: new TileLayer({
          source: new XYZ({
            url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
            attributions: "© Esri World Imagery",
            maxZoom: 18,
          }),
          visible: layers.satellite,
        }),
        topo: new TileLayer({
          source: new XYZ({
            url: "https://{a-d}.tile.opentopomap.org/{z}/{x}/{y}.png",
            attributions: "© OpenTopoMap (CC-BY-SA)",
            maxZoom: 16,
          }),
          visible: layers.topo,
        }),
      };

      baseLayersRef.current = baseLayers;

      const countriesSource = new VectorSource({
        url: "/geo/west_africa.geojson",
        format: new GeoJSON({ dataProjection: "EPSG:4326", featureProjection: "EPSG:8857" }),
      });

      const styleFn = (feature: Feature<Geometry> | any) => {
        const code = feature.get("code") as string;
        return buildStyle(code, selectedCode === code);
      };

      const countriesLayer = new VectorLayer({
        source: countriesSource,
        style: styleFn,
        opacity: layers.spi3 ? 1 : 0.35,
      });

      countriesLayerRef.current = countriesLayer;

      const map = new OlMap({
        target: mapRef.current,
        layers: [baseLayers.osm, baseLayers.satellite, baseLayers.topo, countriesLayer],
        view: new View({
          projection: "EPSG:8857",
          center: [(CENTER_WEST_AFRICA[0] + CENTER_WEST_AFRICA[2]) / 2, (CENTER_WEST_AFRICA[1] + CENTER_WEST_AFRICA[3]) / 2],
          zoom: INITIAL_ZOOM,
          minZoom: 3,
          maxZoom: 12,
        }),
        controls: [],
      });

      mapInstance.current = map;

      map.on("click", (evt) => {
        const feature = map.forEachFeatureAtPixel(evt.pixel, (f) => f);
        if (feature) {
          const code = feature.get("code");
          const name = feature.get("name");
          const alert = alertByCode.get(code);
          if (alert && onSelect) {
            onSelect(code);
          }
          if (alert) {
            setPopupData({
              code,
              name,
              spi3: alert.spi3,
              level: alert.level,
              since: alert.since,
              x: evt.pixel[0],
              y: evt.pixel[1],
            });
          }
        } else {
          setPopupData(null);
        }
      });

      map.on("pointermove", (evt) => {
        if (!mapRef.current) return;
        const hit = map.hasFeatureAtPixel(evt.pixel);
        mapRef.current.style.cursor = hit ? "pointer" : "";
      });

      return () => {
        map.setTarget(undefined);
        mapInstance.current = null;
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Update base layer visibility
    useEffect(() => {
      Object.entries(baseLayersRef.current).forEach(([key, layer]) => {
        if (layer) layer.setVisible(layers[key as LayerKey] ?? false);
      });
    }, [layers]);

    // Update style when selection changes
    useEffect(() => {
      const layer = countriesLayerRef.current;
      if (!layer) return;
      layer.setStyle((feature: Feature<Geometry> | any) => {
        const code = feature.get("code") as string;
        return buildStyle(code, selectedCode === code);
      });
      layer.setOpacity(layers.spi3 ? 1 : 0.35);
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedCode, layers.spi3]);

    // Pan to selected country
    useEffect(() => {
      if (!mapInstance.current || !selectedCode) return;
      const layer = countriesLayerRef.current;
      if (!layer) return;
      const source = layer.getSource();
      if (!source) return;
      // Wait for features to load
      const tryPan = () => {
        const features = source.getFeatures();
        const feat = features.find((f: any) => f.get("code") === selectedCode);
        if (feat) {
          const geom = feat.getGeometry();
          if (geom) {
            const extent = geom.getExtent();
            const center = [(extent[0] + extent[2]) / 2, (extent[1] + extent[3]) / 2];
            mapInstance.current?.getView().animate({
              center,
              duration: 600,
              zoom: Math.max(mapInstance.current?.getView().getZoom() ?? 5, 5.5),
            });
          }
        }
      };
      // Try immediately, then again after a delay (features may still be loading)
      tryPan();
      const t = setTimeout(tryPan, 800);
      return () => clearTimeout(t);
    }, [selectedCode]);

    return (
      <>
        <div ref={mapRef} className="ol-map-target" style={{ width: "100%", height: "100%" }} />
        {popupData && (
          <div
            className="ol-popup"
            style={{ left: popupData.x, top: popupData.y }}
          >
            <button className="ol-popup-close" onClick={() => setPopupData(null)}>×</button>
            <div className="ol-popup-flag">
              <span className={`flag-mock ${popupData.code.toLowerCase()}`} aria-hidden="true" />
              <div>
                <strong>{popupData.name}</strong>
                <small>{popupData.code}</small>
              </div>
            </div>
            <div className="ol-popup-data">
              <div className="ol-popup-row">
                <span className="lbl">SPI-3</span>
                <span className={`val spi-${popupData.level}`}>{popupData.spi3.toFixed(2)}</span>
              </div>
              <div className="ol-popup-row">
                <span className="lbl">Niveau</span>
                <span className={`val lvl-${popupData.level}`}>
                  <i className="dot" /> {LEVEL_LABEL[popupData.level]}
                </span>
              </div>
              <div className="ol-popup-row">
                <span className="lbl">Depuis</span>
                <span className="val">{popupData.since}</span>
              </div>
            </div>
            <a className="ol-popup-cta" href="/tendances">Fiche complète →</a>
          </div>
        )}
      </>
    );
  }
);

export { LEVEL_FILL, LEVEL_STROKE, LEVEL_LABEL };
