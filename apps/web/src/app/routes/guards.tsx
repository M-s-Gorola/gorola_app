import type { ReactElement, ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";

import { useAuthStore } from "@/store/auth.store";

type GuardProps = {
  children: ReactNode;
};

function hasSession(accessToken: string | null): boolean {
  return accessToken !== null && accessToken.length > 0;
}

export function ProtectedRoute({ children }: GuardProps): ReactElement {
  const accessToken = useAuthStore((s) => s.accessToken);
  const location = useLocation();
  if (!hasSession(accessToken)) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }
  return <>{children}</>;
}

export function StoreRoute({ children }: GuardProps): ReactElement {
  const accessToken = useAuthStore((s) => s.accessToken);
  const role = useAuthStore((s) => s.role);
  const location = useLocation();
  if (!hasSession(accessToken)) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }
  if (role !== "STORE_OWNER") {
    return <Navigate to="/" replace />;
  }
  return <>{children}</>;
}

export function AdminRoute({ children }: GuardProps): ReactElement {
  const accessToken = useAuthStore((s) => s.accessToken);
  const role = useAuthStore((s) => s.role);
  const location = useLocation();
  if (!hasSession(accessToken)) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }
  if (role !== "ADMIN") {
    return <Navigate to="/" replace />;
  }
  return <>{children}</>;
}
