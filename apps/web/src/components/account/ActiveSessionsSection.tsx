import { Laptop, Loader2, LogOut, ShieldCheck, Smartphone } from "lucide-react";
import { type ReactElement, useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { api } from "@/lib/api";

type SessionInfo = {
  sessionId: string;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: string;
  lastActiveAt: string;
  isCurrent?: boolean;
};

type SessionsApiResponse = {
  success: boolean;
  data: {
    sessions: SessionInfo[];
  };
};

function getDeviceIcon(userAgent: string | null): ReactElement {
  const ua = (userAgent ?? "").toLowerCase();
  if (ua.includes("mobi") || ua.includes("iphone") || ua.includes("android")) {
    return <Smartphone className="h-4 w-4 text-gorola-slate" />;
  }
  return <Laptop className="h-4 w-4 text-gorola-slate" />;
}

export function ActiveSessionsSection(): ReactElement {
  const [sessions, setSessions] = useState<SessionInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [revoking, setRevoking] = useState(false);

  async function fetchSessions(): Promise<void> {
    if (!api) return;
    try {
      setLoading(true);
      const res = await api.get<SessionsApiResponse>("/api/v1/auth/sessions");
      if (res.data?.success && res.data.data?.sessions) {
        setSessions(res.data.data.sessions);
      }
    } catch {
      // Ignored / fallback empty
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void fetchSessions();
  }, []);

  async function handleSignOutAll(): Promise<void> {
    if (!api) return;
    try {
      setRevoking(true);
      const res = await api.delete<{ success: boolean; data: { terminatedCount: number } }>("/api/v1/auth/sessions");
      if (res.data?.success) {
        toast.success("Successfully terminated all active sessions");
        setSessions([]);
      }
    } catch {
      toast.error("Failed to revoke sessions");
    } finally {
      setRevoking(false);
    }
  }

  return (
    <Card
      data-testid="active-sessions-card"
      className="border-gorola-pine/15 bg-white shadow-sm overflow-hidden"
    >
      <CardContent className="p-5 sm:p-6 space-y-4">
        <div className="flex items-start gap-3.5">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gorola-pine/10 text-gorola-pine">
            <ShieldCheck className="h-5 w-5" />
          </span>
          <div className="space-y-1 flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-heading text-base font-semibold text-gorola-charcoal">
                Active Login Sessions
              </h3>
              <span className="inline-flex items-center rounded-full bg-gorola-sand/60 px-2 py-0.5 text-[10px] font-semibold text-gorola-pine">
                DPDP Act Sec 8(5)
              </span>
            </div>
            <p className="text-xs text-gorola-slate leading-relaxed">
              View and manage all active devices and locations authorized to access your GoRola account.
            </p>
          </div>
        </div>

        <div className="space-y-2.5">
          {loading ? (
            <div className="h-16 animate-pulse rounded-xl bg-gorola-charcoal/5" />
          ) : sessions.length === 0 ? (
            <p className="py-2 text-xs text-gorola-slate">No active sessions found.</p>
          ) : (
            sessions.map((session) => (
              <div
                key={session.sessionId}
                data-testid={`session-row-${session.sessionId}`}
                className="flex items-center justify-between rounded-xl border border-gorola-charcoal/5 bg-gorola-charcoal/[0.02] p-3 sm:p-3.5"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gorola-charcoal/5">
                    {getDeviceIcon(session.userAgent)}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono text-xs font-bold text-gorola-charcoal truncate">
                        {session.ipAddress ?? "Unknown IP"}
                      </span>
                      {session.isCurrent && (
                        <span
                          data-testid="current-session-badge"
                          className="inline-flex items-center rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold uppercase text-emerald-800"
                        >
                          Current Session
                        </span>
                      )}
                    </div>
                    <p className="mt-0.5 text-[11px] text-gorola-slate">
                      First active:{" "}
                      {new Date(session.createdAt).toLocaleDateString("en-IN", {
                        month: "short",
                        day: "numeric",
                        year: "numeric"
                      })}
                    </p>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {sessions.length > 0 && (
          <div className="pt-2 flex justify-end">
            <Button
              type="button"
              data-testid="sign-out-all-btn"
              variant="outline"
              onClick={() => void handleSignOutAll()}
              disabled={revoking}
              className="w-full sm:w-auto rounded-xl border-rose-200 bg-rose-50/70 text-rose-700 hover:bg-rose-100 hover:text-rose-800 text-xs font-semibold px-4 py-2 flex items-center justify-center gap-2 transition-all shadow-xs active:scale-95"
            >
              {revoking ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Signing out...
                </>
              ) : (
                <>
                  <LogOut className="h-3.5 w-3.5" />
                  Sign Out All Devices
                </>
              )}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

