import type { ReactElement } from "react";
import { Link } from "react-router-dom";

import { cn } from "@/lib/utils";
import { useWeatherStore } from "@/store/weather.store";

export function BuyerFooter(): ReactElement {
  const isWeatherMode = useWeatherStore((s) => s.isWeatherMode);

  return (
    <footer
      className={cn(
        "mt-auto border-t px-4 py-6 transition-colors duration-500",
        isWeatherMode
          ? "border-gorola-slate bg-gorola-slate text-gorola-fog"
          : "border-gorola-pine/20 bg-gorola-footer-gradient text-gorola-charcoal"
      )}
      role="contentinfo"
    >
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between text-sm">
        <p>GoRola - Mussoorie, delivered.</p>
        <div className="flex items-center gap-4">
          <Link to="/about" className="hover:underline">
            About
          </Link>
          <Link to="/support" className="hover:underline">
            Support
          </Link>
        </div>
      </div>
    </footer>
  );
}
