import { useState, useMemo } from "react";
import data from "../data/indicators.json";
import { FileText, Download, BookOpen, ArrowRight, ChevronDown } from "../components/Icon";

const kinds = [
  { key: "all", label: "Tous" },
  { key: "Rapport national", label: "Rapports nationaux" },
  { key: "Bulletin", label: "Bulletins" },
  { key: "Jeu de données", label: "Données" },
  { key: "Méthode", label: "Méthodes" },
  { key: "Outil", label: "Outils" },
];


interface Resource {
  kind: string;
  title: string;
  publisher: string;
  date: string;
  format: string;
  iso3?: string;
  filename?: string;
  url?: string;
  description?: string;
  country?: string;
  docType?: string;
}

const DOC_TYPE_META: Record<string, { label: string; icon: typeof FileText }> = {
  NDC: { label: "Contributions déterminées au niveau national (CDN)", icon: FileText },
  BTR: { label: "Rapports biennaux de transparence (BTR)", icon: BookOpen },
  NID: { label: "Rapports nationaux d'inventaire des GES (NID)", icon: BookOpen },
  NC:  { label: "Communications nationales (NC)", icon: FileText },
};

const DOC_TYPE_ORDER = ["NDC", "BTR", "NID", "NC"];

const KIND_META: Record<string, { label: string; icon: typeof FileText }> = {
  "Bulletin": { label: "Bulletins", icon: FileText },
  "Jeu de données": { label: "Jeux de données", icon: Download },
  "Méthode": { label: "Méthodes", icon: BookOpen },
  "Outil": { label: "Outils & portails", icon: BookOpen },
};

const KIND_ORDER = ["Bulletin", "Jeu de données", "Méthode", "Outil"];

