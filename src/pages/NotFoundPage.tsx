import { Link } from "react-router-dom";

export default function NotFoundPage() {
  return (
    <div className="container notfound">
      <div className="eyebrow" style={{ justifyContent: "center", marginBottom: 16 }}>
        404
      </div>
      <h1>Page introuvable</h1>
      <p>
        Cette page n'existe pas ou a été déplacée.
        <br />
        Peut-être cherchiez-vous le catalogue ou le géoportail ?
      </p>
      <div style={{ display: "flex", gap: 12, justifyContent: "center", marginTop: 8 }}>
        <Link to="/" className="btn btn-clay">Retour à l'accueil</Link>
        <Link to="/geoportail" className="btn btn-ghost">Géoportail ↗</Link>
      </div>
    </div>
  );
}
