import { isAxiosError } from "axios";
import { ShieldCheck, ShieldOff } from "lucide-react";
import type { ReactElement } from "react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";

// Raw shape returned by GET /api/v1/consent
type ConsentLogRow = {
  id: string;
  purpose: "OTP_AUTH" | "ORDER_PROCESSING" | "MARKETING_EMAIL" | "ANALYTICS";
  consentVersion: string;
  noticeText: string;
  isWithdrawn: boolean;
  withdrawnAt: string | null;
  createdAt: string;
};

type ConsentPurpose = ConsentLogRow["purpose"];

// Canonical 4-card display shape — one entry per purpose
type PurposeCard = {
  purpose: ConsentPurpose;
  latestId: string;
  consentVersion: string;
  isActive: boolean;
  grantedAt: string;
};

const PURPOSE_META: Record<ConsentPurpose, { title: string; description: string; essential: boolean }> = {
  OTP_AUTH: {
    title: "Authentication & Account Security",
    description: "Required to send one-time passwords and secure your account sessions for verification and account safety under India's DPDP Act 2023.",
    essential: true
  },
  ORDER_PROCESSING: {
    title: "Order Fulfillment & Location Services",
    description: "Required to share your address and GPS coordinates with Ola Maps, store partners, and delivery riders for order fulfillment. If you choose online payment, your transaction details are processed securely via Razorpay.",
    essential: true
  },
  MARKETING_EMAIL: {
    title: "Promotions & Seasonal Offers",
    description: "Receive updates on hill weather flash sales, seasonal discounts, and exclusive coupons from Mussoorie stores.",
    essential: false
  },
  ANALYTICS: {
    title: "Usage & Performance Analytics",
    description: "Help us optimise route planning and app speed across Mussoorie. Zero PII is tracked.",
    essential: false
  }
};

const CANONICAL_ORDER: ConsentPurpose[] = [
  "OTP_AUTH",
  "ORDER_PROCESSING",
  "MARKETING_EMAIL",
  "ANALYTICS"
];

/**
 * Collapses raw ConsentLog rows (which may include many historical rows per
 * purpose) into exactly 4 canonical purpose cards — one per purpose — each
 * reflecting the *latest* grant/withdrawal state.
 *
 * DPDP compliance note: all historical rows are preserved in the DB and are
 * exported via "Download My Data". This UI shows current status for all 4
 * canonical purposes even if a DB row hasn't been created yet.
 */
function buildPurposeCards(rows: ConsentLogRow[]): PurposeCard[] {
  const byPurpose = new Map<ConsentPurpose, ConsentLogRow[]>();

  for (const row of rows) {
    const bucket = byPurpose.get(row.purpose) ?? [];
    bucket.push(row);
    byPurpose.set(row.purpose, bucket);
  }

  let analyticsStoredConsent: string | null = null;
  try {
    analyticsStoredConsent = typeof window !== "undefined" ? localStorage.getItem("gorola_analytics_consent") : null;
  } catch {
    /* ignore storage failure */
  }

  return CANONICAL_ORDER.map((purpose) => {
    const purposeRows = byPurpose.get(purpose);
    if (purposeRows && purposeRows.length > 0) {
      purposeRows.sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );

      const latestActive = purposeRows.find((r) => !r.isWithdrawn);
      const latestRow = purposeRows[0]!;

      return {
        purpose,
        latestId: latestActive?.id ?? latestRow.id,
        consentVersion: latestActive?.consentVersion ?? latestRow.consentVersion,
        isActive: latestActive !== undefined,
        grantedAt: latestActive?.createdAt ?? latestRow.createdAt
      };
    }

    const isAnalyticsAcceptedInStorage = purpose === "ANALYTICS" && analyticsStoredConsent === "accepted";

    return {
      purpose,
      latestId: "",
      consentVersion: "1.0",
      isActive: isAnalyticsAcceptedInStorage,
      grantedAt: ""
    };
  });
}

