import { useEffect, useState } from "react";
import { Link, NavLink, Outlet, useLocation } from "react-router-dom";
import { Icon } from "./Icon";
import { Bundle, loadBundle } from "../data/indicators";
import ossLogo from "../oss-logo-white.png";

const NAV = [
  { to: "/", label: "Accueil", end: true },
  { to: "/ressources", label: "Ressources" },
  { to: "/a-propos", label: "À propos" },
];

export function useBundle(): { bundle: Bundle | null; error: string | null } {
  const [bundle, setBundle] = useState<Bundle | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    loadBundle().then(setBundle).catch((err: Error) => setError(err.message));
  }, []);
  return { bundle, error };
}

export function useTitle(title: string) {
  useEffect(() => {
    document.title = `${title} · GEOSSIA Climat & Alertes`;
  }, [title]);
}

export function BrandMark({ size = 34 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" aria-hidden="true" className="brandmark">
      <circle cx="20" cy="20" r="18" fill="var(--navy)" />
      <path d="M2 22c6-4 11-4 18 0s12 4 18 0v2a18 18 0 0 1-36 0v-2Z" fill="var(--accent)" />
      <path d="M2 27c6-4 11-4 18 0s12 4 18 0" fill="none" stroke="#c9c6f5" strokeWidth="1.6" />
      <circle cx="26" cy="13" r="4" fill="#f4c95d" />
    </svg>
  );
}

function SiteHeader() {
  const [open, setOpen] = useState(false);
  const location = useLocation();
  useEffect(() => {
    setOpen(false);
  }, [location.pathname]);
  return (
    <header className="site-header">
      <div className="container header-inner">
        <Link to="/" className="brand">
          <BrandMark />
          <span>
            <strong>GEOSSIA</strong>
            <small>Climat & Alertes · Composante 2</small>
          </span>
        </Link>
        <nav className={open ? "main-nav open" : "main-nav"} aria-label="Navigation principale">
          {NAV.map((item) => (
            <NavLink key={item.to} to={item.to} end={item.end}>{item.label}</NavLink>
          ))}
        </nav>
        <div className="header-actions">
          {HOME_VERSIONS.some((v) => v.to === location.pathname) && <VersionSwitch current={location.pathname} />}
          <Link to="/geoportail" className="btn btn-dark">
            <Icon name="globe" size={16} /> Géoportail
          </Link>
          <button className="icon-btn menu-toggle" onClick={() => setOpen((v) => !v)} aria-label="Menu" aria-expanded={open}>
            <Icon name={open ? "close" : "menu"} />
          </button>
        </div>
      </div>
    </header>
  );
}

function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="container footer-grid">
        <div>
          <img src={ossLogo} alt="Observatoire du Sahara et du Sahel" className="footer-logo" />
          <p>GEOSSIA — Composante 2 « Climat & Alertes » : surveillance climatique, alertes précoces et tendances pour les 55 pays africains.</p>
        </div>
        <div>
          <h4>Explorer</h4>
          <Link to="/geoportail">Géoportail</Link>
          <Link to="/ressources">Ressources</Link>
          <Link to="/a-propos">À propos</Link>
        </div>
        <div>
          <h4>Ressources</h4>
          <Link to="/ressources">Données & méthodes</Link>
          <a href="/data/indicators.json" download>Télécharger les indicateurs</a>
          <Link to="/a-propos">Méthodologie</Link>
        </div>
        <div>
          <h4>Sources</h4>
          <span>CRU TS 4.09 · UEA</span>
          <span>CHIRPS v2 · UCSB</span>
          <span>CMIP6 · Banque mondiale CCKP</span>
        </div>
      </div>
      <div className="container footer-bottom">
        <span>© {new Date().getFullYear()} Observatoire du Sahara et du Sahel</span>
        <span>Données climatiques : sources citées, licences respectives</span>
      </div>
    </footer>
  );
}

export function SiteLayout() {
  const location = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [location.pathname]);
  return (
    <div className="site">
      <SiteHeader />
      <main>
        <Outlet />
      </main>
      {location.pathname !== "/accueil-v2" && <SiteFooter />}
    </div>
  );
}

// Temporary switch to compare the two home page designs while one is chosen.
const HOME_VERSIONS = [
  { to: "/", label: "Version 1" },
  { to: "/accueil-v1", label: "Version 1" },
  { to: "/accueil-v2", label: "Version 2" },
];

function VersionSwitch({ current }: { current: string }) {
  const v2 = current === "/accueil-v2";
  return (
    <nav className="version-switch" aria-label="Versions de la page d'accueil">
      <Link to="/accueil-v1" className={v2 ? "" : "on"}><span className="vs-long">Version </span>1</Link>
      <Link to="/accueil-v2" className={v2 ? "on" : ""}><span className="vs-long">Version </span>2</Link>
    </nav>
  );
}

export function PageHero({ eyebrow, title, lead, children }: { eyebrow: string; title: string; lead: string; children?: React.ReactNode }) {
  return (
    <section className="page-hero">
      <div className="container">
        <span className="eyebrow">{eyebrow}</span>
        <h1>{title}</h1>
        <p className="lead">{lead}</p>
        {children}
      </div>
    </section>
  );
}

export function Loading({ error }: { error?: string | null }) {
  return <div className="loading">{error ? `Impossible de charger les indicateurs (${error}).` : "Chargement des indicateurs…"}</div>;
}
