import type { ReactElement } from "react";
import { Navigate, Route } from "react-router-dom";

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
import { StoreSettingsPage } from "@/pages/store/StoreSettingsPage";
import { StoreSetup2FAPage } from "@/pages/store/StoreSetup2FAPage";
import { StoreTwoFactorPage } from "@/pages/store/StoreTwoFactorPage";

import { StoreRoute } from "./guards";



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
            <StoreSettingsPage />
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
