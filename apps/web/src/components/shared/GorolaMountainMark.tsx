import type { ReactElement } from "react";

import logoImg from "./Logo_without_bg.png";

export type GorolaMountainMarkProps = {
  width?: number;
  height?: number;
  className?: string;
  strokeWidth?: number;
  color?: string;
  secondaryColor?: string;
};

/**
 * GoRola brand logo component, rendering the custom Logo_without_bg.png image.
 */
export function GorolaMountainMark({
  width,
  height = 44,
  className
}: GorolaMountainMarkProps): ReactElement {
  return (
    <img
      src={logoImg}
      alt="GoRola Logo"
      className={className}
      data-testid="gorola-mountain-mark"
      style={{
        height: `${height}px`,
        width: width ? `${width}px` : "auto",
        objectFit: "contain"
      }}
    />
  );
}
