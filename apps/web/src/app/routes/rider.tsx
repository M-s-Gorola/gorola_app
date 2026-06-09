import type { ReactElement } from "react";
import { Navigate, Route } from "react-router-dom";

import { RiderLoginPage } from "@/pages/rider/RiderLoginPage";

import { RiderRoute } from "./guards";

interface RiderRoutesProps {
  prefix?: string;
}

export function RiderRoutes({ prefix = "" }: RiderRoutesProps): ReactElement[] {
  return [
    <Route key="rider-login" path={`${prefix}/login`} element={<RiderLoginPage />} />,
    <Route
      key="rider-root"
      path={prefix || "/"}
      element={
        <RiderRoute>
          <Navigate to={prefix ? `${prefix}/dashboard` : "/dashboard"} replace />
        </RiderRoute>
      }
    />,
    <Route
      key="rider-dashboard"
      path={`${prefix}/dashboard`}
      element={
        <RiderRoute>
          <div className="flex h-screen items-center justify-center bg-gorola-fog">
            <h1 className="font-heading text-2xl text-gorola-pine font-semibold">Rider Dashboard (Phase 5.2/5.3/5.4)</h1>
          </div>
        </RiderRoute>
      }
    />
  ];
}
