interface LogoProps {
  size?: number
  className?: string
}

// A stylized M combining a coastline wave and a Moriones-inspired peak.
export function Logo({ size = 40, className = '' }: LogoProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      className={className}
      aria-hidden="true"
    >
      <rect width="48" height="48" rx="12" fill="#155571" />
      <path
        d="M8 33c4-1 6-5 9-5s4 3 7 3 4-6 7-6 5 4 9 3"
        stroke="#a6dde8"
        strokeWidth="2.4"
        strokeLinecap="round"
      />
      <path
        d="M10 30l7-11 4 6 5-9 5 9 7 11"
        stroke="#f6e4d3"
        strokeWidth="2.8"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      <circle cx="35" cy="14" r="2.5" fill="#e0a376" />
    </svg>
  )
}
