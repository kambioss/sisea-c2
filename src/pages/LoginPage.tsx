import { Link } from "react-router-dom";
import { BirdLogo } from "../components/BirdLogo";

export default function LoginPage() {
  return (
    <>
      <section className="page-hero" style={{ minHeight: "50vh" }}>
        <div className="page-hero-bg" style={{ backgroundImage: "url(/images/sahel-landscape.jpg)" }} aria-hidden="true" />
        <div className="container page-hero-inner">
          <div className="kicker light"><span style={{ color: "var(--forest-light)" }}>●</span> Espace partenaire</div>
          <h1>Connexion à <em>GEOSSIA</em></h1>
          <p className="lead light">
            Accédez à votre espace : tableaux de bord personnalisés, alertes par email,
            historique des bulletins et exports de données.
          </p>
        </div>
      </section>

      <section className="section tight">
        <div className="container" style={{ maxWidth: 480 }}>
          <div className="card" style={{ padding: 40 }}>
            <div style={{ display: "flex", justifyContent: "center", marginBottom: 24 }}>
              <span style={{ color: "var(--forest-2)" }}>
                <BirdLogo size={48} />
              </span>
            </div>
            <h2 style={{ textAlign: "center", fontSize: 26, marginBottom: 8 }}>Bienvenue</h2>
            <p style={{ textAlign: "center", color: "var(--muted)", fontSize: 14, marginBottom: 28, fontFamily: "var(--serif)", fontStyle: "italic" }}>
              Connectez-vous pour accéder à votre tableau de bord.
            </p>

            <form onSubmit={(e) => e.preventDefault()} style={{ display: "grid", gap: 16 }}>
              <div className="field" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <label style={{ fontWeight: 600, fontSize: 13.5 }}>Email professionnel</label>
                <input
                  type="email"
                  placeholder="vous@organisation.gouv"
                  style={{
                    height: 44,
                    padding: "0 14px",
                    border: "1px solid var(--line-2)",
                    borderRadius: "var(--r)",
                    fontSize: 14,
                    background: "var(--surface)",
                  }}
                />
              </div>
              <div className="field" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <label style={{ fontWeight: 600, fontSize: 13.5 }}>Mot de passe</label>
                <input
                  type="password"
                  placeholder="••••••••"
                  style={{
                    height: 44,
                    padding: "0 14px",
                    border: "1px solid var(--line-2)",
                    borderRadius: "var(--r)",
                    fontSize: 14,
                    background: "var(--surface)",
                  }}
                />
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 13 }}>
                <label style={{ display: "flex", alignItems: "center", gap: 8, color: "var(--ink-2)", cursor: "pointer" }}>
                  <input type="checkbox" style={{ accentColor: "var(--forest-2)" }} /> Rester connecté
                </label>
                <a href="#" style={{ color: "var(--forest-2)", fontWeight: 600 }}>Mot de passe oublié ?</a>
              </div>
              <button type="submit" className="btn btn-green lg block" style={{ marginTop: 8 }}>
                Se connecter
              </button>
            </form>

            <div style={{ marginTop: 28, paddingTop: 24, borderTop: "var(--hairline)", textAlign: "center" }}>
              <p style={{ fontSize: 13.5, color: "var(--ink-2)" }}>
                Pas encore de compte ?{" "}
                <Link to="/login" style={{ color: "var(--forest-2)", fontWeight: 600 }}>
                  Demander un accès
                </Link>
              </p>
              <p className="footnote" style={{ marginTop: 16 }}>
                Accès réservé aux agences nationales, partenaires institutionnels
                et équipes de recherche.
              </p>
            </div>
          </div>

          <div style={{ textAlign: "center", marginTop: 24 }}>
            <Link to="/" className="link-arrow" style={{ color: "var(--muted)" }}>
              ← Retour à l'accueil
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
