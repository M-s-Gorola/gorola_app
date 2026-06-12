import { ClipboardList, Home, ShoppingCart, UserRound } from "lucide-react";
import type { ReactElement, ReactNode } from "react";
import { Link, useLocation } from "react-router-dom";

import { BuyerCartHydration } from "@/components/buyer/BuyerCartHydration";
import { BuyerFooter } from "@/components/buyer/BuyerFooter";
import { BuyerNav } from "@/components/buyer/BuyerNav";
import { CartDrawer } from "@/components/buyer/CartDrawer";
import { cn } from "@/lib/utils";
import { useCartStore } from "@/store/cart.store";
import { useWeatherStore } from "@/store/weather.store";

type BuyerLayoutProps = {
  children: ReactNode;
};

export function BuyerLayout({ children }: BuyerLayoutProps): ReactElement {
  const location = useLocation();
  const isWeatherMode = useWeatherStore((s) => s.isWeatherMode);
  
  const count = useCartStore((s) => s.totalItemCount());
  const openCart = useCartStore((s) => s.open);

  const isHomeActive = location.pathname === "/";
  const isOrdersActive = location.pathname === "/account/orders" || location.pathname.startsWith("/account/orders/");
  const isProfileActive = location.pathname === "/profile" || location.pathname.startsWith("/profile/");

  return (
    <div className="flex min-h-screen flex-col bg-background transition-colors duration-500 ease-in-out">
      <BuyerCartHydration />
      <BuyerNav />
      <CartDrawer />
      <main className="mx-auto w-full max-w-6xl flex-1 px-2 sm:px-4 py-6 pb-20 sm:pb-6" role="main">
        {children}
      </main>
      
      {/* Mobile Bottom Navigation Bar */}
      <nav
        aria-label="Mobile navigation"
        className={cn(
          "sm:hidden fixed bottom-0 left-0 right-0 z-50 h-16 border-t flex justify-around items-center px-4 shadow-[0_-2px_10px_rgba(0,0,0,0.05)] pb-safe transition-colors duration-300",
          isWeatherMode
            ? "bg-gorola-slate border-white/10 text-gorola-fog"
            : "bg-white border-gorola-fog text-gorola-charcoal"
        )}
      >
        <Link
          to="/"
          className={cn(
            "flex flex-col items-center justify-center gap-0.5 w-16 h-16 transition-all select-none relative",
            isHomeActive
              ? (isWeatherMode ? "text-white font-bold" : "text-gorola-pine font-bold")
              : "text-muted-foreground hover:text-gorola-charcoal"
          )}
          aria-label="Home"
        >
          {isHomeActive && (
            <span className={cn("absolute top-0 left-2 right-2 h-1 rounded-b-full", isWeatherMode ? "bg-white" : "bg-gorola-pine")} />
          )}
          <Home className="h-6 w-6" />
          <span className="text-[9px] font-medium tracking-wide">Home</span>
        </Link>

        <Link
          to="/account/orders"
          className={cn(
            "flex flex-col items-center justify-center gap-0.5 w-16 h-16 transition-all select-none relative",
            isOrdersActive
              ? (isWeatherMode ? "text-white font-bold" : "text-gorola-pine font-bold")
              : "text-muted-foreground hover:text-gorola-charcoal"
          )}
          aria-label="Orders"
        >
          {isOrdersActive && (
            <span className={cn("absolute top-0 left-2 right-2 h-1 rounded-b-full", isWeatherMode ? "bg-white" : "bg-gorola-pine")} />
          )}
          <ClipboardList className="h-6 w-6" />
          <span className="text-[9px] font-medium tracking-wide">Orders</span>
        </Link>

        <button
          type="button"
          data-testid="mobile-cart-button"
          onClick={openCart}
          className="flex flex-col items-center justify-center gap-0.5 w-16 h-16 transition-all select-none text-muted-foreground hover:text-gorola-charcoal relative"
          aria-label="Cart"
        >
          <ShoppingCart className="h-6 w-6" />
          <span className="text-[9px] font-medium tracking-wide">Cart</span>
          {count > 0 && (
            <span
              data-testid="mobile-cart-badge"
              className="absolute right-2.5 top-2 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-gorola-amber px-1 text-[9px] font-bold text-gorola-charcoal shadow-sm"
              aria-label="Cart items"
            >
              {count}
            </span>
          )}
        </button>

        <Link
          to="/profile"
          className={cn(
            "flex flex-col items-center justify-center gap-0.5 w-16 h-16 transition-all select-none relative",
            isProfileActive
              ? (isWeatherMode ? "text-white font-bold" : "text-gorola-pine font-bold")
              : "text-muted-foreground hover:text-gorola-charcoal"
          )}
          aria-label="Profile"
        >
          {isProfileActive && (
            <span className={cn("absolute top-0 left-2 right-2 h-1 rounded-b-full", isWeatherMode ? "bg-white" : "bg-gorola-pine")} />
          )}
          <UserRound className="h-6 w-6" />
          <span className="text-[9px] font-medium tracking-wide">Profile</span>
        </Link>
      </nav>

      <BuyerFooter />
    </div>
  );
}

