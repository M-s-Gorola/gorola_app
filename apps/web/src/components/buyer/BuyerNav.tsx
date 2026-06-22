import { LogOut, MapPin, Search, ShoppingCart, UserRound } from "lucide-react";
import type { FormEvent, ReactElement } from "react";
import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useSearchSuggestions } from "@/hooks/useSearchSuggestions";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/store/auth.store";
import { useCartStore } from "@/store/cart.store";
import { useWeatherStore } from "@/store/weather.store";

import logoBigScreen from "../shared/logo_big_screen_new_cropped.png";
import logoSmallScreen from "../shared/logo_small_screen_new_cropped.png";

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

  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
    }, 200);
    return () => clearTimeout(timer);
  }, [search]);

  const { data: suggestions = [] } = useSearchSuggestions(debouncedSearch);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setShowSuggestions(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

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
        "sticky top-0 z-50 border-b border-white/10 px-4 h-[68px] flex items-center backdrop-blur",
        isWeatherMode ? "bg-gorola-slate/95" : "bg-gorola-pine/95"
      )}
      data-weather={isWeatherMode ? "on" : "off"}
      aria-label="Buyer navigation"
    >
      <div className="mx-auto flex w-full max-w-6xl items-center gap-4">
        {/* Left: Logo & Location */}
        <div className="flex shrink-0 items-center gap-3">
          <Link to="/" className={cn("flex items-center gap-2", isWeatherMode ? "text-gorola-fog" : "text-gorola-charcoal")}>
            <span aria-label="GoRola mountain logo" className="flex items-center h-[68px] overflow-visible">
              <img
                src={logoBigScreen}
                alt="GoRola"
                data-testid="gorola-mountain-mark"
                className="object-contain hidden sm:block max-w-none"
                style={{ height: "55px", width: "auto" }}
              />
              <img
                src={logoSmallScreen}
                alt="GoRola Mobile"
                data-testid="gorola-mountain-mark"
                className="object-contain block sm:hidden max-w-none"
                style={{ height: "40px", width: "auto" }}
              />
            </span>
          </Link>

          <div className={cn(
            "hidden sm:flex items-center gap-1 rounded-lg px-3 py-1.5 text-sm",
            isWeatherMode ? "bg-white/10 text-gorola-fog" : "bg-gorola-charcoal/10 text-gorola-charcoal"
          )}>
            <MapPin size={14} className="text-gorola-saffron" />
            <span>Kulri, Mussoorie</span>
          </div>
        </div>

        <div ref={containerRef} className="relative flex flex-1">
          <form
            onSubmit={handleSearchSubmit}
            className="relative flex flex-1 items-center"
          >
            <Search size={15} className={cn("pointer-events-none absolute left-3", isWeatherMode ? "text-white/60" : "text-gorola-charcoal/60")} />
            <input
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setShowSuggestions(true);
              }}
              onFocus={() => setShowSuggestions(true)}
              placeholder="Search products"
              className={cn(
                "w-full rounded-xl border py-2 pl-9 pr-3 text-sm outline-none transition-all",
                isWeatherMode
                  ? "border-white/20 bg-white/10 text-gorola-fog placeholder:text-white/60 focus:bg-white/15 focus:border-white/30"
                  : "border-gorola-charcoal/20 bg-white/60 text-gorola-charcoal placeholder:text-gorola-charcoal/60 focus:bg-white focus:border-gorola-charcoal/40"
              )}
            />
          </form>

          {showSuggestions && search.trim().length > 0 && suggestions.length > 0 && (
            <div className={cn(
              "absolute top-full left-0 right-0 mt-2 z-50 rounded-2xl border shadow-xl max-h-80 overflow-y-auto backdrop-blur-md transition-all duration-200 animate-in fade-in slide-in-from-top-2",
              isWeatherMode
                ? "bg-gorola-slate/95 border-white/10 text-gorola-fog"
                : "bg-white/95 border-gorola-charcoal/10 text-gorola-charcoal"
            )}>
              <div className="p-2 space-y-1">
                {suggestions.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      navigate(item.redirectUrl);
                      setShowSuggestions(false);
                      setSearch("");
                    }}
                    className={cn(
                      "w-full flex items-center justify-between p-3 rounded-xl transition-all duration-200 text-left cursor-pointer",
                      isWeatherMode
                        ? "hover:bg-white/10 text-gorola-fog"
                        : "hover:bg-gorola-mint/20 text-gorola-charcoal"
                    )}
                  >
                    <span className="text-sm font-semibold truncate pr-4">{item.name}</span>
                    <span className={cn(
                      "text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full shrink-0",
                      item.type === "product"
                        ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300"
                        : item.type === "service"
                        ? "bg-purple-100 text-purple-800 dark:bg-purple-950/50 dark:text-purple-300"
                        : item.type === "category"
                        ? "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300"
                        : "bg-sky-100 text-sky-700 dark:bg-sky-900/50 dark:text-sky-300"
                    )}>
                      {item.type}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

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
