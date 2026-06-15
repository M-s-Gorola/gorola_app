import type { ReactElement } from "react";
import { Navigate, Route } from "react-router-dom";

import { RiderLayout } from "@/components/rider/RiderLayout";
import { RiderAccountPage } from "@/pages/rider/RiderAccountPage";
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
          <RiderLayout>
            <RiderOrdersPage />
          </RiderLayout>
        </RiderRoute>
      }
    />,
    <Route
      key="rider-account"
      path={`${prefix}/account`}
      element={
        <RiderRoute>
          <RiderLayout>
            <RiderAccountPage />
          </RiderLayout>
        </RiderRoute>
      }
    />
  ];
}
