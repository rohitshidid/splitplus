"use client";

interface BrandIconProps {
  size?: number | string;
  className?: string;
  style?: React.CSSProperties;
}

/**
 * The Splitplus mark: one S cut in two along a seam that crosses only its
 * middle stroke — one bill, two sides — with the plus that finishes the name.
 * It is the same artwork as public/icon.svg, so the tab and the page agree.
 * Every instance renders identical <defs>, so the shared ids are safe.
 */
export default function BrandIcon({ size = 32, className = "", style = {} }: BrandIconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      style={{ display: "inline-block", verticalAlign: "middle", flexShrink: 0, ...style }}
      role="img"
      aria-label="Splitplus"
    >
      <defs>
        <linearGradient id="spTile" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#17a870" />
          <stop offset="55%" stopColor="#0f8a5f" />
          <stop offset="100%" stopColor="#0a6b49" />
        </linearGradient>
        <clipPath id="spTop">
          <polygon points="-60,-120 160,-120 160,13 -60,83" />
        </clipPath>
        <clipPath id="spBottom">
          <polygon points="-60,87 160,17 160,220 -60,220" />
        </clipPath>
      </defs>

      <rect x="0" y="0" width="100" height="100" rx="24" fill="url(#spTile)" />

      <g
        transform="translate(43,45.5) scale(0.82) translate(-49,-50)"
        fill="none"
        strokeWidth="12"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path
          d="M65 34 C59 27.5 42 26.5 36 33 C30 39.5 33.5 46.5 42.5 49.5 L56 53.5 C66 56.5 68 64.5 62 69.5 C56 74.5 39 73.5 33 66.5"
          stroke="#ffffff"
          clipPath="url(#spTop)"
        />
        <path
          d="M65 34 C59 27.5 42 26.5 36 33 C30 39.5 33.5 46.5 42.5 49.5 L56 53.5 C66 56.5 68 64.5 62 69.5 C56 74.5 39 73.5 33 66.5"
          stroke="#a7f3d0"
          clipPath="url(#spBottom)"
        />
      </g>

      <path
        d="M73 65 v15.5 M65.25 72.75 h15.5"
        stroke="#ffffff"
        strokeWidth="7.5"
        strokeLinecap="round"
      />
    </svg>
  );
}
