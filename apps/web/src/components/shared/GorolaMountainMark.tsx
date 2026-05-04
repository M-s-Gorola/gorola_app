import { type ReactElement, useId } from "react";

export type GorolaMountainMarkProps = {
  width?: number;
  height?: number;
  className?: string;
  strokeWidth?: number;
  color?: string;
  secondaryColor?: string;
};

/**
 * GoRola mountain mark (inline SVG), extracted as a reusable component.
 * Based on the design-system logo block and intentionally easy to tweak later.
 */
export function GorolaMountainMark({
  width = 32,
  height = 28,
  className,
  strokeWidth = 2.5,
  color = "var(--gorola-fog)",
  secondaryColor = "var(--gorola-pine)"
}: GorolaMountainMarkProps): ReactElement {
  const gradientId = useId();

  return (
    <svg
      width={width}
      height={height}
      viewBox="0 0 72 64"
      fill="none"
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      <polygon points="36,4 44,22 28,22" fill={color} opacity="0.95" />
      <polygon
        points="36,4 64,60 8,60"
        fill="none"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinejoin="round"
      />
      <polygon points="36,4 64,60 8,60" fill={`url(#${gradientId})`} opacity="0.3" />
      <path
        d="M20 60 L20 50 L16 50 L20 44 L15 44 L20 38 L20 36"
        stroke={color}
        strokeWidth="1.2"
        fill="none"
        opacity="0.4"
      />
      <path
        d="M50 60 L50 52 L47 52 L50 46 L46 46 L50 40"
        stroke={color}
        strokeWidth="1.2"
        fill="none"
        opacity="0.4"
      />
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} />
          <stop offset="100%" stopColor={secondaryColor} />
        </linearGradient>
      </defs>
    </svg>
  );
}