function ReportAccordion({ docType, docs }: { docType: string; docs: Resource[] }) {
  const [open, setOpen] = useState(false);
  const meta = DOC_TYPE_META[docType] ?? { label: docType, icon: FileText };
  const Icon = meta.icon;

  return (
    <div className={`report-accordion${open ? " open" : ""}`}>
      <button className="report-accordion-header" onClick={() => setOpen(!open)}>
        <span className="report-accordion-icon">
          <Icon size={22} />
        </span>
        <div className="report-accordion-info">
          <h4>{meta.label}</h4>
          <span className="report-accordion-count">{docs.length} document{docs.length > 1 ? "s" : ""} disponible{docs.length > 1 ? "s" : ""}</span>
        </div>
        <span className={`report-accordion-chevron${open ? " rotated" : ""}`}>
          <ChevronDown size={20} />
        </span>
      </button>
      {open && (
        <div className="report-accordion-body">
          {docs
            .sort((a, b) => (a.country ?? "").localeCompare(b.country ?? "", "fr"))
            .map((d, i) => (
            <div key={i} className="report-accordion-item">
              <span className="report-accordion-file-icon">
                <FileText size={18} />
              </span>
              <span className="report-accordion-item-title">
                {d.country && <strong>{d.country}</strong>}
                {d.country && " — "}{d.title}
              </span>
              <button
                className="report-accordion-download"
                onClick={(e) => {
                  e.stopPropagation();
                  if (d.filename) window.open(`/documents/national-reports/${d.filename}`, "_blank");
                }}
              >
                <Download size={15} />
                Télécharger
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ResourceAccordion({ kind, docs }: { kind: string; docs: Resource[] }) {
  const [open, setOpen] = useState(false);
  const meta = KIND_META[kind] ?? { label: kind, icon: FileText };
  const Icon = meta.icon;

  return (
    <div className={`report-accordion${open ? " open" : ""}`}>
      <button className="report-accordion-header" onClick={() => setOpen(!open)}>
        <span className="report-accordion-icon">
          <Icon size={22} />
        </span>
        <div className="report-accordion-info">
          <h4>{meta.label}</h4>
          <span className="report-accordion-count">{docs.length} document{docs.length > 1 ? "s" : ""} disponible{docs.length > 1 ? "s" : ""}</span>
        </div>
        <span className={`report-accordion-chevron${open ? " rotated" : ""}`}>
          <ChevronDown size={20} />
        </span>
      </button>
      {open && (
        <div className="report-accordion-body">
          {docs.map((d, i) => (
            <div key={i} className="report-accordion-item">
              <span className="report-accordion-file-icon">
                <FileText size={18} />
              </span>
              <div className="report-accordion-item-detail">
                <span className="report-accordion-item-title">{d.title}</span>
                <span className="report-accordion-item-meta">{d.publisher} · {d.format}</span>
                {d.description && <span className="report-accordion-item-description">{d.description}</span>}
              </div>
              <button
                className="report-accordion-download"
                onClick={(e) => {
                  e.stopPropagation();
                  if (d.url) window.open(d.url, "_blank", "noopener,noreferrer");
                  else if (d.filename) window.open(`/documents/${d.filename}`, "_blank");
                }}
              >
                {d.url ? <ArrowRight size={15} /> : <Download size={15} />}
                {d.url ? "Consulter" : "Télécharger"}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function ResourcesPage() {
  const [filter, setFilter] = useState("all");
  const [q, setQ] = useState("");
  const filtered = data.resources.filter((r) => {
    if (filter !== "all" && r.kind !== filter) return false;
    const haystack = `${r.title} ${r.publisher} ${(r as Resource).description ?? ""} ${(r as Resource).country ?? ""} ${(r as Resource).iso3 ?? ""}`;
    if (q && !haystack.toLowerCase().includes(q.toLowerCase())) return false;
    return true;
  });

  const isReportFilter = filter === "all" || filter === "Rapport national";
  const reports = filtered.filter((r) => r.kind === "Rapport national") as Resource[];
  const others = filtered.filter((r) => r.kind !== "Rapport national") as Resource[];

  const groupedByDocType = useMemo(() => {
    const map = new Map<string, Resource[]>();
    for (const r of reports) {
      const dt = r.docType ?? "NDC";
      if (!map.has(dt)) map.set(dt, []);
      map.get(dt)!.push(r);
    }
    return DOC_TYPE_ORDER.filter((dt) => map.has(dt)).map((dt) => ({
      docType: dt,
      docs: map.get(dt)!,
    }));
  }, [reports]);

  const groupedByKind = useMemo(() => {
    const map = new Map<string, Resource[]>();
    for (const r of others) {
      const k = r.kind;
      if (!map.has(k)) map.set(k, []);
      map.get(k)!.push(r);
    }
    return KIND_ORDER.filter((k) => map.has(k)).map((k) => ({
      kind: k,
      docs: map.get(k)!,
    }));
  }, [others]);

  return (
    <>
      <section className="page-hero">
        <div className="page-hero-bg" style={{ backgroundImage: "url(/images/sahel-landscape.jpg)" }} aria-hidden="true" />
        <div className="container page-hero-inner">
          <div className="kicker light"><span style={{ color: "var(--forest-light)" }}>●</span> Centre de ressources</div>
          <h1>Bulletins, jeux de données <em>et méthodes</em>.</h1>
          <p className="lead light" style={{ textAlign: "justify" }}>
            Tous les livrables de la composante 2 : bulletins mensuels d'alertes,
            séries de données brutes, fiches méthodologiques et outils de retraitement.
          </p>
        </div>
      </section>

      <section className="section tight">
        <div className="container">
          <div className="toolbar">
            <div className="segmented sm">
              {kinds.map((k) => (
                <button
                  key={k.key}
                  className={filter === k.key ? "on" : ""}
                  onClick={() => setFilter(k.key)}
                >
                  {k.label}
                </button>
              ))}
            </div>
            <div className="search-field">
              <span style={{ color: "var(--muted)" }}>⌕</span>
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Rechercher…"
              />
            </div>
            <span className="footnote" style={{ marginInline: "auto 0" }}>
              {filtered.length} ressource(s)
            </span>
          </div>

          {/* National reports grouped by document type — accordion style */}
          {isReportFilter && groupedByDocType.length > 0 && (
            <>
              {filter === "all" && (
                <div className="resource-section-title">
                  <h3>Rapports nationaux</h3>
                  <span className="footnote">{reports.length} documents</span>
                </div>
              )}
              <div className="report-accordion-list">
                {groupedByDocType.map((g) => (
                  <ReportAccordion key={g.docType} {...g} />
                ))}
              </div>
            </>
          )}

          {/* Other resources grouped by kind — accordion style */}
          {groupedByKind.length > 0 && (
            <>
              {filter === "all" && (
                <div className="resource-section-title" style={{ marginTop: 48 }}>
                  <h3>Autres ressources</h3>
                  <span className="footnote">{others.length} ressource(s)</span>
                </div>
              )}
              <div className="report-accordion-list">
                {groupedByKind.map((g) => (
                  <ResourceAccordion key={g.kind} {...g} />
                ))}
              </div>
            </>
          )}

          {filtered.length === 0 && (
            <p className="loading">Aucune ressource ne correspond à votre recherche.</p>
          )}

          <div className="card wide" style={{ marginTop: 40, display: "grid", gridTemplateColumns: "1fr auto", gap: 32, alignItems: "center" }}>
            <div>
              <div className="eyebrow" style={{ marginBottom: 12 }}>Vous cherchez autre chose ?</div>
              <h3 style={{ fontSize: 24, marginBottom: 8 }}>Données brutes et API géoportail</h3>
              <p style={{ color: "var(--ink-2)", fontSize: 15, textAlign: "justify" }}>
                Les séries mensuelles par pays et l'API WMS du géoportail sont
                disponibles en accès libre. Une clé d'accès optionnelle est fournie
                sur demande pour l'API à haut débit et la documentation technique.
              </p>
            </div>
            <a href="#contact" className="btn btn-clay">
              Contacter l'équipe <ArrowRight size={14} />
            </a>
          </div>
        </div>
      </section>
    </>
  );
}
