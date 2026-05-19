import type { ReactElement } from "react";
import { Route } from "react-router-dom";
import { Link } from "react-router-dom";

import { AdminLoginPage } from "@/pages/admin/AdminLoginPage";

import { AdminRoute } from "./guards";

function PlaceholderPage({ title, prefix }: { title: string; prefix: string }): ReactElement {
  const backTo = prefix ? `${prefix}` : "/";

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

interface AdminRoutesProps {
  prefix?: string;
}

export function AdminRoutes({ prefix = "" }: AdminRoutesProps): ReactElement[] {
  return [
    <Route
      key="admin-login"
      path={prefix ? `${prefix}/login` : "/"}
      element={<AdminLoginPage />}
    />,
    <Route
      key="admin-root"
      path={prefix || "/dashboard"}
      element={
        <AdminRoute>
          <PlaceholderPage title="Admin Dashboard" prefix={prefix} />
        </AdminRoute>
      }
    />
  ];
}
