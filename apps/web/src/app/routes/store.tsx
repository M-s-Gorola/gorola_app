import type { ReactElement } from "react";
import { Route } from "react-router-dom";
import { Link } from "react-router-dom";

import { StoreLayout } from "@/components/store/StoreLayout";
import { StoreDashboardPage } from "@/pages/store/StoreDashboardPage";
import { StoreLoginPage } from "@/pages/store/StoreLoginPage";
import { StoreOrdersPage } from "@/pages/store/StoreOrdersPage";
import { StoreSetup2FAPage } from "@/pages/store/StoreSetup2FAPage";
import { StoreTwoFactorPage } from "@/pages/store/StoreTwoFactorPage";

import { StoreRoute } from "./guards";

function PlaceholderPage({ title, prefix }: { title: string; prefix: string }): ReactElement {
  const backTo = prefix ? `${prefix}/dashboard` : "/dashboard";

  return (
    <section className="space-y-3">
      <h1 className="text-2xl font-semibold text-gorola-charcoal">{title}</h1>
      <p className="font-dm-sans text-sm text-gorola-slate">This page is not ready yet.</p>
      <Link
        to={backTo}
        className="inline-flex rounded-full border border-gorola-pine/20 px-3 py-2 text-sm font-semibold text-gorola-pine hover:bg-gorola-pine/5"
      >
        Back to Home
      </Link>
    </section>
  );
}

interface StoreRoutesProps {
  prefix?: string;
}

export function StoreRoutes({ prefix = "" }: StoreRoutesProps): ReactElement[] {
  return [
    <Route key="store-login" path={`${prefix}/login`} element={<StoreLoginPage />} />,
    <Route key="store-2fa" path={`${prefix}/2fa`} element={<StoreTwoFactorPage />} />,
    <Route key="store-setup-2fa" path={`${prefix}/setup-2fa`} element={<StoreSetup2FAPage />} />,
    <Route
      key="store-root"
      path={prefix || "/"}
      element={
        <StoreRoute>
          <StoreLayout>
            <PlaceholderPage title="Store Dashboard" prefix={prefix} />
          </StoreLayout>
        </StoreRoute>
      }
    />,
    <Route
      key="store-dashboard"
      path={`${prefix}/dashboard`}
      element={
        <StoreRoute>
          <StoreLayout>
            <StoreDashboardPage />
          </StoreLayout>
        </StoreRoute>
      }
    />,
    <Route
      key="store-orders"
      path={`${prefix}/orders`}
      element={
        <StoreRoute>
          <StoreLayout>
            <StoreOrdersPage />
          </StoreLayout>
        </StoreRoute>
      }
    />,
    <Route
      key="store-catalog"
      path={`${prefix}/catalog`}
      element={
        <StoreRoute>
          <StoreLayout>
            <PlaceholderPage title="Catalog" prefix={prefix} />
          </StoreLayout>
        </StoreRoute>
      }
    />,
    <Route
      key="store-settings"
      path={`${prefix}/settings`}
      element={
        <StoreRoute>
          <StoreLayout>
            <PlaceholderPage title="Settings" prefix={prefix} />
          </StoreLayout>
        </StoreRoute>
      }
    />
  ];
}
