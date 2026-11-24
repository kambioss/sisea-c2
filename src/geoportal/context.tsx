import { useEffect, useState } from "react";
import { Bundle, loadBundle } from "../data/indicators";

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
