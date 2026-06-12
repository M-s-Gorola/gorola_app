import { LogOut, MapPin, Search, ShoppingCart, UserRound } from "lucide-react";
import type { FormEvent, ReactElement } from "react";
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import { GorolaMountainMark } from "@/components/shared/GorolaMountainMark";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/store/auth.store";
import { useCartStore } from "@/store/cart.store";
import { useWeatherStore } from "@/store/weather.store";

import goRolaTextImg from "../shared/GoRola_text_without_bg-Photoroom.png";

export function BuyerNav(): ReactElement {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const count = useCartStore((s) => s.totalItemCount());
  const openCart = useCartStore((s) => s.open);
  const isWeatherMode = useWeatherStore((s) => s.isWeatherMode);
  const role = useAuthStore((s) => s.role);
  const name = useAuthStore((s) => s.name);
  const phone = useAuthStore((s) => s.phone);
  const refreshToken = useAuthStore((s) => s.refreshToken);
  const clearSession = useAuthStore((s) => s.clearSession);

  const buyerLabel =
    name !== null && name.trim().length > 0 ? name.trim() : (phone !== null ? phone : "Buyer");

  async function logoutBuyer(): Promise<void> {
    try {
      if (api !== null && refreshToken !== null && refreshToken.length > 0) {
        await api.post("/api/v1/auth/buyer/logout", { refreshToken });
      }
    } finally {
      clearSession();
      navigate("/", { replace: true });
    }
  }

  const handleSearchSubmit = (event: FormEvent): void => {
    event.preventDefault();
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
      <div className="mx-auto flex w-full max-w-6xl items-center gap-4">
        {/* Left: Logo & Location */}
        <div className="flex shrink-0 items-center gap-3">
          <Link to="/" className={cn("flex items-center gap-2", isWeatherMode ? "text-gorola-fog" : "text-gorola-charcoal")}>
            <span aria-label="GoRola mountain logo">
              <GorolaMountainMark color={isWeatherMode ? "var(--gorola-fog)" : "var(--gorola-charcoal)"} secondaryColor="var(--gorola-saffron)" />
            </span>
            <img
              src={goRolaTextImg}
              alt="GoRola"
              className="object-contain hidden sm:block"
              style={{ height: "32px", width: "auto" }}
            />
          </Link>

          <div className={cn(
            "hidden sm:flex items-center gap-1 rounded-lg px-3 py-1.5 text-sm",
            isWeatherMode ? "bg-white/10 text-gorola-fog" : "bg-gorola-charcoal/10 text-gorola-charcoal"
          )}>
            <MapPin size={14} className="text-gorola-saffron" />
            <span>Kulri, Mussoorie</span>
          </div>
        </div>

        <form
          onSubmit={handleSearchSubmit}
          className="relative flex flex-1 items-center"
        >
          <Search size={15} className={cn("pointer-events-none absolute left-3", isWeatherMode ? "text-white/60" : "text-gorola-charcoal/60")} />
          <input
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
            }}
            placeholder="Search products"
            className={cn(
              "w-full rounded-xl border py-2 pl-9 pr-3 text-sm outline-none transition-all",
              isWeatherMode
                ? "border-white/20 bg-white/10 text-gorola-fog placeholder:text-white/60 focus:bg-white/15 focus:border-white/30"
                : "border-gorola-charcoal/20 bg-white/60 text-gorola-charcoal placeholder:text-gorola-charcoal/60 focus:bg-white focus:border-gorola-charcoal/40"
            )}
          />
        </form>

        {/* Right: Cart & Profile */}
        <div className="hidden sm:flex shrink-0 items-center gap-3">
          <button
            type="button"
            aria-label="Cart"
            data-testid="cart-button"
            onClick={openCart}
            className="relative inline-flex items-center justify-center rounded-full bg-gorola-saffron p-2.5 text-white transition-transform hover:scale-105 active:scale-95 focus:outline-none"
          >
            <ShoppingCart size={18} />
            {count > 0 && (
              <span
                className="absolute -right-1 -top-1 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-gorola-amber px-1 text-[11px] font-bold text-gorola-charcoal shadow-sm"
                aria-label="Cart items"
                data-testid="cart-badge"
              >
                {count}
              </span>
            )}
          </button>

          {role === "BUYER" ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  aria-label="Profile"
                  className={cn(
                    "inline-flex items-center justify-center rounded-full border p-2.5 transition-all hover:scale-105 active:scale-95 focus:outline-none focus:ring-offset-0 ring-[3px] ring-gorola-saffron",
                    isWeatherMode ? "border-white/30 text-gorola-fog" : "border-gorola-charcoal/30 text-gorola-charcoal"
                  )}
                >
                  <UserRound size={18} />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="end"
                className={cn(
                  "w-56 border transition-colors duration-300",
                  isWeatherMode
                    ? "bg-gorola-slate text-gorola-fog border-white/10"
                    : "bg-white text-gorola-charcoal border-gorola-charcoal/10"
                )}
              >
                <DropdownMenuLabel className={cn("font-playfair text-lg", isWeatherMode ? "text-white" : "text-gorola-charcoal")}>
                  {buyerLabel}
                </DropdownMenuLabel>
                <DropdownMenuSeparator className={isWeatherMode ? "bg-white/10" : "bg-gorola-charcoal/10"} />
                <DropdownMenuItem
                  asChild
                  className={cn(
                    "cursor-pointer focus:bg-white/10",
                    isWeatherMode ? "focus:text-gorola-fog" : "focus:bg-gorola-charcoal/5 focus:text-gorola-charcoal"
                  )}
                >
                  <Link to="/profile" className="flex items-center gap-2 w-full">
                    <UserRound size={16} />
                    <span>Profile</span>
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator className={isWeatherMode ? "bg-white/10" : "bg-gorola-charcoal/10"} />
                <DropdownMenuItem
                  onClick={() => {
                    void logoutBuyer();
                  }}
                  className="cursor-pointer text-red-400 focus:bg-red-400/10 focus:text-red-400"
                >
                  <LogOut size={16} className="mr-2" />
                  <span>Logout</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <Link
              to="/login"
              aria-label="Login"
              className={cn(
                "inline-flex items-center justify-center rounded-full border p-2.5 transition-all hover:scale-105 active:scale-95 focus:outline-none focus:ring-offset-0 ring-[3px] ring-gorola-saffron",
                isWeatherMode ? "border-white/30 text-gorola-fog" : "border-gorola-charcoal/30 text-gorola-charcoal"
              )}
            >
              <UserRound size={18} />
            </Link>
          )}
        </div>
      </div>
    </nav>
  );
}
