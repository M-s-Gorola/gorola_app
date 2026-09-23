import { BarChart3, ShieldCheck } from "lucide-react";
import type { ReactElement } from "react";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import { useAuthStore } from "@/store/auth.store";

const STORAGE_KEY = "gorola_analytics_consent";

export function AnalyticsConsentBanner(): ReactElement | null {
  const [visible, setVisible] = useState(false);
  const [loading, setLoading] = useState(false);
  const accessToken = useAuthStore((s) => s.accessToken);
  const userId = useAuthStore((s) => s.userId);
  const role = useAuthStore((s) => s.role);

  useEffect(() => {
    try {
      if (typeof window !== "undefined" && (window as unknown as { isE2E?: boolean }).isE2E) {
        setVisible(false);
        return;
      }
      // Option A: Only display when user is authenticated as BUYER
      if (!accessToken || !userId || role !== "BUYER") {
        setVisible(false);
        return;
      }
      const stored = localStorage.getItem(STORAGE_KEY);
      if (!stored) {
        setVisible(true);
      } else {
        setVisible(false);
      }
    } catch {
      setVisible(false);
    }
  }, [accessToken, userId, role]);

  if (!visible) return null;

  const handleAccept = async (): Promise<void> => {
    setLoading(true);
    try {
      localStorage.setItem(STORAGE_KEY, "accepted");
    } catch {
      /* ignore storage failure */
    }

    try {
      const p = api?.post("/api/v1/consent", {
        purpose: "ANALYTICS",
        consentVersion: "1.0",
        noticeText: "We collect anonymous usage and performance telemetry to optimize steep road navigation and app speed in Mussoorie under India's DPDP Act 2023."
      });
      if (p && typeof p.catch === "function") {
        p.catch(() => {});
      }
    } catch {
      /* ignore background network failure */
    }

    setLoading(false);
    setVisible(false);
  };

  const handleDecline = (): void => {
    try {
      localStorage.setItem(STORAGE_KEY, "declined");
    } catch {
      /* ignore storage failure */
    }
    setVisible(false);
  };

  return (
    <div
      data-testid="analytics-consent-banner"
      className="fixed bottom-4 left-4 right-4 z-50 mx-auto max-w-2xl animate-in fade-in slide-in-from-bottom-5 duration-300 sm:bottom-6 sm:left-6 sm:right-6"
    >
      <div className="flex flex-col gap-4 rounded-2xl border border-gorola-pine/20 bg-white/95 p-5 shadow-2xl backdrop-blur-xl md:flex-row md:items-center md:justify-between">
        <div className="space-y-1.5 text-left flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gorola-pine/10 text-gorola-pine">
              <BarChart3 className="h-4 w-4" />
            </span>
            <h3 className="font-heading text-sm font-bold text-gorola-charcoal">
              Help Us Improve Hill Deliveries
            </h3>
            <span className="inline-flex shrink-0 items-center rounded-full bg-gorola-sand/60 px-2.5 py-0.5 text-[10px] font-semibold text-gorola-pine whitespace-nowrap">
              DPDP Act 2023
            </span>
          </div>
          <p className="text-xs text-gorola-slate leading-relaxed">
            We collect anonymous performance telemetry to optimize steep hill routing and app responsiveness across Mussoorie. No personal identity is tracked.
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-2.5 pt-1 md:pt-0">
          <Button
            variant="outline"
            size="sm"
            onClick={handleDecline}
            className="rounded-full text-xs text-gorola-slate border-gorola-pine/20 hover:bg-gorola-pine/5 whitespace-nowrap"
          >
            Decline / Essential Only
          </Button>
          <Button
            size="sm"
            onClick={() => void handleAccept()}
            disabled={loading}
            className="rounded-full text-xs bg-gorola-pine text-white hover:bg-gorola-pine/90 shadow-sm whitespace-nowrap"
          >
            <ShieldCheck className="mr-1.5 h-3.5 w-3.5" />
            Accept Analytics
          </Button>
        </div>
      </div>
    </div>
  );
}

