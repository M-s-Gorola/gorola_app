import { useQuery } from "@tanstack/react-query";
import { LogOut, RefreshCw, Store, User } from "lucide-react";
import type { ReactElement } from "react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import { getScopedPath, resolveSubdomain } from "@/lib/subdomain-resolver";
import { useAuthStore } from "@/store/auth.store";

type RiderProfileResponse = {
  success: boolean;
  data: {
    id: string;
    name: string;
    email: string;
    phone: string;
    riderType: string;
    store: {
      id: string;
      name: string;
    };
  };
};

export function RiderAccountPage(): ReactElement {
  const navigate = useNavigate();
  const clearSession = useAuthStore((s) => s.clearSession);
  const refreshToken = useAuthStore((s) => s.refreshToken);
  const [loggingOut, setLoggingOut] = useState(false);

  const { isSubdomainMode } = resolveSubdomain(window.location.hostname);

  const { data, isLoading, error, refetch } = useQuery<RiderProfileResponse>({
    queryKey: ["riderProfile"],
    queryFn: async () => {
      if (!api) throw new Error("API not configured");
      const res = await api.get<RiderProfileResponse>("/api/v1/rider/profile");
      return res.data;
    }
  });

  async function handleLogout() {
    setLoggingOut(true);
    try {
      if (api && refreshToken) {
        await api.post("/api/v1/rider/auth/logout", { refreshToken });
      }
    } catch {
      // Ignore API errors on logout during cleanups
    } finally {
      clearSession();
      setLoggingOut(false);
      navigate(getScopedPath("/rider/login", "rider", isSubdomainMode), { replace: true });
    }
  }

  const profile = data?.data;

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3" data-testid="profile-loading">
        <RefreshCw className="h-8 w-8 animate-spin text-gorola-pine" />
        <p className="text-sm text-muted-foreground font-medium">Loading profile...</p>
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="rounded-2xl border border-destructive/20 bg-destructive/5 p-5 text-center my-10">
        <p className="text-sm font-semibold text-destructive">Failed to load profile details.</p>
        <button
          onClick={() => refetch()}
          className="mt-3 inline-flex items-center justify-center px-4 py-2 border border-destructive/20 text-xs font-semibold text-destructive rounded-full hover:bg-destructive/10 transition focus:outline-none cursor-pointer"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 font-sans">
      <div className="flex flex-col gap-1.5 border-b border-gorola-fog pb-4">
        <h1 className="font-heading text-2xl font-bold text-gorola-charcoal">Account Details</h1>
        <p className="text-muted-foreground text-xs">Manage your partner shift account</p>
      </div>

      {/* Profile Info Card */}
      <div className="flex flex-col gap-4 rounded-2xl border border-gorola-fog bg-white p-5 shadow-sm">
        <div className="flex items-center gap-3 border-b border-gorola-fog pb-3">
          <div className="h-10 w-10 rounded-full bg-gorola-pine/10 flex items-center justify-center">
            <User className="h-5 w-5 text-gorola-pine" />
          </div>
          <div className="flex flex-col">
            <span className="text-xs text-muted-foreground font-medium">Delivery Partner</span>
            <span className="text-base font-bold text-gorola-charcoal">{profile.name}</span>
          </div>
        </div>

        <div className="flex flex-col gap-3.5">
          <div className="flex items-start gap-2.5">
            <Store className="mt-0.5 h-4.5 w-4.5 text-gorola-pine" />
            <div className="flex flex-col">
              <span className="text-xs text-muted-foreground font-medium">Assigned Store</span>
              <span className="text-sm font-semibold text-gorola-charcoal">{profile.store.name}</span>
            </div>
          </div>

          <div className="flex flex-col gap-1">
            <span className="text-xs text-muted-foreground font-medium">Email Address</span>
            <span className="text-sm font-semibold text-gorola-charcoal">{profile.email}</span>
          </div>

          <div className="flex flex-col gap-1">
            <span className="text-xs text-muted-foreground font-medium">Phone Number</span>
            <span className="text-sm font-semibold text-gorola-charcoal">{profile.phone}</span>
          </div>

          <div className="flex flex-col gap-1">
            <span className="text-xs text-muted-foreground font-medium">Role Mode</span>
            <span className="text-xs font-bold inline-flex items-center w-fit px-2 py-0.5 rounded-full bg-gorola-pine/10 text-gorola-pine">
              {profile.riderType}
            </span>
          </div>
        </div>
      </div>

      {/* Logout button */}
      <div className="mt-4">
        <Button
          className="w-full h-12 rounded-xl border border-destructive/20 bg-white hover:bg-destructive/5 text-destructive font-semibold flex items-center justify-center gap-2 select-none cursor-pointer"
          disabled={loggingOut}
          onClick={handleLogout}
          variant="outline"
        >
          <LogOut className="h-4 w-4" />
          <span>{loggingOut ? "Logging out..." : "Logout"}</span>
        </Button>
      </div>
    </div>
  );
}
