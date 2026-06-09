import type { ReactElement } from "react";
import { Navigate, Route } from "react-router-dom";

import { RiderLoginPage } from "@/pages/rider/RiderLoginPage";
import { RiderOrdersPage } from "@/pages/rider/RiderOrdersPage";

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
          <Navigate to={prefix ? `${prefix}/orders` : "/orders"} replace />
        </RiderRoute>
      }
    />,
    <Route
      key="rider-orders"
      path={`${prefix}/orders`}
      element={
        <RiderRoute>
          <RiderOrdersPage />
        </RiderRoute>
      }
    />
  ];
}
