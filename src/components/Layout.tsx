import type { ReactNode } from "react";
import { useState, useEffect } from "react";
import { Link, NavLink, useLocation } from "react-router-dom";
import FloatingActions from "./FloatingActions";
import ossLogoWhite from "../oss-logo-white.png";
import ossLogoBlue from "../oss-logo-blue.png";

const africaPlatformUrl =
  (import.meta.env.VITE_AFRICA_PLATFORM_URL as string | undefined) || "https://africa.oss-online.org/";

const navItems = [
  { to: "/", label: "Accueil", end: true },
  { to: "/geoportail", label: "Géoportail" },
  { to: "/ressources", label: "Ressources" },
  { to: "/dashboard", label: "Dashboard" },
];

export function SiteLayout({ children }: { children: ReactNode }) {
  const location = useLocation();
  const isGeoportal = location.pathname.startsWith("/geoportail");
  const isHome = location.pathname === "/";
  const hideFloating = ["/login", "/bulletin"].includes(location.pathname);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  // Track scroll position to toggle navbar style (transparent → solid)
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    if (!isHome) return; // Only home page has transparent-then-solid behavior
    const onScroll = () => setScrolled(window.scrollY > 80);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [isHome]);
  useEffect(() => setMobileNavOpen(false), [location.pathname]);

  if (isGeoportal) {
    return <>{children}</>;
  }

  // On home page: transparent when at top, solid white when scrolled.
  // On other pages: always solid (sticky light).
  const headerClass = isHome ? (scrolled ? "on-light scrolled" : "transparent") : "on-light";

  return (
    <div>
      {!hideFloating && <FloatingActions />}

      <header className={`site-header ${headerClass}`}>
        <div className="container header-inner">
          <Link to="/" className="brand" aria-label="GEOSSIA — Accueil">
            <span className="oss-brand-logo">
              <img src={ossLogoWhite} alt="Observatoire du Sahara et du Sahel" className="oss-logo oss-logo-white" />
              <img src={ossLogoBlue} alt="" aria-hidden="true" className="oss-logo oss-logo-blue" />
            </span>
            <span className="component-identity" aria-hidden="true">
              <strong>AFRICA</strong>
              <small>Composante Climat</small>
            </span>
          </Link>

          <nav id="site-mobile-nav" className={`main-nav${mobileNavOpen ? " open" : ""}`} aria-label="Navigation principale">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) => (isActive ? "active" : "")}
              >
                {item.label}
              </NavLink>
            ))}
          </nav>

          <div className="header-actions">
            <a
              href={africaPlatformUrl}
              className="platform-return"
              title="Revenir à la plateforme environnementale AFRICA"
              aria-label="Revenir à la plateforme environnementale AFRICA"
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <circle cx="12" cy="12" r="9" />
                <path d="M3 12h18M12 3a15 15 0 0 1 0 18M12 3a15 15 0 0 0 0 18" />
              </svg>
              <span>Plateforme AFRICA</span>
            </a>
            <Link to="/alertes" className="header-phone header-alerts" aria-label="Consulter les alertes en cours">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" />
                <path d="M10 21h4" />
              </svg>
              Alertes
            </Link>
          </div>
          <button type="button" className="menu-toggle" aria-label={mobileNavOpen ? "Fermer le menu" : "Ouvrir le menu"} aria-expanded={mobileNavOpen} aria-controls="site-mobile-nav" onClick={() => setMobileNavOpen((open) => !open)}>
            <span /><span /><span />
          </button>
        </div>
      </header>

      <main>{children}</main>

      <footer className="site-footer">
        <div className="container">
          <div className="footer-grid">
            <div className="footer-brand">
              <div className="brand">
                <span className="oss-brand-logo oss-brand-logo-footer">
                  <img src={ossLogoWhite} alt="Observatoire du Sahara et du Sahel" className="oss-logo oss-logo-white" />
                </span>
              </div>
              <p>
                Observatoire opérationnel du climat et des alertes sécheresse en
                Afrique de l'Ouest &amp; Sahel — composante 2 de la Plateforme AFRICA.
              </p>
            </div>
            <div className="footer-col">
              <h5>Explorer</h5>
              <Link to="/geoportail">Géoportail cartographique</Link>
              <Link to="/ressources">Centre de ressources</Link>
              <Link to="/dashboard">Tableau de bord</Link>
              <Link to="/bulletin">Bulletin mensuel</Link>
            </div>
            <div className="footer-col">
              <h5>Ressources</h5>
              <Link to="/ressources">Bulletins & données</Link>
              <Link to="/dashboard">Méthodologie</Link>
              <Link to="/dashboard">Sources de données</Link>
              <Link to="/dashboard">Glossaire</Link>
            </div>
            <div className="footer-col">
              <h5>À propos</h5>
              <Link to="/dashboard">La Plateforme AFRICA</Link>
              <Link to="/login">Espace partenaire</Link>
              <a href="#partenaires">Partenaires</a>
              <a href="#mentions">Mentions légales</a>
            </div>
          </div>
          <div className="footer-bottom">
            <span>© 2026 AFRICA · Données CRU TS, CHIRPS, CMIP6 CCKP, NASA FIRMS</span>
            <span>Composante 2 · <a href="#">v0.3.0</a> · Màj 05.11.2026</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
