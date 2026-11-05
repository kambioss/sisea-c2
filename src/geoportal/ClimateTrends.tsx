// Climate-trend tools of the géoportail, after the main portal's Results
// panel: a drawer with annual stripes, seasonal stripes and the evolution
// with CMIP6 scenarios for the selected zone, and an animated-map bar that
// colours every country by its annual anomaly from 1901 to 2100.

import { useEffect, useState } from "react";
import { Icon } from "../components/Icon";
import { LineChart, LineSeries } from "../components/charts";
import { RampLegend, SeasonalGrid, StripeRows } from "../components/trendCharts";
import { SSPS, Ssp, TREND_VARIABLES, TrendData, TrendVariable, isTemperature, loadTrend, rampFor } from "../data/climateTrends";
import { Segmented } from "./controls";

type View = "bandes" | "saisons" | "evolution";

export function TrendsDrawer({ code, title, variable, ssp, onVariable, onSsp, onClose }: { code: string; title: string; variable: TrendVariable; ssp: Ssp | "obs"; onVariable(v: TrendVariable): void; onSsp(s: Ssp | "obs"): void; onClose(): void }) {
  const [data, setData] = useState<TrendData | null | undefined>(undefined);
  const [view, setView] = useState<View>("bandes");
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    let live = true;
    setData(undefined);
    loadTrend(code, variable).then((d) => live && setData(d));
    return () => {
      live = false;
    };
  }, [code, variable]);

  const temp = isTemperature(variable);
  const { ramp, range } = rampFor(variable);
  const shownView: View = !temp && view === "evolution" ? "bandes" : view;
  const model = data?.models.find((m) => m.id === ssp);

  // "Observé seul" keeps the observed years only, as in the main portal.
  const years = data ? (model ? data.years : data.years.filter((y) => y <= data.lastObs)) : [];
  const cut = <T,>(values: T[]) => values.slice(0, years.length);

  const evolution: LineSeries[] = data && temp
    ? [
        { name: "Observé (CRU)", color: "#1b2533", start: data.years[0], values: data.observed },
        ...(data.models[0] ? [{ name: "Modèles, historique", color: "#8a9a96", start: data.years[0], values: data.models[0].annual.map((v, i) => (data.years[i] <= 2014 ? v : null)) }] : []),
        ...data.models.map((m) => ({ name: m.label, color: m.color, start: data.years[0], values: m.annual.map((v, i) => (data.years[i] >= 2014 ? v : null)) })),
      ]
    : [];

  return (
    <section className={expanded ? "trends-drawer expanded" : "trends-drawer"} aria-label="Tendances climatiques">
      <header className="td-head">
        <div className="td-title">
          <span className="eyebrow"><Icon name="trend" size={14} /> Tendances climatiques</span>
          <strong>{title}</strong>
        </div>
        <Segmented size="sm" value={variable} options={TREND_VARIABLES.map((v) => ({ id: v.id, label: v.label }))} onChange={onVariable} />
        <div className="td-actions">
          <button className="icon-btn" onClick={() => setExpanded((v) => !v)} aria-label={expanded ? "Réduire" : "Agrandir"} title={expanded ? "Réduire" : "Agrandir"}>
            <Icon name={expanded ? "chevronDown" : "arrowUpRight"} size={16} />
          </button>
          <button className="icon-btn" onClick={onClose} aria-label="Fermer"><Icon name="close" size={16} /></button>
        </div>
      </header>

      <div className="td-body">
        <aside className="td-side">
          {data?.stats.map((s) => (
            <div key={s.label} className="td-stat">
              <span>{s.label}</span>
              <strong>{s.value}</strong>
              <small>{s.note}</small>
            </div>
          ))}
        </aside>

        <div className="td-main">
          <div className="td-toolbar">
            <div className="td-tabs" role="tablist">
              <button role="tab" aria-selected={shownView === "bandes"} className={shownView === "bandes" ? "on" : ""} onClick={() => setView("bandes")}>Bandes</button>
              <button role="tab" aria-selected={shownView === "saisons"} className={shownView === "saisons" ? "on" : ""} onClick={() => setView("saisons")}>Bandes saisonnières</button>
              {temp && <button role="tab" aria-selected={shownView === "evolution"} className={shownView === "evolution" ? "on" : ""} onClick={() => setView("evolution")}>Évolution</button>}
            </div>
            {temp && shownView !== "evolution" && (
              <div className="select inline compact">
                <select value={ssp} onChange={(e) => onSsp(e.target.value as Ssp | "obs")} aria-label="Scénario">
                  {SSPS.map((s) => <option key={s.id} value={s.id}>Observé + modèles {s.label}</option>)}
                  <option value="obs">Observé seul</option>
                </select>
                <Icon name="chevronDown" size={14} />
              </div>
            )}
            {shownView !== "evolution" && <RampLegend ramp={ramp} range={range} unit={temp ? "°C" : ""} />}
          </div>

          {data === undefined && <div className="td-empty">Chargement des séries…</div>}
          {data === null && <div className="td-empty">Pas de série disponible pour cette zone et cette variable.</div>}
          {data && shownView === "bandes" && (
            <StripeRows
              years={years}
              lastObs={data.lastObs}
              ramp={ramp}
              range={range}
              unit={data.unit}
              rows={model ? [{ label: "Observé", values: cut(data.observed) }, { label: "Modèles", values: cut(model.annual) }] : [{ label: temp ? "Observé" : data.name, values: cut(data.observed) }]}
            />
          )}
          {data && shownView === "saisons" && (
            <SeasonalGrid years={years} monthly={data.monthly} seasons={model?.seasons} lastObs={data.lastObs} ramp={ramp} range={range} unit={data.unit} />
          )}
          {data && shownView === "evolution" && <LineChart series={evolution} height={expanded ? 300 : 210} width={1000} yLabel="°C vs 1961-1990" />}
          {data && <p className="td-note">{data.note}</p>}
        </div>
      </div>
    </section>
  );
}

