import { useQuery } from "@tanstack/react-query";
import { Menu } from "lucide-react";
import type { ReactElement, ReactNode } from "react";
import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";

import { GorolaMountainMark } from "@/components/shared/GorolaMountainMark";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import { getScopedPath, resolveSubdomain } from "@/lib/subdomain-resolver";
import { useAuthStore } from "@/store/auth.store";

type AdminLayoutProps = {
  children: ReactNode;
};

export function AdminLayout({ children }: AdminLayoutProps): ReactElement {
  const navigate = useNavigate();
  const location = useLocation();
  const clearSession = useAuthStore((s) => s.clearSession);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  const { isSubdomainMode } = resolveSubdomain(window.location.hostname);

  const handleLogout = () => {
    const refreshToken = useAuthStore.getState().refreshToken;
    void api?.post("/api/v1/auth/admin/logout", { refreshToken }).catch(() => {});
    
    sessionStorage.removeItem("gorola_subdomain_override");

    const { isSubdomainMode: newIsSubdomainMode } = resolveSubdomain(window.location.hostname);

    navigate(getScopedPath("/admin/login", "admin", newIsSubdomainMode));

    setTimeout(() => {
      clearSession();
    }, 0);
  };

  const { data: dashboard } = useQuery({
    queryKey: ["admin", "dashboard"],
    queryFn: async () => {
      if (!api) throw new Error("API helper not initialized");
      const res = await api.get<{ success: boolean; data: { pendingAdApprovalsCount: number } }>("/api/v1/admin/dashboard");
      return res.data.data;
    },
    staleTime: 30000,
    enabled: useAuthStore.getState().role === "ADMIN" && !!useAuthStore.getState().accessToken
  });

  const navItems = [
    { label: "Dashboard", path: getScopedPath("/admin/dashboard", "admin", isSubdomainMode) },
    { label: "Orders", path: getScopedPath("/admin/orders", "admin", isSubdomainMode) },
    { label: "Users", path: getScopedPath("/admin/users", "admin", isSubdomainMode) },
    { label: "Stores", path: getScopedPath("/admin/stores", "admin", isSubdomainMode) },
    { label: "Categories", path: getScopedPath("/admin/categories", "admin", isSubdomainMode) },
    { label: "Feature Flags", path: getScopedPath("/admin/feature-flags", "admin", isSubdomainMode) },
    {
      label: "Advertisements",
      path: getScopedPath("/admin/ads", "admin", isSubdomainMode),
      badge: dashboard?.pendingAdApprovalsCount && dashboard.pendingAdApprovalsCount > 0 ? (
        <span data-testid="pending-ads-badge" className="ml-auto bg-red-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0">
          {dashboard.pendingAdApprovalsCount}
        </span>
      ) : null
    },
    { label: "Audit Logs", path: getScopedPath("/admin/audit-logs", "admin", isSubdomainMode) }
  ];

  return (
    <div className="flex min-h-screen bg-gorola-mint/5">
      {/* Sidebar Navigation */}
      <aside
        className={`hidden md:flex flex-col bg-white border-r border-gorola-mint/15 shadow-sm transition-all duration-300 ease-in-out sticky top-0 h-screen shrink-0 ${
          isSidebarOpen ? "w-48 lg:w-64" : "w-0 overflow-hidden border-r-0"
        }`}
      >
        <div className="h-16 border-b border-gorola-mint/15 shrink-0" />
        <nav className="flex-1 space-y-1 px-2 lg:px-4 py-6 overflow-y-auto">
           {navItems.map((item) => {
             const isActive = location.pathname.startsWith(item.path);
             return (
               <Link
                 key={item.path}
                 to={item.path}
                 className={`flex items-center w-full px-3 lg:px-4 py-3 text-sm font-medium rounded-xl transition-all duration-200 ${
                   isActive
                     ? "bg-gorola-pine text-white shadow-md shadow-gorola-pine/20"
                     : "text-muted-foreground hover:bg-gorola-mint/10 hover:text-gorola-charcoal"
                 }`}
               >
                 <span className="truncate">{item.label}</span>
                 {"badge" in item && item.badge}
               </Link>
             );
           })}
        </nav>
      </aside>

      {/* Main Content Pane */}
      <div className="flex flex-1 flex-col min-w-0">
        {/* Header */}
        <header className="flex h-16 items-center justify-between bg-white px-6 border-b border-gorola-mint/15 shadow-sm sticky top-0 z-30 w-full shrink-0">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className="hidden md:flex text-gorola-slate hover:text-gorola-pine hover:bg-gorola-mint/10 rounded-xl h-9 w-9 items-center justify-center transition-colors shrink-0"
              title={isSidebarOpen ? "Collapse Sidebar" : "Expand Sidebar"}
              aria-label="Toggle Sidebar"
            >
              <Menu className="h-5 w-5" />
            </Button>
            <Link className="flex items-center gap-2 shrink-0" to={getScopedPath("/admin/dashboard", "admin", isSubdomainMode)}>
              <GorolaMountainMark color="var(--gorola-pine)" secondaryColor="var(--gorola-charcoal)" />
              <span className="font-heading text-xl font-bold text-gorola-charcoal hidden md:inline">GoRola <span className="text-gorola-pine">Admin</span></span>
            </Link>
            <span className="hidden md:inline text-gorola-mint/30 font-light">|</span>
            <span className="text-lg font-bold text-gorola-charcoal truncate">
              Platform Control
            </span>
          </div>
          <div className="flex items-center gap-4">
            <Button onClick={handleLogout} variant="ghost" size="sm" className="text-gorola-slate hover:text-red-600 hover:bg-red-50 rounded-xl transition-colors font-semibold">
              Logout
            </Button>
          </div>
        </header>

        {/* Mobile Sub-Navigation Bar */}
         <nav className="flex md:hidden bg-white border-b border-gorola-mint/15 px-4 py-2 overflow-x-auto gap-2 scrollbar-none sticky top-16 z-20 w-full shrink-0">
           {navItems.map((item) => {
             const isActive = location.pathname.startsWith(item.path);
             return (
               <Link
                 key={item.path}
                 to={item.path}
                 className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg whitespace-nowrap transition-colors ${
                   isActive
                     ? "bg-gorola-pine text-white"
                     : "text-muted-foreground hover:bg-gorola-mint/10 hover:text-gorola-charcoal"
                 }`}
               >
                 <span>{item.label}</span>
                 {"badge" in item && item.badge}
               </Link>
             );
           })}
         </nav>

        {/* Dynamic Nested Content */}
        <main className="flex-1 p-6 md:p-8 lg:p-10">
          <div className="mx-auto max-w-5xl">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
