import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Map from "ol/Map";
import View from "ol/View";
import TileLayer from "ol/layer/Tile";
import ImageLayer from "ol/layer/Image";
import XYZ from "ol/source/XYZ";
import ImageWMS from "ol/source/ImageWMS";
import { get as getProjection } from "ol/proj";
import { register } from "ol/proj/proj4";
import { createXYZ } from "ol/tilegrid";
import proj4 from "proj4";
import { getRenderPixel } from "ol/render";
import type RenderEvent from "ol/render/Event";
import { Icon } from "./Icon";
import { BASEMAPS, type BasemapId } from "./MapCanvas";
import { ProductFamily, ProductIndicator, ProductDate, fetchProductDates } from "../data/productCatalog";

proj4.defs(
  "EPSG:8857",
  "+proj=eqearth +lon_0=0 +x_0=0 +y_0=0 +datum=WGS84 +units=m +no_defs +type=crs",
);
register(proj4);

const MERCATOR = getProjection("EPSG:3857")!;
const TILE_GRID = createXYZ({ extent: MERCATOR.getExtent()!, tileSize: 256, maxZoom: 18 });

interface Props {
  basemap: BasemapId;
  productFamilies: ProductFamily[];
  onExit(): void;
}

const WMS_BASE =
  ((import.meta.env.VITE_GEOSERVER_WMS_URL as string | undefined) ??
    "/geoserver/geossia/wms"
  ).replace(/\/$/, "");


