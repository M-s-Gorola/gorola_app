import type { ReactElement } from "react";
import { Navigate, Route } from "react-router-dom";

import { AdminLayout } from "@/components/admin/AdminLayout";
import { AdminAdvertisementsPage } from "@/pages/admin/AdminAdvertisementsPage";
import { AdminAuditLogsPage } from "@/pages/admin/AdminAuditLogsPage";
import { AdminCategoriesPage } from "@/pages/admin/AdminCategoriesPage";
import { AdminDashboardPage } from "@/pages/admin/AdminDashboardPage";
import { AdminFeatureFlagsPage } from "@/pages/admin/AdminFeatureFlagsPage";
import { AdminLoginPage } from "@/pages/admin/AdminLoginPage";
import { AdminOrdersPage } from "@/pages/admin/AdminOrdersPage";
import { AdminSetup2FAPage } from "@/pages/admin/AdminSetup2FAPage";
import { AdminStoreDetailPage } from "@/pages/admin/AdminStoreDetailPage";
import { AdminStoresPage } from "@/pages/admin/AdminStoresPage";
import { AdminTwoFactorPage } from "@/pages/admin/AdminTwoFactorPage";
import { AdminUsersPage } from "@/pages/admin/AdminUsersPage";

import { AdminRoute } from "./guards";



interface AdminRoutesProps {
  prefix?: string;
}

export function AdminRoutes({ prefix = "" }: AdminRoutesProps): ReactElement[] {
  return [
    <Route key="admin-login" path={`${prefix}/login`} element={<AdminLoginPage />} />,
    <Route key="admin-2fa" path={`${prefix}/2fa`} element={<AdminTwoFactorPage />} />,
    <Route key="admin-setup-2fa" path={`${prefix}/setup-2fa`} element={<AdminSetup2FAPage />} />,
    <Route
      key="admin-root"
      path={prefix || "/"}
      element={
        <AdminRoute>
          <Navigate to={prefix ? `${prefix}/dashboard` : "/dashboard"} replace />
        </AdminRoute>
      }
    />,
    <Route
      key="admin-dashboard"
      path={`${prefix}/dashboard`}
      element={
        <AdminRoute>
          <AdminLayout>
            <AdminDashboardPage />
          </AdminLayout>
        </AdminRoute>
      }
    />,
    <Route
      key="admin-orders"
      path={`${prefix}/orders`}
      element={
        <AdminRoute>
          <AdminLayout>
            <AdminOrdersPage />
          </AdminLayout>
        </AdminRoute>
      }
    />,
    <Route
      key="admin-users"
      path={`${prefix}/users`}
      element={
        <AdminRoute>
          <AdminLayout>
            <AdminUsersPage />
          </AdminLayout>
        </AdminRoute>
      }
    />,
    <Route
      key="admin-stores"
      path={`${prefix}/stores`}
      element={
        <AdminRoute>
          <AdminLayout>
            <AdminStoresPage />
          </AdminLayout>
        </AdminRoute>
      }
    />,
    <Route
      key="admin-store-detail"
      path={`${prefix}/stores/:id`}
      element={
        <AdminRoute>
          <AdminLayout>
            <AdminStoreDetailPage />
          </AdminLayout>
        </AdminRoute>
      }
    />,
    <Route
      key="admin-categories"
      path={`${prefix}/categories`}
      element={
        <AdminRoute>
          <AdminLayout>
            <AdminCategoriesPage />
          </AdminLayout>
        </AdminRoute>
      }
    />,
    <Route
      key="admin-feature-flags"
      path={`${prefix}/feature-flags`}
      element={
        <AdminRoute>
          <AdminLayout>
            <AdminFeatureFlagsPage />
          </AdminLayout>
        </AdminRoute>
      }
    />,
    <Route
      key="admin-advertisements"
      path={`${prefix}/ads`}
      element={
        <AdminRoute>
          <AdminLayout>
            <AdminAdvertisementsPage />
          </AdminLayout>
        </AdminRoute>
      }
    />,
    <Route
      key="admin-audit-logs"
      path={`${prefix}/audit-logs`}
      element={
        <AdminRoute>
          <AdminLayout>
            <AdminAuditLogsPage />
          </AdminLayout>
        </AdminRoute>
      }
    />
  ];
}
