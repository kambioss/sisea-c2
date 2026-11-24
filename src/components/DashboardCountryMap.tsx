import { useEffect, useRef } from "react";
import OlMap from "ol/Map";
import Overlay from "ol/Overlay";
import View from "ol/View";
import GeoJSON from "ol/format/GeoJSON";
import VectorLayer from "ol/layer/Vector";
import VectorSource from "ol/source/Vector";
import { Fill, Stroke, Style } from "ol/style";
import { fromLonLat } from "ol/proj";
import type Feature from "ol/Feature";
import type { Geometry } from "ol/geom";
import "ol/ol.css";
import { COUNTRIES } from "../data/countries";

interface Props {
  selectedIso3: string;
  onSelect(iso3: string): void;
}

export default function DashboardCountryMap({ selectedIso3, onSelect }: Props) {
  const targetRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<OlMap | null>(null);
  // OpenLayers' vector generics include RenderFeature in URL-backed sources.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const layerRef = useRef<VectorLayer<any> | null>(null);
  const selectedRef = useRef(selectedIso3);
  const onSelectRef = useRef(onSelect);
  const valuesRef = useRef(new Map<string, number>());

  selectedRef.current = selectedIso3;
  onSelectRef.current = onSelect;

  useEffect(() => {
    if (!targetRef.current || mapRef.current) return;
    const source = new VectorSource({
      url: "/data/countries.geojson",
      format: new GeoJSON({ dataProjection: "EPSG:4326", featureProjection: "EPSG:3857" }),
    });
    const layer = new VectorLayer({
      source,
      style: (feature) => countryStyle(String(feature.get("iso3")), selectedRef.current, valuesRef.current),
    });
    const map = new OlMap({
      target: targetRef.current,
      layers: [layer],
      view: new View({ center: fromLonLat([18, 1]), zoom: 3.25, minZoom: 2.5, maxZoom: 9 }),
    });
    const tooltip = document.createElement("div");
    tooltip.className = "fs-map-tooltip";
    const overlay = new Overlay({ element: tooltip, offset: [12, -10], positioning: "bottom-left", stopEvent: false });
    map.addOverlay(overlay);
    map.on("pointermove", (event) => {
      const target = map.getTargetElement();
      if (!target) return;
      const feature = map.forEachFeatureAtPixel(event.pixel, (item) => item as Feature<Geometry>);
      target.style.cursor = feature ? "pointer" : "";
      const iso3 = feature?.get("iso3");
      const value = iso3 ? valuesRef.current.get(String(iso3)) : undefined;
      if (!iso3) return overlay.setPosition(undefined);
      const name = COUNTRIES.find((country) => country.iso3 === iso3)?.name ?? iso3;
      tooltip.innerHTML = `<strong>${name}</strong><span>${value === undefined ? "Donnée indisponible" : `${value.toLocaleString("fr-FR", { maximumFractionDigits: 1 })} MtCO₂e`}</span>`;
      overlay.setPosition(event.coordinate);
    });
    map.on("singleclick", (event) => {
      const feature = map.forEachFeatureAtPixel(event.pixel, (item) => item as Feature<Geometry>);
      const iso3 = feature?.get("iso3");
      if (iso3) onSelectRef.current(String(iso3));
    });
    source.once("featuresloadend", () => { const extent = source.getExtent(); if (extent) map.getView().fit(extent, { padding: [16, 16, 16, 16], maxZoom: 3.8 }); });
    mapRef.current = map;
    layerRef.current = layer;
    return () => { map.setTarget(undefined); mapRef.current = null; };
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    const params = new URLSearchParams({
      service: "WFS", version: "2.0.0", request: "GetFeature",
      typeName: "geossia:country_indicator_series", outputFormat: "application/json",
      propertyName: "iso3,value", count: "100",
      CQL_FILTER: "indicator='climatetrace_emissions' AND sub_indicator='total' AND year=2025",
    });
    fetch(`/geoserver/geossia/wms?${params}`, { signal: controller.signal })
      .then((response) => response.ok ? response.json() : Promise.reject(new Error(String(response.status))))
      .then((body: { features?: { properties?: { iso3?: string; value?: number } }[] }) => {
        valuesRef.current = new Map((body.features ?? []).flatMap((feature) => {
          const iso3 = feature.properties?.iso3, value = Number(feature.properties?.value);
          return iso3 && Number.isFinite(value) ? [[iso3, value] as [string, number]] : [];
        }));
        layerRef.current?.changed();
      })
      .catch(() => undefined);
    return () => controller.abort();
  }, []);

  useEffect(() => {
    selectedRef.current = selectedIso3;
    layerRef.current?.changed();
    const source = layerRef.current?.getSource();
    if (!source || selectedIso3 === "AFR") {
      const extent = source?.getExtent();
      if (source && !source.isEmpty() && extent) mapRef.current?.getView().fit(extent, { duration: 500, padding: [16, 16, 16, 16], maxZoom: 3.8 });
      return;
    }
    const feature = source.getFeatures().find((item: Feature<Geometry>) => item.get("iso3") === selectedIso3);
    if (feature?.getGeometry()) mapRef.current?.getView().fit(feature.getGeometry()!.getExtent(), { duration: 500, padding: [55, 55, 55, 55], maxZoom: 6 });
  }, [selectedIso3]);

  return <div ref={targetRef} className="fs-ol-map" aria-label="Limites nationales africaines" />;
}

function countryStyle(iso3: string, selectedIso3: string, values: Map<string, number>) {
  const selected = selectedIso3 === iso3;
  const value = values.get(iso3);
  const color = value === undefined ? "#dce5e8" : value < 5.6 ? "#dcefeb" : value < 17.1 ? "#a9d3ca" : value < 44.7 ? "#72b1a7" : value < 75.9 ? "#d8bd79" : "#c68c52";
  return new Style({
    fill: new Fill({ color }),
    stroke: new Stroke({ color: selected ? "#172d4c" : "#ffffff", width: selected ? 3 : 1 }),
  });
}