function sldForProduct(indicatorId: string, layerName: string): string | undefined {
  const ns = layerName.includes(":") ? layerName : `geossia:${layerName}`;
  if (indicatorId.startsWith("spi_"))
    return `<StyledLayerDescriptor xmlns="http://www.opengis.net/sld" version="1.0.0"><NamedLayer><Name>${ns}</Name><UserStyle><FeatureTypeStyle><Rule><RasterSymbolizer><Opacity>0.9</Opacity><ColorMap type="intervals"><ColorMapEntry color="#760005" quantity="-2.0"/><ColorMapEntry color="#d73027" quantity="-1.5"/><ColorMapEntry color="#f46d43" quantity="-1.0"/><ColorMapEntry color="#fdae61" quantity="-0.5"/><ColorMapEntry color="#ffffbf" quantity="0.5"/><ColorMapEntry color="#abd9e9" quantity="1.0"/><ColorMapEntry color="#74add1" quantity="1.5"/><ColorMapEntry color="#4575b4" quantity="2.0"/><ColorMapEntry color="#313695" quantity="999"/></ColorMap></RasterSymbolizer></Rule></FeatureTypeStyle></UserStyle></NamedLayer></StyledLayerDescriptor>`;
  if (indicatorId.startsWith("cmip6_tas_"))
    return `<StyledLayerDescriptor xmlns="http://www.opengis.net/sld" version="1.0.0"><NamedLayer><Name>${ns}</Name><UserStyle><FeatureTypeStyle><Rule><RasterSymbolizer><Opacity>0.88</Opacity><ColorMap type="intervals"><ColorMapEntry color="#fff7bc" quantity="1"/><ColorMapEntry color="#fec44f" quantity="1.5"/><ColorMapEntry color="#fe9929" quantity="2"/><ColorMapEntry color="#ec7014" quantity="3"/><ColorMapEntry color="#cc4c02" quantity="4"/><ColorMapEntry color="#993404" quantity="6"/><ColorMapEntry color="#662506" quantity="20"/></ColorMap></RasterSymbolizer></Rule></FeatureTypeStyle></UserStyle></NamedLayer></StyledLayerDescriptor>`;
  if (indicatorId.startsWith("gdo_fcst_"))
    return `<StyledLayerDescriptor xmlns="http://www.opengis.net/sld" version="1.0.0"><NamedLayer><Name>${ns}</Name><UserStyle><FeatureTypeStyle><Rule><RasterSymbolizer><ColorMap type="intervals"><ColorMapEntry color="#ffffff" opacity="0.35" quantity="0.5"/><ColorMapEntry color="#ffff00" quantity="1.5"/><ColorMapEntry color="#ffaa00" quantity="2.5"/><ColorMapEntry color="#ff0000" quantity="3.5"/><ColorMapEntry color="#e9ccf9" quantity="4.5"/><ColorMapEntry color="#c980c6" quantity="5.5"/><ColorMapEntry color="#833393" quantity="6.5"/><ColorMapEntry color="#5ab4ac" quantity="7.5"/><ColorMapEntry color="#000000" opacity="0" quantity="255"/></ColorMap></RasterSymbolizer></Rule></FeatureTypeStyle></UserStyle></NamedLayer></StyledLayerDescriptor>`;
  if (indicatorId === "fapar")
    return `<StyledLayerDescriptor xmlns="http://www.opengis.net/sld" version="1.0.0"><NamedLayer><Name>${ns}</Name><UserStyle><FeatureTypeStyle><Rule><RasterSymbolizer><Opacity>0.9</Opacity><ColorMap type="intervals"><ColorMapEntry color="#f2f3ef" quantity="0.10"/><ColorMapEntry color="#e8e6c8" quantity="0.20"/><ColorMapEntry color="#d9e6a7" quantity="0.35"/><ColorMapEntry color="#b7d77a" quantity="0.50"/><ColorMapEntry color="#78c679" quantity="0.65"/><ColorMapEntry color="#41ab5d" quantity="0.80"/><ColorMapEntry color="#238443" quantity="0.90"/><ColorMapEntry color="#005a32" quantity="1.01"/></ColorMap></RasterSymbolizer></Rule></FeatureTypeStyle></UserStyle></NamedLayer></StyledLayerDescriptor>`;
  if (indicatorId === "fire_density")
    return `<StyledLayerDescriptor xmlns="http://www.opengis.net/sld" version="1.0.0"><NamedLayer><Name>${ns}</Name><UserStyle><FeatureTypeStyle><Rule><RasterSymbolizer><Opacity>0.95</Opacity><ColorMap type="intervals"><ColorMapEntry color="#000000" opacity="0" quantity="0.5"/><ColorMapEntry color="#fff176" quantity="1.5"/><ColorMapEntry color="#ffb300" quantity="2.5"/><ColorMapEntry color="#f57c00" quantity="5.5"/><ColorMapEntry color="#e53935" quantity="10.5"/><ColorMapEntry color="#b71c1c" quantity="20.5"/><ColorMapEntry color="#6a1b9a" quantity="99999"/></ColorMap></RasterSymbolizer></Rule></FeatureTypeStyle></UserStyle></NamedLayer></StyledLayerDescriptor>`;
  return undefined;
}

function legendUrl(date: ProductDate): string {
  const layer = date.layer_name.split(",")[0];
  const name = layer.includes(":") ? layer : `geossia:${layer}`;
  const params = new URLSearchParams({
    SERVICE: "WMS", VERSION: "1.1.1", REQUEST: "GetLegendGraphic",
    FORMAT: "image/png", LAYER: name, TRANSPARENT: "true",
    WIDTH: "18", HEIGHT: "18",
  });
  if (date.style) params.set("STYLE", date.style.split(",")[0]);
  return `${WMS_BASE}?${params.toString()}`;
}

