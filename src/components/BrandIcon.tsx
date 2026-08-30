"use client";

interface BrandIconProps {
  size?: number | string;
  className?: string;
  style?: React.CSSProperties;
}

export default function BrandIcon({ size = 32, className = "", style = {} }: BrandIconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      style={{ display: "inline-block", verticalAlign: "middle", flexShrink: 0, ...style }}
      aria-label="Splitplus Logo"
    >
      <defs>
        {/* Luminous Light Blue / Sky Gradient */}
        <linearGradient id="spSkyBg" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#bae6fd" />
          <stop offset="40%" stopColor="#38bdf8" />
          <stop offset="100%" stopColor="#0284c7" />
        </linearGradient>

        {/* Banknote front and back gradients */}
        <linearGradient id="spBillGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="100%" stopColor="#f0fdf4" />
        </linearGradient>
        <linearGradient id="spBackBillGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.9" />
          <stop offset="100%" stopColor="#d1fae5" stopOpacity="0.7" />
        </linearGradient>

        {/* Golden Plus Badge */}
        <linearGradient id="spPlusGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#fde047" />
          <stop offset="50%" stopColor="#fbbf24" />
          <stop offset="100%" stopColor="#f59e0b" />
        </linearGradient>

        {/* Crisp shadows */}
        <filter id="spTileShadow" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="4" stdDeviation="5" floodColor="#0369a1" floodOpacity="0.25" />
        </filter>
        <filter id="spFrontShadow" x="-25%" y="-25%" width="150%" height="150%">
          <feDropShadow dx="0" dy="3" stdDeviation="3.5" floodColor="#0284c7" floodOpacity="0.22" />
        </filter>
        <filter id="spBadgeShadow" x="-30%" y="-30%" width="160%" height="160%">
          <feDropShadow dx="0" dy="2" stdDeviation="2.5" floodColor="#b45309" floodOpacity="0.32" />
        </filter>
      </defs>

      {/* Light Blue Squircle Background */}
      <rect
        x="6"
        y="6"
        width="88"
        height="88"
        rx="24"
        fill="#38bdf8"
      />
      <rect
        x="6"
        y="6"
        width="88"
        height="88"
        rx="24"
        fill="url(#spSkyBg)"
        filter="url(#spTileShadow)"
      />
      <rect
        x="6.5"
        y="6.5"
        width="87"
        height="87"
        rx="23.5"
        stroke="rgba(255, 255, 255, 0.65)"
        strokeWidth="1.5"
        fill="none"
      />

      {/* Back splitting banknote */}
      <g transform="rotate(-14 45 44)">
        <rect
          x="21"
          y="27"
          width="48"
          height="31"
          rx="6"
          fill="url(#spBackBillGrad)"
          stroke="rgba(255, 255, 255, 0.85)"
          strokeWidth="1.2"
        />
        <circle cx="45" cy="42.5" r="5.5" fill="rgba(16, 185, 129, 0.25)" />
      </g>

      {/* Front primary banknote */}
      <g filter="url(#spFrontShadow)">
        <rect
          x="25"
          y="31"
          width="50"
          height="34"
          rx="7"
          fill="url(#spBillGrad)"
          stroke="#86efac"
          strokeWidth="1.4"
        />

        {/* Subtle green dashed border */}
        <rect
          x="28.5"
          y="34.5"
          width="43"
          height="27"
          rx="4.5"
          fill="none"
          stroke="#4ade80"
          strokeWidth="0.9"
          strokeDasharray="2 1.5"
        />

        {/* Center coin badge */}
        <circle cx="50" cy="48" r="8.5" fill="#dcfce7" stroke="#16a34a" strokeWidth="1.3" />

        {/* Accurate Dollar sign ($) */}
        <text
          x="50"
          y="48.5"
          fill="#15803d"
          fontSize="11"
          fontWeight="800"
          fontFamily="system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
          textAnchor="middle"
          dominantBaseline="central"
        >
          $
        </text>

        {/* Corner currency accents */}
        <circle cx="33" cy="48" r="2" fill="#22c55e" />
        <circle cx="67" cy="48" r="2" fill="#22c55e" />
      </g>

      {/* Golden Plus Badge */}
      <g filter="url(#spBadgeShadow)">
        <circle cx="68" cy="62" r="10.5" fill="url(#spPlusGrad)" stroke="#ffffff" strokeWidth="2.2" />
        <path d="M68 56.5 v11 M62.5 62 h11" stroke="#ffffff" strokeWidth="2.4" strokeLinecap="round" />
      </g>
    </svg>
  );
}
