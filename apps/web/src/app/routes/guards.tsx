import type { ReactElement, ReactNode } from "react";
import { Navigate } from "react-router-dom";

import { useAuthStore } from "@/store/auth.store";

type GuardProps = {
  children: ReactNode;
};

function hasSession(accessToken: string | null): boolean {
  return accessToken !== null && accessToken.length > 0;
}

export function ProtectedRoute({ children }: GuardProps): ReactElement {
  const accessToken = useAuthStore((s) => s.accessToken);
  if (!hasSession(accessToken)) {
    return <Navigate to="/login" replace />;
  }
  return <>{children}</>;
}

export function StoreRoute({ children }: GuardProps): ReactElement {
  const accessToken = useAuthStore((s) => s.accessToken);
  const role = useAuthStore((s) => s.role);
  if (!hasSession(accessToken)) {
    return <Navigate to="/login" replace />;
  }
  if (role !== "STORE_OWNER") {
    return <Navigate to="/" replace />;
  }
  return <>{children}</>;
}

export function AdminRoute({ children }: GuardProps): ReactElement {
  const accessToken = useAuthStore((s) => s.accessToken);
  const role = useAuthStore((s) => s.role);
  if (!hasSession(accessToken)) {
    return <Navigate to="/login" replace />;
  }
  if (role !== "ADMIN") {
    return <Navigate to="/" replace />;
  }
  return <>{children}</>;
}