function dateLabel(indicator: ProductIndicator, date: ProductDate): string {
  if (date.period_start && date.period_end && date.forecast_horizon_days) {
    const issued = new Date(date.period_start);
    const valid = new Date(date.period_end);
    if (Number.isFinite(issued.getTime()) && Number.isFinite(valid.getTime())) {
      const fmt = (value: Date) => new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "UTC" }).format(value);
      return `Du ${fmt(issued)} au ${fmt(valid)} · J+${date.forecast_horizon_days}`;
    }
  }
  if (indicator.temporal_step === "year") {
    const year = date.reference_time?.slice(0, 4) ?? date.layer_name.match(/(?:19|20)\d{2}/)?.[0];
    if (year) return year;
  }
  if (indicator.temporal_step === "month") {
    let d: Date | null = null;
    if (date.reference_time) {
      const parsed = new Date(date.reference_time);
      if (Number.isFinite(parsed.getTime())) d = parsed;
    }
    if (!d) {
      const match = date.layer_name.match(/(?:^|_)((?:19|20)\d{2})[_-](0[1-9]|1[0-2])(?:[_-]|$)/);
      if (match) d = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, 1));
    }
    if (d)
      return new Intl.DateTimeFormat("fr-FR", { month: "long", year: "numeric", timeZone: "UTC" }).format(d);
  }
  return date.period_label || date.reference_time?.slice(0, 10) || date.layer_name;
}

function monthlyDateParts(date: ProductDate): { year: string; month: number } | null {
  if (date.reference_time) {
    const parsed = new Date(date.reference_time);
    if (Number.isFinite(parsed.getTime())) {
      return { year: String(parsed.getUTCFullYear()), month: parsed.getUTCMonth() };
    }
  }
  const match = date.layer_name.match(/(?:^|_)((?:19|20)\d{2})[_-](0[1-9]|1[0-2])(?:[_-]|$)/);
  return match ? { year: match[1], month: Number(match[2]) - 1 } : null;
}

function monthlyDateGroups(dates: ProductDate[]) {
  const groups = new globalThis.Map<string, Array<{ date: ProductDate; month: number }>>();
  const seen = new Set<string>();
  for (const date of dates) {
    const parts = monthlyDateParts(date);
    if (!parts) continue;
    const monthKey = `${parts.year}-${parts.month}`;
    if (seen.has(monthKey)) continue;
    seen.add(monthKey);
    const entries = groups.get(parts.year) ?? [];
    entries.push({ date, month: parts.month });
    groups.set(parts.year, entries);
  }
  return Array.from(groups.entries()).map(([year, entries]) => ({ year, entries }));
}

