import { useState } from "react";
import { Link } from "react-router-dom";
import data from "../data/indicators.json";
import { Check, ArrowRight } from "../components/Icon";
import { COUNTRIES, countryName } from "../data/countries";

const ALERT_OPTIONS = [
  { id: "drought", label: "Sécheresse" },
  { id: "flood", label: "Inondations" },
  { id: "fire", label: "Feux" },
  { id: "heavy_rain", label: "Pluies extrêmes" },
] as const;

export default function BulletinPage() {
  const [email, setEmail] = useState("");
  const [country, setCountry] = useState("");
  const [alertTypes, setAlertTypes] = useState<string[]>(ALERT_OPTIONS.map((option) => option.id));
  const [receiveAlerts, setReceiveAlerts] = useState(true);
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !country) return;
    setSubmitting(true);
    setError(null);
    try {
      const response = await fetch("/catalog-api/api/v1/bulletin/subscriptions", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({
          email,
          country_iso3: country,
          locale: "fr",
          alert_types: alertTypes,
          min_alert_level: 2,
          receive_bulletin: true,
          receive_alerts: receiveAlerts,
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(typeof payload.detail === "string" ? payload.detail : "Inscription impossible");
      setSubmitted(true);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Le service d’abonnement est indisponible.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <section className="page-hero" style={{ minHeight: "50vh" }}>
        <div className="page-hero-bg" style={{ backgroundImage: "url(/images/drought-texture.jpg)" }} aria-hidden="true" />
        <div className="container page-hero-inner">
          <div className="kicker light"><span style={{ color: "var(--forest-light)" }}>●</span> Bulletin mensuel</div>
          <h1>Recevez le bulletin <em>chaque mois</em></h1>
          <p className="lead light">
            Le bulletin d'alertes sécheresse GEOSSIA paraît le 5 de chaque mois.
            Abonnez-vous pour le recevoir par email, accompagné des analyses
            et des fiches pays prioritaires.
          </p>
        </div>
      </section>

      <section className="section tight">
        <div className="container" style={{ maxWidth: 720 }}>
          {/* Subscribe form */}
          <div className="card" style={{ padding: 40, marginBottom: 32 }}>
            {submitted ? (
              <div style={{ textAlign: "center", padding: 20 }}>
                <div style={{
                  width: 64, height: 64,
                  margin: "0 auto 20px",
                  borderRadius: "50%",
                  background: "var(--sage-bg)",
                  display: "grid", placeItems: "center",
                  color: "var(--forest-2)",
                }}>
                  <Check size={32} />
                </div>
                <h2 style={{ fontSize: 26, marginBottom: 10 }}>Inscription confirmée !</h2>
                <p style={{ color: "var(--ink-2)", fontSize: 15, maxWidth: 460, margin: "0 auto" }}>
                  Votre abonnement pour <strong>{countryName(country)}</strong> est actif à l’adresse{" "}
                  <strong>{email}</strong>. Le bulletin et les alertes sélectionnées seront ciblés sur ce pays.
                </p>
                <Link to="/" className="btn btn-green" style={{ marginTop: 24 }}>
                  Retour à l'accueil <ArrowRight size={14} />
                </Link>
              </div>
            ) : (
              <>
                <h2 style={{ fontSize: 26, marginBottom: 10 }}>S'abonner au bulletin</h2>
                <p style={{ color: "var(--ink-2)", fontSize: 14, marginBottom: 24 }}>
                  Gratuit, sans publicité. Désabonnement en un clic.
                </p>
                <form onSubmit={handleSubmit} className="bulletin-subscription-form">
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="vous@exemple.org"
                    className="bulletin-field"
                  />
                  <select className="bulletin-field" required value={country} onChange={(event) => setCountry(event.target.value)}>
                    <option value="">Sélectionnez votre pays</option>
                    {COUNTRIES.slice().sort((a, b) => a.name.localeCompare(b.name, "fr")).map((item) => (
                      <option key={item.iso3} value={item.iso3}>{item.name}</option>
                    ))}
                  </select>
                  <fieldset className="bulletin-preferences">
                    <legend>Alertes à recevoir pour ce pays</legend>
                    <label className="bulletin-channel">
                      <input type="checkbox" checked={receiveAlerts} onChange={(event) => setReceiveAlerts(event.target.checked)} />
                      Recevoir les alertes dès le niveau « avertissement »
                    </label>
                    {receiveAlerts && <div className="bulletin-alert-types">
                      {ALERT_OPTIONS.map((option) => <label key={option.id}>
                        <input type="checkbox" checked={alertTypes.includes(option.id)} onChange={(event) => setAlertTypes((current) => event.target.checked ? [...current, option.id] : current.filter((item) => item !== option.id))} />
                        {option.label}
                      </label>)}
                    </div>}
                  </fieldset>
                  {error && <p className="bulletin-form-error" role="alert">{error}</p>}
                  <button type="submit" className="btn btn-orange lg" disabled={submitting || !country || (receiveAlerts && alertTypes.length === 0)}>
                    {submitting ? "Inscription…" : "S'abonner"} <ArrowRight size={14} />
                  </button>
                </form>
                <p className="footnote" style={{ marginTop: 14 }}>
                  En vous abonnant, vous acceptez de recevoir les communications GEOSSIA.
                  Vos données ne sont jamais partagées.
                </p>
              </>
            )}
          </div>

          {/* What you get */}
          <div style={{ marginTop: 56, marginBottom: 56 }}>
            <div className="kicker" style={{ marginBottom: 10, display: "block" }}>Ce que vous recevez</div>
            <h2 style={{ fontSize: 28, marginBottom: 24 }}>Le contenu du <em>bulletin mensuel</em></h2>

            <div className="theme-grid-3" style={{ gridTemplateColumns: "repeat(3, 1fr)" }}>
            <div className="card">
              <h3 style={{ fontSize: 17, marginBottom: 8 }}>Synthèse régionale</h3>
              <p style={{ fontSize: 13.5, color: "var(--ink-2)" }}>
                Carte des 15 pays colorés par niveau d'alerte, KPI clés et comparaison
                avec le mois précédent.
              </p>
            </div>
            <div className="card">
              <h3 style={{ fontSize: 17, marginBottom: 8 }}>Pays prioritaires</h3>
              <p style={{ fontSize: 13.5, color: "var(--ink-2)" }}>
                Fiches détaillées des pays en alerte : SPI-3, évolution 6 mois,
                recommandations opérationnelles.
              </p>
            </div>
            <div className="card">
              <h3 style={{ fontSize: 17, marginBottom: 8 }}>Analyses contextuelles</h3>
              <p style={{ fontSize: 13.5, color: "var(--ink-2)" }}>
                Feux actifs FIRMS, projections saisonnières, comparaisons historiques
                sur 40 ans.
              </p>
            </div>
            </div>
          </div>

          {/* Past bulletins */}
          <div style={{ marginBottom: 24 }}>
            <div className="kicker" style={{ marginBottom: 10, display: "block" }}>Archives</div>
            <h2 style={{ fontSize: 24, marginBottom: 24 }}>Bulletins <em>précédents</em></h2>
          </div>
          <div className="resources-grid" style={{ gridTemplateColumns: "repeat(2, 1fr)" }}>
            {data.resources.filter((r) => r.kind === "Bulletin").map((r, i) => (
              <article key={i} className="resource-card">
                <span className="resource-kind">{r.kind}</span>
                <h4>{r.title}</h4>
                <p>{r.publisher} · {new Date(r.date).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" })}</p>
                <div className="resource-meta">
                  <span>{r.format.split(" · ")[0]}</span>
                  <span>→</span>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
