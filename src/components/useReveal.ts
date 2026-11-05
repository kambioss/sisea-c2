import { useEffect, useRef } from "react";

// Adds "in" to every [data-rv] element of the returned root once it scrolls
// into view, so each section's parts rise in turn. Without the observer, or
// with reduced motion, nothing is hidden.
export function useReveal() {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || !("IntersectionObserver" in window) || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    el.classList.add("anim");
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            e.target.classList.add("in");
            io.unobserve(e.target);
          }
        }
      },
      { rootMargin: "0px 0px -8% 0px" },
    );
    el.querySelectorAll("[data-rv]").forEach((n) => io.observe(n));
    return () => io.disconnect();
  }, []);
  return ref;
}
