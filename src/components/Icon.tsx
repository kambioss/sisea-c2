// Small stroke icon set (24px grid, currentColor) so the site carries no icon
// font or library.

const PATHS: Record<string, string> = {
  layers: "M12 3 3 8l9 5 9-5-9-5Zm-9 9 9 5 9-5M3 16l9 5 9-5",
  star: "m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9L12 3Z",
  search: "M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14Zm9 16-4-4",
  compare: "M7 4v16M17 4v16M4 8h6M14 16h6",
  help: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Zm-2.5-11.5a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .9-1 1.6v.6M12 17h.01",
  bell: "M6 16V11a6 6 0 1 1 12 0v5l1.5 2h-15L6 16Zm4 4h4",
  pin: "M12 21s-6-5.4-6-11a6 6 0 1 1 12 0c0 5.6-6 11-6 11Zm0-8.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z",
  swap: "M7 7h11l-3-3M17 17H6l3 3",
  chevronDown: "m6 9 6 6 6-6",
  chevronLeft: "m15 6-6 6 6 6",
  chevronRight: "m9 6 6 6-6 6",
  filter: "M4 5h16l-6 7.5V19l-4 1.5v-8L4 5Z",
  close: "M6 6l12 12M18 6 6 18",
  check: "m5 12.5 4.5 4.5L19 7.5",
  list: "M9 6h11M9 12h11M9 18h11M4.5 6h.01M4.5 12h.01M4.5 18h.01",
  history: "M4 12a8 8 0 1 0 2.4-5.7L4 8.6M4 4v4.6h4.6M12 8v4l3 2",
  palette: "M12 3a9 9 0 0 0 0 18c1.1 0 1.6-.8 1.6-1.6 0-1.2-1-1.4-1-2.4 0-.9.7-1.5 1.6-1.5H16a5 5 0 0 0 5-5c0-4.1-4-7.5-9-7.5ZM7.5 11h.01M10 7.5h.01M14.5 7.5h.01",
  sliders: "M4 7h10M18 7h2M4 17h4M12 17h8M16 5v4M10 15v4",
  minus: "M5 12h14",
  plus: "M12 5v14M5 12h14",
  arrowRight: "M5 12h14m-5-5 5 5-5 5",
  arrowUpRight: "M7 17 17 7M8 7h9v9",
  download: "M12 4v11m-4.5-4.5L12 15l4.5-4.5M5 19h14",
  thermometer: "M10 13.5V5a2 2 0 1 1 4 0v8.5a4 4 0 1 1-4 0Z",
  drop: "M12 3.5s6 6.4 6 10.5a6 6 0 1 1-12 0c0-4.1 6-10.5 6-10.5Z",
  alert: "M12 4 2.8 19.5h18.4L12 4Zm0 6v4.5m0 2.5h.01",
  trend: "m3 17 6-6 4 4 8-8M15 7h6v6",
  globe: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18ZM3 12h18M12 3c2.5 2.7 3.6 5.6 3.6 9s-1.1 6.3-3.6 9c-2.5-2.7-3.6-5.6-3.6-9S9.5 5.7 12 3Z",
  book: "M5 4.5A1.5 1.5 0 0 1 6.5 3H19v15H6.5A1.5 1.5 0 0 0 5 19.5v-15Zm0 15A1.5 1.5 0 0 0 6.5 21H19",
  fire: "M12 21c-3.9 0-6.5-2.6-6.5-6.2 0-3.4 2.7-5.6 3.7-8.8 1.6 1.2 2.3 2.9 2.4 4.5 1.4-.9 2.1-2.4 2.1-4 2.9 2 4.8 5 4.8 8.3 0 3.6-2.6 6.2-6.5 6.2Z",
  menu: "M4 7h16M4 12h16M4 17h16",
  info: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Zm0-10v6m0-9h.01",
};

export type IconName = keyof typeof PATHS;

export function Icon({ name, size = 18, className }: { name: IconName; size?: number; className?: string }) {
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={PATHS[name]} />
    </svg>
  );
}