export function PrivacySettingsSection(): ReactElement {
  const [cards, setCards] = useState<PurposeCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<ConsentPurpose | null>(null);

  async function loadAndBuildCards(): Promise<void> {
    if (!api) return;
    try {
      const res = await api.get<{ success: boolean; data: { consents: ConsentLogRow[] } }>("/api/v1/consent");
      if (res.data?.success && Array.isArray(res.data.data?.consents)) {
        setCards(buildPurposeCards(res.data.data.consents));
      } else {
        setCards(buildPurposeCards([]));
      }
    } catch (err) {
      console.error("Failed to load consents:", err);
      setCards(buildPurposeCards([]));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadAndBuildCards();
  }, []);

  const handleWithdraw = async (purpose: ConsentPurpose): Promise<void> => {
    if (!api) return;
    setActionLoading(purpose);
    try {
      const res = await api.delete<{ success: boolean }>(`/api/v1/consent/${purpose}`);
      if (res.data?.success) {
        if (purpose === "ANALYTICS") {
          try {
            localStorage.setItem("gorola_analytics_consent", "declined");
          } catch {
            /* ignore storage failure */
          }
        }
        setCards((prev) =>
          prev.map((c) => (c.purpose === purpose ? { ...c, isActive: false } : c))
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

  const handleGrant = async (purpose: ConsentPurpose): Promise<void> => {
    if (!api) return;
    setActionLoading(purpose);
    try {
      const meta = PURPOSE_META[purpose];
      await api.post<{ success: boolean }>("/api/v1/consent", {
        purpose,
        consentVersion: "1.0",
        noticeText: meta.description
      });
      if (purpose === "ANALYTICS") {
        try {
          localStorage.setItem("gorola_analytics_consent", "accepted");
        } catch {
          /* ignore storage failure */
        }
      }
      await loadAndBuildCards();
      toast.success("Consent updated successfully");
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
      ) : cards.length === 0 ? (
        <div className="py-6 text-center text-sm text-gorola-slate">No consent records found.</div>
      ) : (
        <div className="space-y-4">
          {cards.map((card) => {
            const meta = PURPOSE_META[card.purpose];
            return (
              <div
                className="flex flex-col justify-between gap-3 rounded-xl border border-border/60 bg-white/50 p-4 sm:flex-row sm:items-center"
                key={card.purpose}
                data-testid={`consent-card-${card.purpose}`}
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-sm text-gorola-charcoal">{meta.title}</span>
                    {meta.essential ? (
                      <span className="inline-flex items-center rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700 ring-1 ring-inset ring-emerald-600/20">
                        Essential
                      </span>
                    ) : card.isActive ? (
                      <span className="inline-flex items-center rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-700 ring-1 ring-inset ring-amber-600/20">
                        Active
                      </span>
                    ) : (
                      <span className="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-medium text-gray-600">
                        Withdrawn
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">{meta.description}</p>
                  <p className="text-[10px] text-muted-foreground/80">
                    {card.isActive
                      ? card.grantedAt && !isNaN(new Date(card.grantedAt).getTime())
                        ? `Active since ${new Date(card.grantedAt).toLocaleDateString()} (v${card.consentVersion})`
                        : `Active (v${card.consentVersion})`
                      : "Withdrawn / Inactive — you can enable below"}
                  </p>
                </div>

                <div>
                  {!meta.essential && card.isActive ? (
                    <Button
                      className="text-xs"
                      data-testid={`withdraw-btn-${card.purpose}`}
                      disabled={actionLoading === card.purpose}
                      onClick={() => void handleWithdraw(card.purpose)}
                      size="sm"
                      variant="outline"
                    >
                      <ShieldOff className="mr-1 h-3.5 w-3.5 text-muted-foreground" />
                      {actionLoading === card.purpose ? "Withdrawing..." : "Withdraw"}
                    </Button>
                  ) : !meta.essential && !card.isActive ? (
                    <Button
                      className="text-xs bg-gorola-pine text-white hover:bg-gorola-pine/90"
                      data-testid={`optin-btn-${card.purpose}`}
                      disabled={actionLoading === card.purpose}
                      onClick={() => void handleGrant(card.purpose)}
                      size="sm"
                    >
                      <ShieldCheck className="mr-1 h-3.5 w-3.5" />
                      {actionLoading === card.purpose ? "Enabling..." : "Opt In"}
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
