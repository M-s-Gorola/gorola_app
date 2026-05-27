import type { ReactElement } from "react";
import { Link, Navigate, Route } from "react-router-dom";

import { StoreLayout } from "@/components/store/StoreLayout";
import { StoreAdvertisementsPage } from "@/pages/store/StoreAdvertisementsPage";
import { StoreBookingsPage } from "@/pages/store/StoreBookingsPage";
import { StoreDashboardPage } from "@/pages/store/StoreDashboardPage";
import { StoreDiscountsPage } from "@/pages/store/StoreDiscountsPage";
import { StoreLoginPage } from "@/pages/store/StoreLoginPage";
import { StoreOffersPage } from "@/pages/store/StoreOffersPage";
import { StoreOrdersPage } from "@/pages/store/StoreOrdersPage";
import { StoreProductFormPage } from "@/pages/store/StoreProductFormPage";
import { StoreProductsPage } from "@/pages/store/StoreProductsPage";
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
          <Navigate to={prefix ? `${prefix}/dashboard` : "/dashboard"} replace />
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
      key="store-products"
      path={`${prefix}/products`}
      element={
        <StoreRoute>
          <StoreLayout>
            <StoreProductsPage />
          </StoreLayout>
        </StoreRoute>
      }
    />,
    <Route
      key="store-products-new"
      path={`${prefix}/products/new`}
      element={
        <StoreRoute>
          <StoreLayout>
            <StoreProductFormPage />
          </StoreLayout>
        </StoreRoute>
      }
    />,
    <Route
      key="store-products-edit"
      path={`${prefix}/products/:id/edit`}
      element={
        <StoreRoute>
          <StoreLayout>
            <StoreProductFormPage />
          </StoreLayout>
        </StoreRoute>
      }
    />,
    <Route
      key="store-catalog"
      path={`${prefix}/catalog`}
      element={
        <Navigate to={prefix ? `${prefix}/products` : "/products"} replace />
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
    />,
    <Route
      key="store-bookings"
      path={`${prefix}/bookings`}
      element={
        <StoreRoute>
          <StoreLayout>
            <StoreBookingsPage />
          </StoreLayout>
        </StoreRoute>
      }
    />,
    <Route
      key="store-advertisements"
      path={`${prefix}/advertisements`}
      element={
        <StoreRoute>
          <StoreLayout>
            <StoreAdvertisementsPage />
          </StoreLayout>
        </StoreRoute>
      }
    />,
    <Route
      key="store-offers"
      path={`${prefix}/offers`}
      element={
        <StoreRoute>
          <StoreLayout>
            <StoreOffersPage />
          </StoreLayout>
        </StoreRoute>
      }
    />,
    <Route
      key="store-discounts"
      path={`${prefix}/discounts`}
      element={
        <StoreRoute>
          <StoreLayout>
            <StoreDiscountsPage />
          </StoreLayout>
        </StoreRoute>
      }
    />
  ];
}
