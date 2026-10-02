import type { ReactElement } from "react";
import { Link } from "react-router-dom";

import { cn } from "@/lib/utils";
import { useWeatherStore } from "@/store/weather.store";

export function BuyerFooter(): ReactElement {
  const isWeatherMode = useWeatherStore((s) => s.isWeatherMode);

  return (
    <footer
      className={cn(
        "mt-auto border-t px-4 pt-6 pb-24 sm:py-6 transition-colors duration-500",
        isWeatherMode
          ? "border-gorola-slate bg-gorola-slate text-gorola-fog"
          : "border-gorola-pine/20 bg-gorola-footer-gradient text-gorola-charcoal"
      )}
      role="contentinfo"
    >
      <div className="mx-auto flex w-full max-w-6xl flex-col items-center justify-between gap-4 text-xs sm:flex-row sm:text-sm">
        <p>GoRola — Mussoorie, delivered.</p>
        <div className="flex flex-wrap items-center justify-center gap-4">
          <Link to="/about" className="hover:underline">
            About
          </Link>
          <Link to="/support" className="hover:underline">
            Support
          </Link>
          <Link to="/privacy" className="hover:underline">
            Privacy
          </Link>
          <Link to="/terms" className="hover:underline">
            Terms
          </Link>
        </div>
      </div>
    </footer>
  );
}
