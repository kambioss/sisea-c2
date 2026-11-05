import { Link } from "react-router-dom";
import { PageHero, useTitle } from "../components/Layout";

export default function NotFoundPage() {
  useTitle("Page introuvable");
  return (
    <PageHero eyebrow="Erreur 404" title="Page introuvable" lead="Cette adresse ne correspond à aucune page du site Climat & Alertes.">
      <Link to="/" className="btn btn-dark">Retour à l'accueil</Link>
    </PageHero>
  );
}
