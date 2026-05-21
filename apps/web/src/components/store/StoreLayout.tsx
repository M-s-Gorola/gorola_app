import { useQuery } from "@tanstack/react-query";
import { Menu } from "lucide-react";
import type { ReactElement, ReactNode } from "react";
import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import { getScopedPath, resolveSubdomain } from "@/lib/subdomain-resolver";
import { useAuthStore } from "@/store/auth.store";

type StoreLayoutProps = {
  children: ReactNode;
};

export function StoreLayout({ children }: StoreLayoutProps): ReactElement {
  const navigate = useNavigate();
  const location = useLocation();
  const clearSession = useAuthStore((s) => s.clearSession);
  const storeId = useAuthStore((s) => s.storeId);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  const { isSubdomainMode } = resolveSubdomain(window.location.hostname);

  const handleLogout = () => {
    const refreshToken = useAuthStore.getState().refreshToken;
    void api?.post("/api/v1/auth/store-owner/logout", { refreshToken }).catch(() => {});
    
    // Clear the sessionStorage override so navigating to the base URL
    // doesn't re-enter store subdomain mode and silently re-authenticate.
    sessionStorage.removeItem("gorola_subdomain_override");

    // Resolve the new subdomain mode dynamically after clearing the override
    const { isSubdomainMode: newIsSubdomainMode } = resolveSubdomain(window.location.hostname);

    // Navigate to the correctly resolved scoped path first
    navigate(getScopedPath("/store/login", "store", newIsSubdomainMode));

    // Defer state clearing to the next tick to prevent concurrent double-navigation
    // race conditions with the outer route guard during layout unmount.
    setTimeout(() => {
      clearSession();
    }, 0);
  };

  const { data: storeProfile } = useQuery({
    queryKey: ["store", "profile"],
    queryFn: async () => {
      if (!api) throw new Error("API helper not initialized");
      const res = await api.get<{ success: boolean; data: { storeType: string } }>("/api/v1/store/profile");
      return res.data.data;
    },
    enabled: !!storeId
  });

  const navItems = [
    { label: "Dashboard", path: getScopedPath("/store/dashboard", "store", isSubdomainMode) },
    { label: "Orders", path: getScopedPath("/store/orders", "store", isSubdomainMode) },
    { label: "Products", path: getScopedPath("/store/products", "store", isSubdomainMode) },
    ...(storeProfile?.storeType === "BOOKING_COMMERCE"
      ? [{ label: "Bookings", path: getScopedPath("/store/bookings", "store", isSubdomainMode) }]
      : []),
    { label: "Settings", path: getScopedPath("/store/settings", "store", isSubdomainMode) }
  ];

  return (
    <div className="flex min-h-screen bg-gorola-mint/5">
      {/* Sidebar Navigation */}
      <aside
        className={`hidden md:flex flex-col bg-white border-r border-gorola-mint/15 shadow-sm transition-all duration-300 ease-in-out ${
          isSidebarOpen ? "w-64" : "w-0 overflow-hidden border-r-0"
        }`}
      >
        <div className="flex h-16 items-center px-6 border-b border-gorola-mint/15 shrink-0">
          <Link className="flex items-center gap-2" to={getScopedPath("/store/dashboard", "store", isSubdomainMode)}>
            <span className="font-heading text-xl font-bold text-gorola-charcoal">GoRola <span className="text-gorola-pine">Store</span></span>
          </Link>
        </div>
        <nav className="flex-1 space-y-1 px-4 py-6 overflow-y-auto">
          {navItems.map((item) => {
            const isActive = location.pathname.startsWith(item.path);
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex items-center px-4 py-3 text-sm font-medium rounded-xl transition-all duration-200 ${
                  isActive
                    ? "bg-gorola-pine text-white shadow-md shadow-gorola-pine/20"
                    : "text-muted-foreground hover:bg-gorola-mint/10 hover:text-gorola-charcoal"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="p-4 border-t border-gorola-mint/15 shrink-0">
          <Button className="w-full justify-start gap-2 rounded-xl" onClick={handleLogout} variant="ghost">
            Logout
          </Button>
        </div>
      </aside>

      {/* Main Content Pane */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Header */}
        <header className="flex h-16 items-center justify-between bg-white px-6 border-b border-gorola-mint/15 shadow-sm">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className="hidden md:flex text-gorola-slate hover:text-gorola-pine hover:bg-gorola-mint/10 rounded-xl h-9 w-9 items-center justify-center transition-colors"
              title={isSidebarOpen ? "Collapse Sidebar" : "Expand Sidebar"}
              aria-label="Toggle Sidebar"
            >
              <Menu className="h-5 w-5" />
            </Button>
            <span className="text-sm font-semibold text-gorola-slate">Store ID: {storeId ?? "Unknown"}</span>
          </div>
          <div className="flex items-center gap-4">
            <Button className="md:hidden" onClick={handleLogout} variant="ghost" size="sm">
              Logout
            </Button>
            <div className="h-8 w-8 rounded-full bg-gorola-mint flex items-center justify-center font-bold text-gorola-charcoal text-sm">
              S
            </div>
          </div>
        </header>

        {/* Mobile Sub-Navigation Bar */}
        <nav className="flex md:hidden bg-white border-b border-gorola-mint/15 px-4 py-2 overflow-x-auto gap-2 scrollbar-none">
          {navItems.map((item) => {
            const isActive = location.pathname.startsWith(item.path);
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg whitespace-nowrap transition-colors ${
                  isActive
                    ? "bg-gorola-pine text-white"
                    : "text-muted-foreground hover:bg-gorola-mint/10 hover:text-gorola-charcoal"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* Dynamic Nested Content */}
        <main className="flex-1 overflow-y-auto p-6 md:p-10">
          <div className="mx-auto max-w-5xl">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
