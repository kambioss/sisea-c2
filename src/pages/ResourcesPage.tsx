import { useState } from "react";
import { Icon } from "../components/Icon";
import { PageHero, useTitle } from "../components/Layout";
import { Segmented } from "../geoportal/controls";
import { RESOURCES, RESOURCE_KINDS, ResourceKind } from "../data/resources";

export default function ResourcesPage() {
  useTitle("Ressources");
  const [kind, setKind] = useState<ResourceKind | "all">("all");
  const [query, setQuery] = useState("");
  const q = query.trim().toLowerCase();
  const list = RESOURCES.filter((r) => (kind === "all" || r.kind === kind) && (!q || `${r.title} ${r.publisher} ${r.description} ${r.tags.join(" ")}`.toLowerCase().includes(q)));

  return (
    <>
      <PageHero
        eyebrow="Centre de ressources"
        title="Données, méthodes et outils"
        lead="Les jeux de données sources, les méthodes de calcul et les portails partenaires derrière les indicateurs, ainsi que les fichiers de ce site en téléchargement libre."
      >
        <div className="toolbar">
          <Segmented<ResourceKind | "all"> size="sm" value={kind} options={RESOURCE_KINDS} onChange={setKind} />
          <label className="search-field">
            <Icon name="search" size={16} />
            <input placeholder="Rechercher une ressource" value={query} onChange={(e) => setQuery(e.target.value)} />
          </label>
        </div>
      </PageHero>
      <section className="section tight">
        <div className="container resource-list">
          {list.length === 0 && <p className="muted">Aucune ressource ne correspond à cette recherche.</p>}
          {list.map((r) => {
            const external = r.url.startsWith("http");
            return (
              <article key={r.id} className="resource-row">
                <span className={`kind-icon ${r.kind}`}>
                  <Icon name={r.kind === "telechargement" ? "download" : r.kind === "methode" ? "book" : r.kind === "outil" ? "globe" : "layers"} size={20} />
                </span>
                <div className="resource-body">
                  <h3>{r.title}</h3>
                  <p className="publisher">{r.publisher}</p>
                  <p>{r.description}</p>
                  <div className="tags">
                    <span className="resource-format">{r.format}</span>
                    {r.tags.map((t) => <span key={t} className="tag">{t}</span>)}
                  </div>
                </div>
                <a href={r.url} className="btn btn-ghost sm" target={external ? "_blank" : undefined} rel="noreferrer" download={external ? undefined : ""}>
                  {external ? <>Consulter <Icon name="arrowUpRight" size={15} /></> : <>Télécharger <Icon name="download" size={15} /></>}
                </a>
              </article>
            );
          })}
        </div>
      </section>
    </>
  );
}
