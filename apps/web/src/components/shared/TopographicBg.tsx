import type { ReactElement } from "react";
import { useMemo } from "react";

import { cn } from "@/lib/utils";

interface TopographicBgProps {
  color?: string;
  opacity?: number;
  className?: string;
}

/**
 * Subtle topographic line pattern for hero / section backgrounds. Decorative only.
 * High-fidelity version ported from Design Pahadi.
 * Organic artistic layout with 5 curated clusters.
 */
export function TopographicBg({
  color = "currentColor",
  opacity = 0.2,
  className = "",
}: TopographicBgProps): ReactElement {
  // Artistic layout using percentage coordinates for fluid stability
  const clusters = useMemo(
    () => [
      { id: 1, x: 15, y: 20, scale: 1.2, rotate: 15 },
      { id: 2, x: 75, y: 15, scale: 1.0, rotate: -35 },
      { id: 5, x: 45, y: 55, scale: 1.1, rotate: 160 },
      { id: 7, x: 92, y: 8, scale: 1.3, rotate: 25 }, // Top Right - near complete
      { id: 8, x: 8, y: 95, scale: 1.4, rotate: -40 }, // Bottom Left - peek
    ],
    []
  );

  return (
    <svg
      aria-hidden="true"
      className={cn("pointer-events-none absolute inset-0 h-full w-full", className)}
      style={{ opacity }}
      xmlns="http://www.w3.org/2000/svg"
    >
      {clusters.map((c) => (
        <svg
          key={c.id}
          x={`${c.x}%`}
          y={`${c.y}%`}
          width="1"
          height="1"
          style={{ overflow: "visible" }}
        >
          <g
            transform={`rotate(${c.rotate}) scale(${c.scale})`}
            style={{ transformBox: "fill-box", transformOrigin: "center" }}
          >
            {/* Contour hill definition (centered in its local space) */}
            <g transform="translate(-160, -160)">
              <path
                d="M160,160 Q200,120 260,140 Q300,155 310,190 Q295,225 250,235 Q200,245 160,225 Q115,205 110,175 Q115,145 160,160Z"
                fill="none"
                stroke={color}
                strokeWidth="1.2"
              />
              <path
                d="M160,140 Q215,90 285,115 Q330,135 335,180 Q320,230 268,248 Q205,260 158,240 Q98,218 92,175 Q95,130 160,140Z"
                fill="none"
                stroke={color}
                strokeWidth="1"
                opacity="0.8"
              />
              <path
                d="M160,118 Q228,60 308,90 Q360,115 360,172 Q348,238 285,262 Q210,278 155,255 Q78,228 72,172 Q74,112 160,118Z"
                fill="none"
                stroke={color}
                strokeWidth="0.8"
                opacity="0.6"
              />
            </g>
          </g>
        </svg>
      ))}
    </svg>
  );
}

/**
 * High-intensity topographic pattern for splash screens and success states.
 */
export function TopoSplash(): ReactElement {
  return (
    <svg
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 h-full w-full"
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 375 400"
      preserveAspectRatio="xMidYMid slice"
    >
      <path
        d="M187,200 Q240,155 305,175 Q350,190 360,230 Q345,275 295,290 Q235,305 185,280 Q128,255 122,218 Q128,178 187,200Z"
        fill="none"
        stroke="white"
        strokeWidth="1.5"
        opacity="0.1"
      />
      <path
        d="M187,175 Q255,118 335,145 Q388,168 392,220 Q378,282 316,302 Q240,320 184,292 Q110,262 104,218 Q108,165 187,175Z"
        fill="none"
        stroke="white"
        strokeWidth="1.2"
        opacity="0.08"
      />
      <path
        d="M187,148 Q268,80 362,112 Q420,140 425,210 Q410,290 335,316 Q245,338 182,305 Q92,268 85,218 Q88,148 187,148Z"
        fill="none"
        stroke="white"
        strokeWidth="1"
        opacity="0.06"
      />
      <path
        d="M187,120 Q280,42 388,78 Q455,112 458,200 Q440,298 354,330 Q250,356 180,318 Q72,274 65,218 Q68,130 187,120Z"
        fill="none"
        stroke="white"
        strokeWidth="0.8"
        opacity="0.05"
      />
      <path
        d="M40,80 Q90,50 130,65 Q160,75 155,105 Q142,135 108,140 Q72,142 48,120 Q28,100 40,80Z"
        fill="none"
        stroke="white"
        strokeWidth="1.2"
        opacity="0.09"
      />
      <path
        d="M30,60 Q95,22 145,42 Q185,58 178,95 Q162,132 118,138 Q65,145 35,115 Q10,90 30,60Z"
        fill="none"
        stroke="white"
        strokeWidth="0.9"
        opacity="0.07"
      />
      <path
        d="M255,310 Q298,285 328,302 Q348,318 340,345 Q326,368 296,370 Q262,370 248,348 Q236,328 255,310Z"
        fill="none"
        stroke="white"
        strokeWidth="1.2"
        opacity="0.09"
      />
      <path
        d="M0,270 Q55,248 95,258 Q130,265 138,240 Q148,215 187,200"
        fill="none"
        stroke="white"
        strokeWidth="1"
        opacity="0.07"
      />
      <path
        d="M305,175 Q340,162 375,168"
        fill="none"
        stroke="white"
        strokeWidth="1"
        opacity="0.07"
      />
    </svg>
  );
}
