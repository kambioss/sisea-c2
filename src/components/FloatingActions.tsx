import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

const DISMISS_KEY = "geossia:floating-actions-hidden-until";
const DISMISS_DELAY = 60_000;

/**
 * Floating actions on the right side — platform-relevant CTAs.
 * - Connexion (white) → login page
 * - S'abonner au bulletin (orange) → newsletter subscription
 */
export default function FloatingActions() {
  const [hiddenUntil, setHiddenUntil] = useState(() => {
    const stored = window.localStorage.getItem(DISMISS_KEY);
    const value = stored ? Number(stored) : 0;
    return Number.isFinite(value) && value > Date.now() ? value : 0;
  });

  useEffect(() => {
    if (!hiddenUntil) return;
    const remaining = Math.max(0, hiddenUntil - Date.now());
    const timer = window.setTimeout(() => {
      window.localStorage.removeItem(DISMISS_KEY);
      setHiddenUntil(0);
    }, remaining);
    return () => window.clearTimeout(timer);
  }, [hiddenUntil]);

  const dismissTemporarily = () => {
    const until = Date.now() + DISMISS_DELAY;
    window.localStorage.setItem(DISMISS_KEY, String(until));
    setHiddenUntil(until);
  };

  if (hiddenUntil > Date.now()) return null;

  return (
    <div className="floating-actions" aria-hidden="false">
      <button
        type="button"
        className="floating-actions-close"
        onClick={dismissTemporarily}
        title="Masquer pendant une minute"
        aria-label="Masquer les raccourcis pendant une minute"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <path d="M6 6l12 12M18 6L6 18" />
        </svg>
      </button>
      <Link to="/login" className="fa-btn customize" title="Se connecter à son compte GEOSSIA">
        <svg className="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
          <polyline points="10 17 15 12 10 7" />
          <line x1="15" y1="12" x2="3" y2="12" />
        </svg>
        Connexion
      </Link>
      <Link to="/bulletin" className="fa-btn try-now" title="Recevoir le bulletin mensuel par email">
        <svg className="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
          <polyline points="22,6 12,13 2,6" />
        </svg>
        S'abonner au bulletin
      </Link>
    </div>
  );
}
