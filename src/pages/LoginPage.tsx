import { Link } from "react-router-dom";
import { BirdLogo } from "../components/BirdLogo";
import { useAuth } from "../context/AuthContext";

export default function LoginPage() {
  const { ready, authenticated, name, login, logout } = useAuth();
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

            {authenticated ? (
              <div style={{ display: "grid", gap: 14, textAlign: "center" }}>
                <p>Connecté{ name ? ` en tant que ${name}` : ""}.</p>
                <Link to="/geoportail" className="btn btn-green lg block">Ouvrir le géoportail climat</Link>
                <button type="button" className="btn block" onClick={logout}>Se déconnecter</button>
              </div>
            ) : (
              <button type="button" className="btn btn-green lg block" disabled={!ready} onClick={() => login("/geoportail")}>
                {ready ? "Se connecter avec GEOSSIA" : "Préparation de la connexion…"}
              </button>
            )}

            <div style={{ marginTop: 28, paddingTop: 24, borderTop: "var(--hairline)", textAlign: "center" }}>
              <p style={{ fontSize: 13.5, color: "var(--ink-2)" }}>
                Pas encore de compte ?{" "}
                <button type="button" onClick={() => login("/geoportail")} style={{ border: 0, background: "none", color: "var(--forest-2)", fontWeight: 600, cursor: "pointer" }}>Demander un accès</button>
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
