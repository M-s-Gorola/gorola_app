import type { ReactElement } from "react";

export type GorolaMountainMarkProps = {
  width?: number;
  height?: number;
  className?: string;
  strokeWidth?: number;
};

/**
 * GoRola mountain mark (inline SVG), extracted as a reusable component.
 * Based on the design-system logo block and intentionally easy to tweak later.
 */
export function GorolaMountainMark({
  width = 32,
  height = 28,
  className,
  strokeWidth = 2.5
}: GorolaMountainMarkProps): ReactElement {
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
      <polygon points="36,4 44,22 28,22" fill="#F4F1EC" opacity="0.95" />
      <polygon
        points="36,4 64,60 8,60"
        fill="none"
        stroke="#F4F1EC"
        strokeWidth={strokeWidth}
        strokeLinejoin="round"
      />
    </svg>
  );
}
