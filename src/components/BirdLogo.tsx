/** Simple geometric bird logo, à la "Hope starter" template. */
export function BirdLogo({ size = 36 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {/* Bird body — stylized in flight */}
      <path d="M6 28 Q 16 22 22 24 Q 28 18 36 16 Q 32 22 28 26 Q 34 28 42 28 Q 36 32 28 32 Q 22 36 14 34 Q 8 33 6 28 Z" />
      {/* Wing detail */}
      <path d="M16 24 Q 20 18 24 20" opacity="0.7" />
      {/* Eye */}
      <circle cx="34" cy="20" r="0.8" fill="currentColor" />
      {/* Tail feathers */}
      <path d="M8 30 L 4 33 M 10 32 L 5 36" opacity="0.5" />
    </svg>
  );
}

/** Compact leaf/compass mark variant for footer. */
export function LeafMark({ size = 32 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M16 4 Q 24 12 24 18 Q 24 24 16 28 Q 8 24 8 18 Q 8 12 16 4 Z" />
      <path d="M16 6 L 16 26" opacity="0.5" />
      <path d="M16 14 L 22 12 M 16 18 L 22 16 M 16 22 L 22 20" opacity="0.4" />
    </svg>
  );
}
