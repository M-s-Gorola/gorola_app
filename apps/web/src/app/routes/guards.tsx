import type { ReactElement, ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";

import { getScopedPath, resolveSubdomain } from "@/lib/subdomain-resolver";
import { useAuthStore } from "@/store/auth.store";

type GuardProps = {
  children: ReactNode;
};

function hasSession(accessToken: string | null): boolean {
  return accessToken !== null && accessToken.length > 0;
}

export function ProtectedRoute({ children }: GuardProps): ReactElement {
  const accessToken = useAuthStore((s) => s.accessToken);
  const isBootstrapPending = useAuthStore((s) => s.isBootstrapPending);
  const location = useLocation();
  if (isBootstrapPending) {
    return <p className="font-dm-sans text-sm text-gorola-slate">Restoring your session...</p>;
  }
  if (!hasSession(accessToken)) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }
  return <>{children}</>;
}

export function StoreRoute({ children }: GuardProps): ReactElement {
  const accessToken = useAuthStore((s) => s.accessToken);
  const isBootstrapPending = useAuthStore((s) => s.isBootstrapPending);
  const role = useAuthStore((s) => s.role);
  const twoFactorVerified = useAuthStore((s) => s.twoFactorVerified);
  const location = useLocation();

  const { isSubdomainMode } = resolveSubdomain(window.location.hostname);

  if (isBootstrapPending) {
    return <p className="font-dm-sans text-sm text-gorola-slate">Restoring your session...</p>;
  }
  if (!hasSession(accessToken) || role !== "STORE_OWNER") {
    return <Navigate to={getScopedPath("/store/login", "store", isSubdomainMode)} replace state={{ from: location }} />;
  }
  if (twoFactorVerified !== true) {
    return <Navigate to={getScopedPath("/store/2fa", "store", isSubdomainMode)} replace state={{ from: location }} />;
  }
  return <>{children}</>;
}

export function AdminRoute({ children }: GuardProps): ReactElement {
  const accessToken = useAuthStore((s) => s.accessToken);
  const isBootstrapPending = useAuthStore((s) => s.isBootstrapPending);
  const role = useAuthStore((s) => s.role);
  const twoFactorVerified = useAuthStore((s) => s.twoFactorVerified);
  const twoFactorEnabled = useAuthStore((s) => s.twoFactorEnabled);
  const location = useLocation();

  const { isSubdomainMode } = resolveSubdomain(window.location.hostname);

  if (isBootstrapPending) {
    return <p className="font-dm-sans text-sm text-gorola-slate">Restoring your session...</p>;
  }
  if (!hasSession(accessToken) || role !== "ADMIN") {
    return <Navigate to={getScopedPath("/admin/login", "admin", isSubdomainMode)} replace state={{ from: location }} />;
  }
  if (twoFactorVerified !== true) {
    return <Navigate to={getScopedPath("/admin/2fa", "admin", isSubdomainMode)} replace state={{ from: location }} />;
  }
  if (twoFactorEnabled === false) {
    return <Navigate to={getScopedPath("/admin/setup-2fa", "admin", isSubdomainMode)} replace state={{ from: location }} />;
  }
  return <>{children}</>;
}

export function RiderRoute({ children }: GuardProps): ReactElement {
  const accessToken = useAuthStore((s) => s.accessToken);
  const isBootstrapPending = useAuthStore((s) => s.isBootstrapPending);
  const role = useAuthStore((s) => s.role);
  const location = useLocation();

  const { isSubdomainMode } = resolveSubdomain(window.location.hostname);

  if (isBootstrapPending) {
    return <p className="font-dm-sans text-sm text-gorola-slate">Restoring your session...</p>;
  }
  if (!hasSession(accessToken) || role !== "RIDER") {
    return <Navigate to={getScopedPath("/rider/login", "rider", isSubdomainMode)} replace state={{ from: location }} />;
  }
  return <>{children}</>;
}
