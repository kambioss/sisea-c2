import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Icon } from "../components/Icon";
import { Loading, PageHero, useBundle, useTitle } from "../components/Layout";
import { Sparkline } from "../components/charts";
import { Segmented } from "../geoportal/controls";
import { ALERT_LEVELS, AlertLevel, fmt, monthLabel } from "../data/indicators";
import { COUNTRIES, REGIONS, regionName } from "../data/countries";

type SortKey = "spi3" | "spi1" | "spi12" | "name";

export default function AlertsPage() {
  useTitle("Alertes");
  const { bundle, error } = useBundle();
  const [region, setRegion] = useState("all");
  const [minLevel, setMinLevel] = useState<AlertLevel>(0);
  const [sort, setSort] = useState<SortKey>("spi3");

  const rows = useMemo(() => {
    if (!bundle) return [];
    return COUNTRIES.map((c) => ({ country: c, zone: bundle.zones[c.iso3] }))
      .filter((r) => r.zone && (region === "all" || r.country.region === region) && r.zone.alerts.drought_level >= minLevel)
      .sort((a, b) => (sort === "name" ? a.country.name.localeCompare(b.country.name, "fr") : (a.zone.alerts[sort] ?? 9) - (b.zone.alerts[sort] ?? 9)));
  }, [bundle, region, minLevel, sort]);

  const counts = useMemo(() => {
    const out = [0, 0, 0, 0];
    if (bundle) for (const c of COUNTRIES) out[bundle.zones[c.iso3]?.alerts.drought_level ?? 0] += 1;
    return out;
  }, [bundle]);

  const month = bundle?.zones.AFR.alerts.spi_month ?? null;

  return (
    <>
      <PageHero
        eyebrow={`Bulletin · ${monthLabel(month)}`}
        title="Alertes sécheresse"
        lead="Niveau d'alerte de chaque pays, dérivé de l'indice de précipitations standardisé sur 3 mois (SPI-3, CHIRPS) selon les classes de sécheresse de l'Organisation météorologique mondiale."
      />
      <section className="section tight">
        <div className="container">
          <div className="level-summary">
            {ALERT_LEVELS.map((l) => (
              <button key={l.level} className={minLevel === l.level ? "level-box on" : "level-box"} onClick={() => setMinLevel(l.level)}>
                <i style={{ background: l.color }} />
                <strong>{counts[l.level]}</strong>
                <span>{l.label}</span>
                <small>{l.range}</small>
              </button>
            ))}
          </div>

          <div className="toolbar">
            <Segmented size="sm" value={region} options={[{ id: "all", label: "Toutes" }, ...REGIONS.map((r) => ({ id: r.id, label: r.short }))]} onChange={setRegion} />
            <div className="select inline">
              <select value={sort} onChange={(e) => setSort(e.target.value as SortKey)} aria-label="Trier par">
                <option value="spi3">Trier : SPI-3 (plus sec d'abord)</option>
                <option value="spi1">Trier : SPI-1</option>
                <option value="spi12">Trier : SPI-12</option>
                <option value="name">Trier : nom du pays</option>
              </select>
              <Icon name="chevronDown" size={16} />
            </div>
            <span className="muted small">{minLevel > 0 ? `Niveau ≥ ${ALERT_LEVELS[minLevel].label} · ` : ""}{rows.length} pays</span>
          </div>

          {!bundle ? (
            <Loading error={error} />
          ) : (
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Pays</th>
                    <th>Niveau</th>
                    <th className="num">SPI-1</th>
                    <th className="num">SPI-3</th>
                    <th className="num">SPI-12</th>
                    <th>SPI-3 · 36 mois</th>
                    <th aria-label="Carte" />
                  </tr>
                </thead>
                <tbody>
                  {rows.map(({ country, zone }) => {
                    const level = ALERT_LEVELS[zone.alerts.drought_level];
                    return (
                      <tr key={country.iso3}>
                        <td><strong>{country.name}</strong><small>{regionName(country.region)}</small></td>
                        <td><span className="level-tag" style={{ background: level.color }}>{level.label}</span></td>
                        <td className="num">{fmt(zone.alerts.spi1, 2, true)}</td>
                        <td className="num strong">{fmt(zone.alerts.spi3, 2, true)}</td>
                        <td className="num">{fmt(zone.alerts.spi12, 2, true)}</td>
                        <td><Sparkline values={zone.series.spi3_recent.values} width={150} height={28} color="#6660c8" /></td>
                        <td><Link to={`/geoportail?ind=drought-alert&pays=${country.iso3}`} className="icon-btn" aria-label={`Voir ${country.name} sur la carte`}><Icon name="arrowUpRight" size={16} /></Link></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          <div className="note-grid">
            <div className="note">
              <h4><Icon name="info" size={16} /> Méthode</h4>
              <p>Le SPI compare le cumul de pluie d'une période à sa distribution 1991-2020 (loi gamma, méthode OMM) et l'exprime en écarts-types. Le SPI-3 du dernier mois disponible fixe le niveau d'alerte.</p>
            </div>
            <div className="note">
              <h4><Icon name="alert" size={16} /> Précautions</h4>
              <p>À l'échelle d'un pays entier, le SPI moyen peut masquer des contrastes locaux. En saison sèche, de faibles écarts absolus de pluie donnent des SPI extrêmes : confirmez avec le calendrier cultural et les observations de terrain.</p>
            </div>
            <div className="note">
              <h4><Icon name="fire" size={16} /> Autres aléas</h4>
              <p>Les feux actifs FIRMS des trois derniers jours peuvent être superposés sur le <Link to="/geoportail?ind=drought-alert">géoportail</Link> (menu Surcouches) lorsque le GeoServer GEOSSIA est accessible.</p>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