export function TimelapseBar({ variable, ssp, year, first, last, lastObs, playing, onVariable, onSsp, onYear, onPlay, onClose }: {
  variable: TrendVariable; ssp: Ssp; year: number; first: number; last: number; lastObs: number; playing: boolean;
  onVariable(v: TrendVariable): void; onSsp(s: Ssp): void; onYear(y: number): void; onPlay(): void; onClose(): void;
}) {
  const temp = isTemperature(variable);
  const { ramp, range } = rampFor(variable);
  const projected = year > lastObs;
  return (
    <section className="timelapse" aria-label="Carte animée">
      <div className="tl-row">
        <button className="tl-play" onClick={onPlay} aria-label={playing ? "Pause" : "Lecture"}>
          {playing ? <svg width="14" height="14" viewBox="0 0 14 14"><rect x="2" y="1" width="3.5" height="12" rx="1" fill="currentColor" /><rect x="8.5" y="1" width="3.5" height="12" rx="1" fill="currentColor" /></svg>
            : <svg width="14" height="14" viewBox="0 0 14 14"><path d="M3 1.5v11l9.5-5.5L3 1.5Z" fill="currentColor" /></svg>}
        </button>
        <div className="tl-year">
          <strong>{year}</strong>
          <small>{projected ? `Projection ${SSPS.find((s) => s.id === ssp)?.label}` : "Observé"}</small>
        </div>
        <div className="tl-slider">
          <input type="range" min={first} max={last} value={year} onChange={(e) => onYear(Number(e.target.value))} aria-label="Année" />
          <div className="tl-scale">
            <span>{first}</span>
            {temp && last > lastObs && <span className="tl-obs" style={{ left: `${((lastObs - first) / (last - first)) * 100}%` }}>{lastObs} · fin des observations</span>}
            <span>{last}</span>
          </div>
        </div>
        <button className="icon-btn" onClick={onClose} aria-label="Fermer la carte animée"><Icon name="close" size={16} /></button>
      </div>
      <div className="tl-row controls">
        <Segmented size="sm" value={variable} options={TREND_VARIABLES.map((v) => ({ id: v.id, label: v.label }))} onChange={onVariable} />
        {temp && <Segmented size="sm" value={ssp} options={SSPS.map((s) => ({ id: s.id, label: s.label }))} onChange={onSsp} />}
        <RampLegend ramp={ramp} range={range} unit={temp ? "°C" : ""} />
      </div>
    </section>
  );
}