function uniqueMonthlyDates(dates: ProductDate[]): ProductDate[] {
  const seen = new Set<string>();
  return dates.filter((date) => {
    const parts = monthlyDateParts(date);
    if (!parts) return true;
    const key = `${parts.year}-${parts.month}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function DateOptions({ indicator, dates }: { indicator: ProductIndicator | null; dates: ProductDate[] }) {
  if (indicator?.temporal_step === "month") {
    return monthlyDateGroups(dates).map(({ year, entries }) => (
      <optgroup key={year} label={year}>
        {entries.map(({ date, month }) => (
          <option key={date.layer_name} value={date.layer_name}>
            {new Intl.DateTimeFormat("fr-FR", { month: "long", timeZone: "UTC" }).format(new Date(Date.UTC(2000, month, 1)))} {year}
          </option>
        ))}
      </optgroup>
    ));
  }
  return dates.map((date) => (
    <option key={date.layer_name} value={date.layer_name}>{indicator ? dateLabel(indicator, date) : date.period_label}</option>
  ));
}

export default function ComparePanel({ basemap, productFamilies, onExit }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<Map | null>(null);
  const leftLayerRef = useRef<ImageLayer<ImageWMS> | null>(null);
  const rightLayerRef = useRef<ImageLayer<ImageWMS> | null>(null);
  const positionRef = useRef(50);

  const [position, setPosition] = useState(50);
  const draggingRef = useRef(false);

  const [leftIndicatorId, setLeftIndicatorId] = useState<string>("");
  const [rightIndicatorId, setRightIndicatorId] = useState<string>("");
  const [leftDates, setLeftDates] = useState<ProductDate[]>([]);
  const [rightDates, setRightDates] = useState<ProductDate[]>([]);
  const [leftDateLayer, setLeftDateLayer] = useState("");
  const [rightDateLayer, setRightDateLayer] = useState("");
  const [leftLoading, setLeftLoading] = useState(false);
  const [rightLoading, setRightLoading] = useState(false);

  const allIndicators = useMemo(() => {
    const list: ProductIndicator[] = [];
    for (const f of productFamilies) for (const ind of f.indicators) if (ind.dates_count > 0) list.push(ind);
    return list;
  }, [productFamilies]);

  const groups = useMemo(() => {
    return productFamilies
      .map((f) => ({ label: f.label_fr, indicators: f.indicators.filter((i) => i.dates_count > 0) }))
      .filter((g) => g.indicators.length > 0);
  }, [productFamilies]);

  const leftIndicator = allIndicators.find((i) => i.id === leftIndicatorId) ?? null;
  const rightIndicator = allIndicators.find((i) => i.id === rightIndicatorId) ?? null;

  useEffect(() => {
    if (allIndicators.length > 0 && !leftIndicatorId) {
      setLeftIndicatorId(allIndicators[0].id);
      setRightIndicatorId(allIndicators.length > 1 ? allIndicators[1].id : allIndicators[0].id);
    }
  }, [allIndicators]); // eslint-disable-line react-hooks/exhaustive-deps

  const loadDates = (indicatorId: string, side: "left" | "right") => {
    const setDates = side === "left" ? setLeftDates : setRightDates;
    const setLayer = side === "left" ? setLeftDateLayer : setRightDateLayer;
    const setLoading = side === "left" ? setLeftLoading : setRightLoading;
    setLoading(true);
    setDates([]);
    setLayer("");
    fetchProductDates(indicatorId)
      .then((dates) => {
        const indicator = allIndicators.find((item) => item.id === indicatorId);
        const displayDates = indicator?.temporal_step === "month" ? uniqueMonthlyDates(dates) : dates;
        setDates(displayDates);
        if (displayDates.length) setLayer(side === "left" ? displayDates[0].layer_name : displayDates[displayDates.length - 1].layer_name);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  };

  useEffect(() => { if (leftIndicatorId) loadDates(leftIndicatorId, "left"); }, [leftIndicatorId]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (rightIndicatorId) loadDates(rightIndicatorId, "right"); }, [rightIndicatorId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Init OL map
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const proj = getProjection("EPSG:8857")!;

    const initialBasemapUrl = BASEMAPS[basemap].tiles[0];
    const baseTile = new TileLayer({
      source: new XYZ({ url: initialBasemapUrl ?? BASEMAPS.clair.tiles[0], projection: "EPSG:3857", tileGrid: TILE_GRID, crossOrigin: "anonymous" }),
      visible: Boolean(initialBasemapUrl),
    });

    const leftWms = new ImageLayer({ source: new ImageWMS({ url: WMS_BASE, params: { LAYERS: "", TRANSPARENT: "true" }, serverType: "geoserver", ratio: 1 }) });
    const rightWms = new ImageLayer({ source: new ImageWMS({ url: WMS_BASE, params: { LAYERS: "", TRANSPARENT: "true" }, serverType: "geoserver", ratio: 1 }) });

    leftWms.on("prerender", (evt: RenderEvent) => {
      const ctx = evt.context as CanvasRenderingContext2D;
      const mapSize = mapRef.current?.getSize();
      if (!ctx || !mapSize) return;
      const w = getRenderPixel(evt, [mapSize[0] * positionRef.current / 100, 0])[0];
      const tl = getRenderPixel(evt, [0, 0]);
      const br = getRenderPixel(evt, [mapSize[0], mapSize[1]]);
      ctx.save();
      ctx.beginPath();
      ctx.rect(tl[0], tl[1], w - tl[0], br[1] - tl[1]);
      ctx.clip();
    });
    leftWms.on("postrender", (evt: RenderEvent) => {
      (evt.context as CanvasRenderingContext2D)?.restore();
    });

    rightWms.on("prerender", (evt: RenderEvent) => {
      const ctx = evt.context as CanvasRenderingContext2D;
      const mapSize = mapRef.current?.getSize();
      if (!ctx || !mapSize) return;
      const w = getRenderPixel(evt, [mapSize[0] * positionRef.current / 100, 0])[0];
      const tl = getRenderPixel(evt, [0, 0]);
      const br = getRenderPixel(evt, [mapSize[0], mapSize[1]]);
      ctx.save();
      ctx.beginPath();
      ctx.rect(w, tl[1], br[0] - w, br[1] - tl[1]);
      ctx.clip();
    });
    rightWms.on("postrender", (evt: RenderEvent) => {
      (evt.context as CanvasRenderingContext2D)?.restore();
    });

    const map = new Map({
      target: containerRef.current,
      layers: [baseTile, leftWms, rightWms],
      view: new View({
        projection: proj,
        center: [1_500_000, 500_000],
        zoom: 3.4,
      }),
      controls: [],
    });

    mapRef.current = map;
    leftLayerRef.current = leftWms;
    rightLayerRef.current = rightWms;

    return () => { map.setTarget(undefined); mapRef.current = null; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Update basemap
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const base = map.getLayers().item(0) as TileLayer<XYZ>;
    const url = BASEMAPS[basemap].tiles[0];
    base.setVisible(Boolean(url));
    if (url) base.getSource()?.setUrl(url);
  }, [basemap]);

  // Update left WMS
  useEffect(() => {
    const src = leftLayerRef.current?.getSource();
    if (!src) return;
    if (!leftDateLayer) { src.updateParams({ LAYERS: "" }); return; }
    const layerNames = leftDateLayer.includes(":") ? leftDateLayer : leftDateLayer.split(",").map((n) => `geossia:${n}`).join(",");
    const sld = leftIndicator ? sldForProduct(leftIndicator.id, leftDateLayer) : undefined;
    const leftDate = leftDates.find((d) => d.layer_name === leftDateLayer);
    src.updateParams({
      LAYERS: layerNames,
      ...(sld ? { SLD_BODY: sld } : {}),
      ...(leftDate?.style && !sld ? { STYLES: leftDate.style } : { STYLES: "" }),
    });
    mapRef.current?.render();
  }, [leftDateLayer, leftIndicator, leftDates]);

  // Update right WMS
  useEffect(() => {
    const src = rightLayerRef.current?.getSource();
    if (!src) return;
    if (!rightDateLayer) { src.updateParams({ LAYERS: "" }); return; }
    const layerNames = rightDateLayer.includes(":") ? rightDateLayer : rightDateLayer.split(",").map((n) => `geossia:${n}`).join(",");
    const sld = rightIndicator ? sldForProduct(rightIndicator.id, rightDateLayer) : undefined;
    const rightDate = rightDates.find((d) => d.layer_name === rightDateLayer);
    src.updateParams({
      LAYERS: layerNames,
      ...(sld ? { SLD_BODY: sld } : {}),
      ...(rightDate?.style && !sld ? { STYLES: rightDate.style } : { STYLES: "" }),
    });
    mapRef.current?.render();
  }, [rightDateLayer, rightIndicator, rightDates]);

  // Re-render map when position changes
  useEffect(() => {
    positionRef.current = position;
    mapRef.current?.render();
  }, [position]);

  const updateFromClientX = useCallback((clientX: number) => {
    const el = containerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    if (rect.width <= 0) return;
    const pct = ((clientX - rect.left) / rect.width) * 100;
    setPosition(Math.min(100, Math.max(0, pct)));
  }, []);

  function onHandlePointerDown(e: React.PointerEvent<HTMLDivElement>) {
    draggingRef.current = true;
    e.currentTarget.setPointerCapture(e.pointerId);
    updateFromClientX(e.clientX);
  }
  function onHandlePointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (!draggingRef.current) return;
    updateFromClientX(e.clientX);
  }
  function onHandlePointerUp(e: React.PointerEvent<HTMLDivElement>) {
    draggingRef.current = false;
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
  }

  const leftDate = leftDates.find((d) => d.layer_name === leftDateLayer);
  const rightDate = rightDates.find((d) => d.layer_name === rightDateLayer);

  return (
    <div className="compare-panel">
      <div className="compare-controls">
        <label className="compare-control compare-control--left">
          <span>Gauche</span>
          <select value={leftIndicatorId} onChange={(e) => setLeftIndicatorId(e.target.value)}>
            {groups.map((g) => (
              <optgroup key={g.label} label={g.label}>
                {g.indicators.map((i) => <option key={i.id} value={i.id}>{i.label_fr}</option>)}
              </optgroup>
            ))}
          </select>
          <select value={leftDateLayer} disabled={leftLoading || leftDates.length === 0} onChange={(e) => setLeftDateLayer(e.target.value)}>
            {leftLoading && <option value="">Chargement…</option>}
            <DateOptions indicator={leftIndicator} dates={leftDates} />
          </select>
        </label>
        <label className="compare-control compare-control--right">
          <span>Droite</span>
          <select value={rightIndicatorId} onChange={(e) => setRightIndicatorId(e.target.value)}>
            {groups.map((g) => (
              <optgroup key={g.label} label={g.label}>
                {g.indicators.map((i) => <option key={i.id} value={i.id}>{i.label_fr}</option>)}
              </optgroup>
            ))}
          </select>
          <select value={rightDateLayer} disabled={rightLoading || rightDates.length === 0} onChange={(e) => setRightDateLayer(e.target.value)}>
            {rightLoading && <option value="">Chargement…</option>}
            <DateOptions indicator={rightIndicator} dates={rightDates} />
          </select>
        </label>
      </div>

      <div className="compare-stage" ref={containerRef}>
        {leftDate && leftIndicator && (
          <span className="compare-badge compare-badge--left">{leftIndicator.label_fr} · {dateLabel(leftIndicator, leftDate)}</span>
        )}
        {rightDate && rightIndicator && (
          <span className="compare-badge compare-badge--right">{rightIndicator.label_fr} · {dateLabel(rightIndicator, rightDate)}</span>
        )}

        <div className="compare-line" style={{ left: `${position}%` }} />
        <div
          className="compare-hitarea"
          style={{ left: `${position}%` }}
          role="slider"
          tabIndex={0}
          aria-label="Curseur de comparaison"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(position)}
          onPointerDown={onHandlePointerDown}
          onPointerMove={onHandlePointerMove}
          onPointerUp={onHandlePointerUp}
          onPointerCancel={onHandlePointerUp}
          onKeyDown={(e) => {
            if (e.key === "ArrowLeft") setPosition((p) => Math.max(0, p - 2));
            else if (e.key === "ArrowRight") setPosition((p) => Math.min(100, p + 2));
          }}
        >
          <div className="compare-handle">
            <span>◂</span>
            <span>▸</span>
          </div>
        </div>

        {leftDate && leftIndicator && (
          <aside className="compare-legend compare-legend--left">
            <strong>{leftIndicator.label_fr}</strong>
            {leftIndicator.unit && <small>{leftIndicator.unit}</small>}
            <img src={legendUrl(leftDate)} alt={`Légende ${leftIndicator.label_fr}`} />
          </aside>
        )}
        {rightDate && rightIndicator && (
          <aside className="compare-legend compare-legend--right">
            <strong>{rightIndicator.label_fr}</strong>
            {rightIndicator.unit && <small>{rightIndicator.unit}</small>}
            <img src={legendUrl(rightDate)} alt={`Légende ${rightIndicator.label_fr}`} />
          </aside>
        )}

        <button type="button" className="compare-exit" onClick={onExit}>
          <Icon name="close" size={14} /> Quitter la comparaison
        </button>
      </div>
    </div>
  );
}
