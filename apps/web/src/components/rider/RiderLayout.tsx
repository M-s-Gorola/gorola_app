import { ClipboardList, User } from "lucide-react";
import type { ReactElement, ReactNode } from "react";
import { Link, useLocation } from "react-router-dom";

import { GorolaMountainMark } from "@/components/shared/GorolaMountainMark";
import { getScopedPath, resolveSubdomain } from "@/lib/subdomain-resolver";

type RiderLayoutProps = {
  children: ReactNode;
};

export function RiderLayout({ children }: RiderLayoutProps): ReactElement {
  const location = useLocation();
  const { isSubdomainMode } = resolveSubdomain(window.location.hostname);

  const ordersPath = getScopedPath("/rider/orders", "rider", isSubdomainMode);
  const accountPath = getScopedPath("/rider/account", "rider", isSubdomainMode);

  // Helper to determine if a route is active.
  // We check if the pathname starts with the tab path (except root / fallbacks)
  const isOrdersActive = location.pathname === ordersPath || location.pathname.startsWith(ordersPath + "/");
  const isAccountActive = location.pathname === accountPath || location.pathname.startsWith(accountPath + "/");

  return (
    <div className="flex min-h-screen flex-col bg-gorola-fog/30 font-sans">
      {/* Header */}
      <header className="flex h-16 items-center justify-between bg-white px-6 border-b border-gorola-mint/15 shadow-sm sticky top-0 z-30 w-full shrink-0">
        <div className="flex items-center gap-3">
          <Link className="flex items-center gap-2 shrink-0 animate-in fade-in duration-300 h-12" to={ordersPath} aria-label="GoRola Rider Logo Link">
            <GorolaMountainMark color="var(--gorola-pine)" secondaryColor="var(--gorola-charcoal)" />
            <span className="font-heading text-xl font-bold text-gorola-charcoal">
              GoRola <span className="text-gorola-pine font-black">Rider</span>
            </span>
          </Link>
        </div>
      </header>

      {/* Scrollable Main content area */}
      <main className="flex-1 pb-20">
        <div className="mx-auto max-w-md px-4 py-6">
          {children}
        </div>
      </main>

      {/* Bottom Tab Bar Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 z-30 h-16 border-t border-gorola-fog bg-white flex justify-around items-center px-6 shadow-[0_-2px_10px_rgba(0,0,0,0.03)] pb-safe">
        <Link
          to={ordersPath}
          className={`flex flex-col items-center justify-center gap-1 w-20 py-2 h-12 rounded-xl transition-colors select-none ${
            isOrdersActive
              ? "text-gorola-pine font-bold"
              : "text-muted-foreground hover:text-gorola-charcoal"
          }`}
          aria-label="Orders"
        >
          <ClipboardList className="h-5 w-5" />
          <span className="text-[10px] tracking-wide">Orders</span>
        </Link>

        <Link
          to={accountPath}
          className={`flex flex-col items-center justify-center gap-1 w-20 py-2 h-12 rounded-xl transition-colors select-none ${
            isAccountActive
              ? "text-gorola-pine font-bold"
              : "text-muted-foreground hover:text-gorola-charcoal"
          }`}
          aria-label="Account"
        >
          <User className="h-5 w-5" />
          <span className="text-[10px] tracking-wide">Account</span>
        </Link>
      </nav>
    </div>
  );
}
