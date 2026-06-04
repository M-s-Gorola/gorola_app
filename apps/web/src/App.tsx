import { QueryClientProvider } from "@tanstack/react-query";
import type { ReactElement } from "react";
import { useEffect } from "react";
import { Routes } from "react-router-dom";

import { AdminRoutes } from "@/app/routes/admin";
import { BuyerRoutes } from "@/app/routes/buyer";
import { StoreRoutes } from "@/app/routes/store";
import { DevWeatherToggle } from "@/components/shared/DevWeatherToggle";
import { Toaster } from "@/components/ui/sonner";
import { useGorolaMotion } from "@/hooks/useGorolaMotion";
import { useWeatherSync } from "@/hooks/useWeatherSync";
import { bootstrapAdminAuthSession, bootstrapBuyerAuthSession, bootstrapStoreOwnerAuthSession } from "@/lib/api";
import { queryClient } from "@/lib/query-client";
import { resolveSubdomain } from "@/lib/subdomain-resolver";
import { useWeatherStore } from "@/store/weather.store";

export function App(): ReactElement {
  useGorolaMotion();
  useWeatherSync();

  const isWeatherMode = useWeatherStore((s) => s.isWeatherMode);

  useEffect(() => {
    const { isSubdomainMode, subdomain } = resolveSubdomain(window.location.hostname);
    const isBuyerStorePage = !isSubdomainMode && window.location.pathname.match(/^\/store\/store_/);
    if (subdomain === "admin" || (!isSubdomainMode && window.location.pathname.startsWith("/admin"))) {
      void bootstrapAdminAuthSession();
    } else if (subdomain === "store" || (!isSubdomainMode && window.location.pathname.startsWith("/store") && !isBuyerStorePage)) {
      void bootstrapStoreOwnerAuthSession();
    } else {
      void bootstrapBuyerAuthSession();
    }
  }, []);

  useEffect(() => {
    if (isWeatherMode) {
      document.body.classList.add("weather-mode");
    } else {
      document.body.classList.remove("weather-mode");
    }
  }, [isWeatherMode]);

  const { isSubdomainMode, subdomain } = resolveSubdomain(window.location.hostname);

  return (
    <QueryClientProvider client={queryClient}>
      <Routes>
        {isSubdomainMode ? (
          subdomain === "store" ? (
            StoreRoutes({ prefix: "" })
          ) : subdomain === "admin" ? (
            AdminRoutes({ prefix: "" })
          ) : (
            BuyerRoutes()
          )
        ) : (
          <>
            {BuyerRoutes()}
            {StoreRoutes({ prefix: "/store" })}
            {AdminRoutes({ prefix: "/admin" })}
          </>
        )}
      </Routes>
      <Toaster position="bottom-left" />
      <DevWeatherToggle />
    </QueryClientProvider>
  );
}
