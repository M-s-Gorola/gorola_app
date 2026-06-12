import { Star } from "lucide-react";
import type { ReactElement } from "react";
import { useState } from "react";

import { cn } from "@/lib/utils";

interface StarRatingProps {
  rating: number;
  interactive?: boolean;
  onChange?: (rating: number) => void;
  disabled?: boolean;
  className?: string;
  starClassName?: string;
}

export function StarRating({
  rating,
  interactive = false,
  onChange,
  disabled = false,
  className,
  starClassName,
}: StarRatingProps): ReactElement {
  const [hoverRating, setHoverRating] = useState<number | null>(null);

  const displayRating = hoverRating !== null ? hoverRating : rating;

  const handleRatingChange = (val: number): void => {
    if (disabled || !onChange) return;
    onChange(val);
  };

  return (
    <div
      className={cn(
        "flex items-center gap-1.5",
        interactive && !disabled && "cursor-pointer",
        className
      )}
      onMouseLeave={() => !disabled && setHoverRating(null)}
      data-testid="star-rating"
    >
      {[...Array(5)].map((_, i) => {
        // Calculate fill percentage for the current star index (0 to 4)
        const fillPercentage = Math.min(Math.max(displayRating - i, 0), 1) * 100;

        return (
          <div
            key={i}
            className="relative inline-block w-6 h-6 select-none"
            data-testid={`star-${i}`}
          >
            {/* Background Star (Gray/Outline) */}
            <Star
              className={cn(
                "w-full h-full text-gorola-slate-mist fill-gorola-slate-mist stroke-1",
                starClassName
              )}
            />

            {/* Foreground Star (Filled Saffron Orange) */}
            {fillPercentage > 0 && (
              <div
                className="absolute top-0 left-0 bottom-0 overflow-hidden pointer-events-none"
                style={{ width: `${fillPercentage}%` }}
                data-testid={`star-${i}-filled`}
              >
                <Star
                  className={cn(
                    "w-6 h-6 text-gorola-saffron fill-gorola-saffron stroke-0",
                    starClassName
                  )}
                  style={{ minWidth: "24px" }} // Prevent SVG from shrinking when parent width is cropped
                />
              </div>
            )}

            {/* Interactive Hot-spot Buttons */}
            {interactive && (
              <>
                {/* Left Half (0.5 increment) */}
                <button
                  type="button"
                  onClick={() => handleRatingChange(i + 0.5)}
                  onMouseEnter={() => !disabled && setHoverRating(i + 0.5)}
                  className={cn(
                    "absolute top-0 left-0 w-1/2 h-full opacity-0 z-10",
                    disabled ? "cursor-not-allowed" : "cursor-pointer"
                  )}
                  aria-label={`Rate ${(i + 0.5).toFixed(1)} stars`}
                  disabled={disabled}
                />
                {/* Right Half (1.0 increment) */}
                <button
                  type="button"
                  onClick={() => handleRatingChange(i + 1.0)}
                  onMouseEnter={() => !disabled && setHoverRating(i + 1.0)}
                  className={cn(
                    "absolute top-0 right-0 w-1/2 h-full opacity-0 z-10",
                    disabled ? "cursor-not-allowed" : "cursor-pointer"
                  )}
                  aria-label={`Rate ${(i + 1.0).toFixed(1)} stars`}
                  disabled={disabled}
                />
              </>
            )}
          </div>
        );
      })}
    </div>
  );
}
