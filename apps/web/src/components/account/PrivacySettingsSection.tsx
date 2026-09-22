import { isAxiosError } from "axios";
import { ShieldCheck, ShieldOff } from "lucide-react";
import type { ReactElement } from "react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";

type ConsentItem = {
  id: string;
  purpose: "OTP_AUTH" | "ORDER_PROCESSING" | "MARKETING_EMAIL" | "ANALYTICS";
  consentVersion: string;
  noticeText: string;
  isWithdrawn: boolean;
  withdrawnAt: string | null;
  createdAt: string;
};

const PURPOSE_LABELS: Record<ConsentItem["purpose"], { title: string; description: string; essential: boolean }> = {
  OTP_AUTH: {
    title: "OTP_AUTH (Authentication & Security)",
    description: "Required to send one-time passwords and secure your account sessions.",
    essential: true
  },
  ORDER_PROCESSING: {
    title: "ORDER_PROCESSING (Order Fulfillment)",
    description: "Required to share delivery information with store partners and delivery riders.",
    essential: true
  },
  MARKETING_EMAIL: {
    title: "MARKETING_EMAIL (Promotions & Offers)",
    description: "Receive updates on hill weather flash sales, seasonal discounts, and special offers.",
    essential: false
  },
  ANALYTICS: {
    title: "ANALYTICS (Usage & Performance)",
    description: "Help us optimize route planning and app speed across Mussoorie.",
    essential: false
  }
};

export function PrivacySettingsSection(): ReactElement {
  const [consents, setConsents] = useState<ConsentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  useEffect(() => {
    async function loadConsents(): Promise<void> {
      if (!api) return;
      try {
        const res = await api.get<{ success: boolean; data: { consents: ConsentItem[] } }>("/api/v1/consent");
        if (res.data?.success && Array.isArray(res.data.data?.consents)) {
          setConsents(res.data.data.consents);
        }
      } catch (err) {
        console.error("Failed to load consents:", err);
      } finally {
        setLoading(false);
      }
    }
    void loadConsents();
  }, []);

  const handleWithdraw = async (purpose: ConsentItem["purpose"]): Promise<void> => {
    if (!api) return;
    setActionLoading(purpose);
    try {
      const res = await api.delete<{ success: boolean; data: { consent: ConsentItem } }>(`/api/v1/consent/${purpose}`);
      if (res.data?.success) {
        setConsents((prev) =>
          prev.map((c) =>
            c.purpose === purpose
              ? { ...c, isWithdrawn: true, withdrawnAt: new Date().toISOString() }
              : c
          )
        );
        toast.success("Consent withdrawn successfully");
      }
    } catch (err) {
      let msg = "Failed to withdraw consent";
      if (isAxiosError(err)) {
        msg = err.response?.data?.error?.message || msg;
      }
      toast.error(msg);
    } finally {
      setActionLoading(null);
    }
  };

  const handleGrant = async (purpose: ConsentItem["purpose"]): Promise<void> => {
    if (!api) return;
    setActionLoading(purpose);
    try {
      const meta = PURPOSE_LABELS[purpose];
      const res = await api.post<{ success: boolean; data: { consent: ConsentItem } }>("/api/v1/consent", {
        purpose,
        consentVersion: "1.0",
        noticeText: meta?.description ?? purpose
      });
      if (res.data?.success) {
        const refreshRes = await api.get<{ success: boolean; data: { consents: ConsentItem[] } }>("/api/v1/consent");
        if (refreshRes.data?.success && Array.isArray(refreshRes.data.data?.consents)) {
          setConsents(refreshRes.data.data.consents);
        }
        toast.success("Consent updated successfully");
      }
    } catch (err) {
      let msg = "Failed to update consent";
      if (isAxiosError(err)) {
        msg = err.response?.data?.error?.message || msg;
      }
      toast.error(msg);
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <section className="rounded-2xl border border-gorola-pine/5 bg-white/70 p-6 shadow-sm backdrop-blur-md">
      <div className="mb-6 flex items-center gap-3">
        <div className="rounded-full bg-gorola-pine/10 p-2 text-gorola-pine">
          <ShieldCheck size={20} />
        </div>
        <div>
          <h2 className="font-heading text-lg font-semibold text-gorola-charcoal">
            Privacy &amp; Consent Preferences
          </h2>
          <p className="text-xs text-gorola-slate">
            Compliant with India&apos;s Digital Personal Data Protection (DPDP) Act 2023.
          </p>
        </div>
      </div>

      {loading ? (
        <div className="py-6 text-center text-sm text-gorola-slate">Loading consent settings...</div>
      ) : consents.length === 0 ? (
        <div className="py-6 text-center text-sm text-gorola-slate">No consent records found.</div>
      ) : (
        <div className="space-y-4">
          {consents.map((consent) => {
            const meta = PURPOSE_LABELS[consent.purpose] ?? {
              title: consent.purpose,
              description: consent.noticeText,
              essential: false
            };

            return (
              <div
                className="flex flex-col justify-between gap-3 rounded-xl border border-border/60 bg-white/50 p-4 sm:flex-row sm:items-center"
                key={consent.id}
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm text-gorola-charcoal">{meta.title}</span>
                    {meta.essential ? (
                      <span className="inline-flex items-center rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700 ring-1 ring-inset ring-emerald-600/20">
                        Essential
                      </span>
                    ) : consent.isWithdrawn ? (
                      <span className="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-medium text-gray-600">
                        Withdrawn
                      </span>
                    ) : (
                      <span className="inline-flex items-center rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-700 ring-1 ring-inset ring-amber-600/20">
                        Active
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">{meta.description}</p>
                  <p className="text-[10px] text-muted-foreground/80">
                    Granted: {new Date(consent.createdAt).toLocaleDateString()} (v{consent.consentVersion})
                    {consent.withdrawnAt ? ` • Withdrawn: ${new Date(consent.withdrawnAt).toLocaleDateString()}` : ""}
                  </p>
                </div>

                <div>
                  {!meta.essential && !consent.isWithdrawn ? (
                    <Button
                      className="text-xs"
                      data-testid={`withdraw-btn-${consent.purpose}`}
                      disabled={actionLoading === consent.purpose}
                      onClick={() => void handleWithdraw(consent.purpose)}
                      size="sm"
                      variant="outline"
                    >
                      <ShieldOff className="mr-1 h-3.5 w-3.5 text-muted-foreground" />
                      {actionLoading === consent.purpose ? "Withdrawing..." : "Withdraw"}
                    </Button>
                  ) : !meta.essential && consent.isWithdrawn ? (
                    <Button
                      className="text-xs bg-gorola-pine text-white hover:bg-gorola-pine/90"
                      data-testid={`optin-btn-${consent.purpose}`}
                      disabled={actionLoading === consent.purpose}
                      onClick={() => void handleGrant(consent.purpose)}
                      size="sm"
                    >
                      <ShieldCheck className="mr-1 h-3.5 w-3.5" />
                      {actionLoading === consent.purpose ? "Enabling..." : "Opt In"}
                    </Button>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
