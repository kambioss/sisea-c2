import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement> & { size?: number };

const base = (size = 18): SVGProps<SVGSVGElement> => ({
  width: size,
  height: size,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.6,
  strokeLinecap: "round",
  strokeLinejoin: "round",
});

export function ArrowRight({ size = 18, ...rest }: IconProps) {
  return (
    <svg {...base(size)} {...rest}>
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  );
}

export function ArrowUpRight({ size = 16, ...rest }: IconProps) {
  return (
    <svg {...base(size)} {...rest}>
      <path d="M7 17L17 7M8 7h9v9" />
    </svg>
  );
}

export function Thermometer({ size = 18, ...rest }: IconProps) {
  return (
    <svg {...base(size)} {...rest}>
      <path d="M14 14.76V3.5a2.5 2.5 0 0 0-5 0v11.26a4 4 0 1 0 5 0z" />
    </svg>
  );
}

export function Droplet({ size = 18, ...rest }: IconProps) {
  return (
    <svg {...base(size)} {...rest}>
      <path d="M12 2.5s7 7.5 7 12a7 7 0 0 1-14 0c0-4.5 7-12 7-12z" />
    </svg>
  );
}

export function AlertTriangle({ size = 18, ...rest }: IconProps) {
  return (
    <svg {...base(size)} {...rest}>
      <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
      <line x1="12" y1="9" x2="12" y2="13" />
      <circle cx="12" cy="17" r="0.5" fill="currentColor" />
    </svg>
  );
}

export function TrendingUp({ size = 18, ...rest }: IconProps) {
  return (
    <svg {...base(size)} {...rest}>
      <polyline points="22 7 13.5 15.5 8.5 10.5 2 17" />
      <polyline points="16 7 22 7 22 13" />
    </svg>
  );
}

export function Map({ size = 18, ...rest }: IconProps) {
  return (
    <svg {...base(size)} {...rest}>
      <polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6" />
      <line x1="8" y1="2" x2="8" y2="18" />
      <line x1="16" y1="6" x2="16" y2="22" />
    </svg>
  );
}

export function BookOpen({ size = 18, ...rest }: IconProps) {
  return (
    <svg {...base(size)} {...rest}>
      <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
      <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
    </svg>
  );
}

export function Download({ size = 18, ...rest }: IconProps) {
  return (
    <svg {...base(size)} {...rest}>
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" y1="15" x2="12" y2="3" />
    </svg>
  );
}

export function FileText({ size = 18, ...rest }: IconProps) {
  return (
    <svg {...base(size)} {...rest}>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="8" y1="13" x2="16" y2="13" />
      <line x1="8" y1="17" x2="13" y2="17" />
    </svg>
  );
}

export function Check({ size = 16, ...rest }: IconProps) {
  return (
    <svg {...base(size)} {...rest}>
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

export function Search({ size = 16, ...rest }: IconProps) {
  return (
    <svg {...base(size)} {...rest}>
      <circle cx="11" cy="11" r="7" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  );
}

export function ChevronDown({ size = 16, ...rest }: IconProps) {
  return (
    <svg {...base(size)} {...rest}>
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}

export function CalendarClock({ size = 18, ...rest }: IconProps) {
  return (
    <svg {...base(size)} {...rest}>
      <rect x="2" y="4" width="20" height="18" rx="2" />
      <line x1="2" y1="10" x2="22" y2="10" />
      <line x1="6" y1="2" x2="6" y2="6" />
      <line x1="18" y1="2" x2="18" y2="6" />
      <circle cx="12" cy="16" r="3" />
      <polyline points="12 14.5 12 16 13 17" />
    </svg>
  );
}

export function Activity({ size = 18, ...rest }: IconProps) {
  return (
    <svg {...base(size)} {...rest}>
      <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
    </svg>
  );
}

export function Flame({ size = 18, ...rest }: IconProps) {
  return (
    <svg {...base(size)} {...rest}>
      <path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z" />
    </svg>
  );
}
