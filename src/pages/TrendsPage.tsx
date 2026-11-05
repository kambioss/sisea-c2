import { useMemo } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Icon } from "../components/Icon";
import { Loading, PageHero, useBundle, useTitle } from "../components/Layout";
import { LineChart, SpiBars, Stripes } from "../components/charts";
import { ALERT_LEVELS, fmt, monthLabel } from "../data/indicators";
import { COUNTRIES, COUNTRY_BY_ISO3, countryName, regionName } from "../data/countries";

export default function TrendsPage() {
  const [params, setParams] = useSearchParams();
  const zoneId = params.get("pays") && COUNTRY_BY_ISO3.has(params.get("pays")!) ? params.get("pays")! : "AFR";
  const name = countryName(zoneId);
  useTitle(`Tendances — ${name}`);
  const { bundle, error } = useBundle();
  const zone = bundle?.zones[zoneId];

  const fastest = useMemo(() => {
    if (!bundle) return [];
    return COUNTRIES.filter((c) => bundle.zones[c.iso3]?.trends.warming_decade !== null)
      .sort((a, b) => (bundle.zones[b.iso3].trends.warming_decade ?? 0) - (bundle.zones[a.iso3].trends.warming_decade ?? 0))
      .slice(0, 8);
  }, [bundle]);

  const choose = (iso3: string) => setParams(iso3 === "AFR" ? {} : { pays: iso3 }, { replace: true });

  return (
    <>
      <PageHero
        eyebrow="Fiche tendances"
        title={zoneId === "AFR" ? "Afrique" : name}
        lead={zoneId === "AFR" ? "Moyenne pondérée par la surface des 55 pays. Choisissez un pays pour sa fiche." : `${regionName(COUNTRY_BY_ISO3.get(zoneId)!.region)} · températures observées depuis 1901, pluies depuis 1981 et projections CMIP6 jusqu'en 2100.`}
      >
        <div className="select inline hero-select">
          <select value={zoneId} onChange={(e) => choose(e.target.value)} aria-label="Pays">
            <option value="AFR">Afrique — tout le continent</option>
            {COUNTRIES.map((c) => <option key={c.iso3} value={c.iso3}>{c.name}</option>)}
          </select>
          <Icon name="chevronDown" size={16} />
        </div>
      </PageHero>

      {!zone ? (
        <div className="container"><Loading error={error} /></div>
      ) : (
        <section className="section tight">
          <div className="container trends-layout">
            <div className="kpi-row four">
              <div className="kpi"><span>Anomalie {zone.climate.year}</span><strong>{fmt(zone.climate.tmean_anom, 2, true)} °C</strong><small>Tmoy vs 1961-1990</small></div>
              <div className="kpi"><span>Réchauffement</span><strong>{fmt(zone.trends.warming_decade, 2, true)} °C</strong><small>par décennie, 1981-{zone.climate.year}</small></div>
              <div className="kpi"><span>2041-2060</span><strong>{fmt(zone.trends.proj2050_ssp245, 1, true)} / {fmt(zone.trends.proj2050_ssp585, 1, true)} °C</strong><small>SSP2-4.5 / SSP5-8.5</small></div>
              <div className="kpi alert" style={{ borderColor: ALERT_LEVELS[zone.alerts.drought_level].color }}>
                <span>Alerte sécheresse</span><strong>{ALERT_LEVELS[zone.alerts.drought_level].label}</strong><small>SPI-3 {fmt(zone.alerts.spi3, 2, true)} · {monthLabel(zone.alerts.spi_month)}</small>
              </div>
            </div>

            <div className="card wide">
              <div className="card-head"><div><span className="eyebrow">CRU TS 4.09</span><h3>Bandes de réchauffement</h3></div></div>
              <Stripes values={zone.series.tmean_anom.values} start={zone.series.tmean_anom.start} height={110} />
            </div>

            <div className="card wide">
              <div className="card-head"><div><span className="eyebrow">Observé</span><h3>Anomalie annuelle de température moyenne</h3></div></div>
              <LineChart series={[{ name: "Anomalie Tmoy", color: "#5b5bd6", start: zone.series.tmean_anom.start, values: zone.series.tmean_anom.values }]} trendFrom={1981} yLabel="°C vs 1961-1990" />
            </div>

            <div className="card">
              <div className="card-head"><div><span className="eyebrow">CMIP6 · CCKP</span><h3>Projections du changement de température</h3></div></div>
              <LineChart
                height={300} width={460}
                yLabel="°C vs 1995-2014"
                series={[
                  ...(zone.series.proj.ssp126 ? [{ name: "SSP1-2.6", color: "#173c66", ...zone.series.proj.ssp126 }] : []),
                  ...(zone.series.proj.ssp245 ? [{ name: "SSP2-4.5", color: "#f79420", ...zone.series.proj.ssp245 }] : []),
                  ...(zone.series.proj.ssp585 ? [{ name: "SSP5-8.5", color: "#951b1e", ...zone.series.proj.ssp585 }] : []),
                ]}
              />
              <p className="footnote">Médiane d'ensemble des modèles, moyennes annuelles des saisons. Couleurs de scénarios du GIEC AR6.</p>
            </div>

            <div className="card">
              <div className="card-head"><div><span className="eyebrow">CHIRPS v2</span><h3>SPI-12 moyen annuel</h3></div></div>
              <LineChart height={300} width={460} unit="σ" yLabel="SPI-12" series={[{ name: "SPI-12", color: "#3c3f9e", start: zone.series.spi12_year.start, values: zone.series.spi12_year.values }]} trendFrom={zone.series.spi12_year.start} />
              <p className="footnote">Moyenne des mois disponibles ; une tendance négative signale un assèchement progressif.</p>
            </div>

            <div className="card wide">
              <div className="card-head"><div><span className="eyebrow">Alertes</span><h3>SPI-3 — 36 derniers mois</h3></div><Link to={`/geoportail?ind=spi3${zoneId === "AFR" ? "" : `&pays=${zoneId}`}`} className="link-arrow">Carte <Icon name="arrowRight" size={15} /></Link></div>
              <SpiBars values={zone.series.spi3_recent.values} endMonth={zone.series.spi3_recent.end} />
            </div>

            <div className="card wide">
              <div className="card-head"><div><span className="eyebrow">Classement</span><h3>Réchauffement le plus rapide depuis 1981</h3></div></div>
              <ol className="rank-grid">
                {fastest.map((c, i) => (
                  <li key={c.iso3}>
                    <button onClick={() => choose(c.iso3)} className={c.iso3 === zoneId ? "on" : ""}>
                      <span className="rank">{i + 1}</span>
                      <span>{c.name}</span>
                      <strong>{fmt(bundle!.zones[c.iso3].trends.warming_decade, 2, true)} °C/déc.</strong>
                    </button>
                  </li>
                ))}
              </ol>
            </div>
          </div>
        </section>
      )}
    </>
  );
}
