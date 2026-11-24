import { useEffect, useRef } from "react";
import * as Cesium from "cesium";
import "cesium/Build/Cesium/Widgets/widgets.css";
import type { BasemapId } from "./MapCanvas";

export interface CesiumRasterLayer { layerName: string; style?: string; sldBody?: string }

const WMS_URL = ((import.meta.env.VITE_GEOSERVER_WMS_URL as string | undefined) ?? "/geoserver/geossia/wms").replace(/\/$/, "");
const ESRI = "https://server.arcgisonline.com/ArcGIS/rest/services";

function basemapUrl(id: BasemapId) {
  if (id === "neutre") return `${ESRI}/World_Shaded_Relief/MapServer/tile/{z}/{y}/{x}`;
  if (id === "satellite") return `${ESRI}/World_Imagery/MapServer/tile/{z}/{y}/{x}`;
  if (id === "sombre") return `${ESRI}/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}`;
  return `${ESRI}/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}`;
}

export default function CesiumMap({ basemap, rasterLayer }: { basemap: BasemapId; rasterLayer: CesiumRasterLayer | null }) {
  const host = useRef<HTMLDivElement>(null);
  const viewer = useRef<Cesium.Viewer | null>(null);

  useEffect(() => {
    if (!host.current) return;
    const initialUrl = basemapUrl(basemap);
    const instance = new Cesium.Viewer(host.current, {
      baseLayer: initialUrl ? new Cesium.ImageryLayer(new Cesium.UrlTemplateImageryProvider({ url: initialUrl, maximumLevel: 18 })) : false,
      terrainProvider: new Cesium.EllipsoidTerrainProvider(),
      animation: false, timeline: false, geocoder: false, homeButton: false,
      sceneModePicker: false, baseLayerPicker: false, navigationHelpButton: false,
      fullscreenButton: false, infoBox: false, selectionIndicator: false,
    });
    instance.scene.globe.enableLighting = true;
    instance.scene.globe.baseColor = Cesium.Color.fromCssColorString("#e8ede9");
    instance.camera.flyTo({ destination: Cesium.Cartesian3.fromDegrees(17, 3, 7_600_000), duration: 0 });
    viewer.current = instance;
    return () => { viewer.current = null; instance.destroy(); };
  }, []); // one Cesium context per 3D session

  useEffect(() => {
    const instance = viewer.current;
    if (!instance) return;
    instance.imageryLayers.removeAll();
    const baseUrl = basemapUrl(basemap);
    if (baseUrl) instance.imageryLayers.add(new Cesium.ImageryLayer(new Cesium.UrlTemplateImageryProvider({ url: baseUrl, maximumLevel: 18 })));
    if (!rasterLayer) return;
    rasterLayer.layerName.split(",").forEach((name, index) => {
      const parameters: Record<string, string | boolean> = { transparent: true, format: "image/png" };
      const style = rasterLayer.style?.split(",")[index];
      if (style) parameters.styles = style;
      if (rasterLayer.sldBody) parameters.sld_body = rasterLayer.sldBody;
      const provider = new Cesium.WebMapServiceImageryProvider({ url: WMS_URL, layers: name.includes(":") ? name : `geossia:${name}`, parameters });
      instance.imageryLayers.add(new Cesium.ImageryLayer(provider));
    });
  }, [basemap, rasterLayer?.layerName, rasterLayer?.style, rasterLayer?.sldBody]);

  return <div ref={host} className="cesium-map" aria-label="Globe 3D Cesium" />;
}
