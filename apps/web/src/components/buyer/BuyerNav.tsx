import { MapPin, Search, ShoppingCart, UserRound } from "lucide-react";
import type { KeyboardEvent, ReactElement } from "react";
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import { GorolaMountainMark } from "@/components/shared/GorolaMountainMark";
import { cn } from "@/lib/utils";
import { useCartStore } from "@/store/cart.store";
import { useWeatherStore } from "@/store/weather.store";

export function BuyerNav(): ReactElement {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const count = useCartStore((s) => s.totalItemCount());
  const isWeatherMode = useWeatherStore((s) => s.isWeatherMode);

  const handleEnter = (event: KeyboardEvent<HTMLInputElement>): void => {
    if (event.key !== "Enter") {
      return;
    }
    const query = search.trim();
    navigate(query.length > 0 ? `/search?q=${encodeURIComponent(query)}` : "/search");
  };

  return (
    <nav
      className={cn(
        "sticky top-0 z-50 border-b border-white/10 px-4 py-3 backdrop-blur",
        isWeatherMode ? "bg-gorola-slate/95" : "bg-gorola-pine/95"
      )}
      data-weather={isWeatherMode ? "on" : "off"}
      aria-label="Buyer navigation"
    >
      <div className="mx-auto flex w-full max-w-6xl items-center gap-3">
        <Link to="/" className="flex items-center gap-2 text-gorola-fog">
          <span aria-label="GoRola mountain logo">
            <GorolaMountainMark />
          </span>
          <span className="font-playfair text-xl tracking-wide">GoRola</span>
        </Link>

        <div className="flex items-center gap-1 rounded-lg bg-white/10 px-3 py-1.5 text-sm text-gorola-fog">
          <MapPin size={14} className="text-gorola-saffron" />
          <span>Kulri, Mussoorie</span>
        </div>

        <div className="relative ml-auto flex w-full max-w-sm items-center md:ml-0">
          <Search size={15} className="pointer-events-none absolute left-3 text-white/60" />
          <input
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
            }}
            onKeyDown={handleEnter}
            placeholder="Search products"
            className="w-full rounded-xl border border-white/20 bg-white/10 py-2 pl-9 pr-3 text-sm text-gorola-fog outline-none placeholder:text-white/60"
          />
        </div>

        <Link
          to="/cart"
          className="relative inline-flex items-center gap-2 rounded-full bg-gorola-saffron px-3 py-2 text-sm font-semibold text-white"
        >
          <ShoppingCart size={15} />
          <span className="hidden sm:inline">Cart</span>
          <span
            className="absolute -right-1 -top-1 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-gorola-amber px-1 text-[11px] font-bold text-gorola-charcoal"
            aria-label="Cart items"
          >
            {count}
          </span>
        </Link>

        <Link
          to="/login"
          className="inline-flex items-center gap-1 rounded-full border border-white/30 px-3 py-2 text-sm text-gorola-fog"
        >
          <UserRound size={15} />
          <span className="hidden sm:inline">Login</span>
        </Link>
      </div>
    </nav>
  );
}
