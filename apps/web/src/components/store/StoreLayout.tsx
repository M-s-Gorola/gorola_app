import type { ReactElement, ReactNode } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { useAuthStore } from "@/store/auth.store";

type StoreLayoutProps = {
  children: ReactNode;
};

export function StoreLayout({ children }: StoreLayoutProps): ReactElement {
  const navigate = useNavigate();
  const location = useLocation();
  const clearSession = useAuthStore((s) => s.clearSession);
  const storeId = useAuthStore((s) => s.storeId);

  const handleLogout = () => {
    clearSession();
    navigate("/store/login");
  };

  const navItems = [
    { label: "Dashboard", path: "/store/dashboard" },
    { label: "Orders", path: "/store/orders" },
    { label: "Catalog", path: "/store/catalog" },
    { label: "Settings", path: "/store/settings" }
  ];

  return (
    <div className="flex min-h-screen bg-gorola-mint/5">
      {/* Sidebar Navigation */}
      <aside className="hidden md:flex w-64 flex-col bg-white border-r border-gorola-mint/15 shadow-sm">
        <div className="flex h-16 items-center px-6 border-b border-gorola-mint/15">
          <Link className="flex items-center gap-2" to="/store/dashboard">
            <span className="font-heading text-xl font-bold text-gorola-charcoal">GoRola <span className="text-gorola-pine">Store</span></span>
          </Link>
        </div>
        <nav className="flex-1 space-y-1 px-4 py-6">
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
        <div className="p-4 border-t border-gorola-mint/15">
          <Button className="w-full justify-start gap-2 rounded-xl" onClick={handleLogout} variant="ghost">
            Logout
          </Button>
        </div>
      </aside>

      {/* Main Content Pane */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Header */}
        <header className="flex h-16 items-center justify-between bg-white px-6 border-b border-gorola-mint/15 shadow-sm">
          <div className="flex items-center gap-4">
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
