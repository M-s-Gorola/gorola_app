import { isAxiosError } from "axios";
import { ShieldCheck, ShieldOff } from "lucide-react";
import type { ReactElement, ReactNode } from "react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { ConsentNoticeModal } from "@/components/consent/ConsentNoticeModal";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import { queryClient } from "@/lib/query-client";

// Raw shape returned by GET /api/v1/consent
type ConsentLogRow = {
  id: string;
  purpose: "OTP_AUTH" | "ORDER_PROCESSING" | "MARKETING_COMMS" | "ANALYTICS";
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

const PURPOSE_META: Record<
  ConsentPurpose,
  {
    title: string;
    description: ReactNode;
    plainText: string;
    noticeLabel: string;
    transparencyPrompt: string;
    essential: boolean;
  }
> = {
  OTP_AUTH: {
    title: "Authentication & Account Security",
    description: (
      <span>
        We collect your phone number and share it with our secure SMS gateway (<strong className="font-semibold text-gorola-charcoal">Exotel</strong>) to send one-time passwords (OTP) and securely authenticate your account sessions under India&apos;s DPDP Act 2023. We do not sell your personal data.
      </span>
    ),
    plainText:
      "We collect your phone number and share it with our secure SMS gateway (Exotel) to send one-time passwords (OTP) and securely authenticate your account sessions under India's DPDP Act 2023. We do not sell your personal data.",
    noticeLabel: "Authentication Notice",
    transparencyPrompt: "For full details on retention period, data rights, and erasure policies, read the",
    essential: true
  },
  ORDER_PROCESSING: {
    title: "Order Fulfillment & Location Services",
    description: (
      <span>
        We collect your delivery address, GPS coordinates, Display Name (if set), and payment details to route orders and fulfill deliveries. Data is shared with <strong className="font-semibold text-gorola-charcoal">Ola Maps</strong> for navigation, <strong className="font-semibold text-gorola-charcoal">Razorpay</strong> for online payments, and assigned store partners &amp; delivery riders for order fulfillment. Governed by India&apos;s DPDP Act 2023.
      </span>
    ),
    plainText:
      "We collect your delivery address, GPS coordinates, Display Name (if set), and payment details to route orders and fulfill deliveries. Data is shared with Ola Maps for navigation, Razorpay for online payments, and assigned store partners & delivery riders for order fulfillment. Governed by India's DPDP Act 2023.",
    noticeLabel: "Order Fulfillment Notice",
    transparencyPrompt: "For full details on statutory 7-year GST retention, live GPS handling, and data rights, read the",
    essential: true
  },
  MARKETING_COMMS: {
    title: "Promotions & Seasonal Offers",
    description: (
      <span>
        We collect your phone number, Display Name (if set), and purchase categories to send updates on Mussoorie store flash sales, seasonal discounts, and coupons via SMS (<strong className="font-semibold text-gorola-charcoal">Exotel</strong>) and app notifications. 100% voluntary.
      </span>
    ),
    plainText:
      "We collect your phone number, Display Name (if set), and purchase categories to send updates on Mussoorie store flash sales, seasonal discounts, and coupons via SMS (Exotel) and app notifications. 100% voluntary.",
    noticeLabel: "Promotions Notice",
    transparencyPrompt: "For full details on 48-hour opt-out scrubbing, data retention, and withdrawal rights, read the",
    essential: false
  },
  ANALYTICS: {
    title: "Usage & Performance Analytics",
    description: (
      <span>
        We collect anonymous device telemetry and network latency data to identify bugs, optimize steep hill route planning, and improve app performance in weak signal areas across Mussoorie. Zero personal data is tracked.
      </span>
    ),
    plainText:
      "We collect anonymous device telemetry and network latency data to identify bugs, optimize steep hill route planning, and improve app performance in weak signal areas across Mussoorie. Zero personal data is tracked.",
    noticeLabel: "Analytics Notice",
    transparencyPrompt: "For full details on 180-day auto-purge schedules, telemetry anonymization, and opt-out rights, read the",
    essential: false
  }
};

const CANONICAL_ORDER: ConsentPurpose[] = [
  "OTP_AUTH",
  "ORDER_PROCESSING",
  "MARKETING_COMMS",
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
    const isOtpAuthDefault = purpose === "OTP_AUTH";

    return {
      purpose,
      latestId: "",
      consentVersion: "1.0",
      isActive: isOtpAuthDefault || isAnalyticsAcceptedInStorage,
      grantedAt: ""
    };
  });
}

function getInactiveStatusText(purpose: ConsentPurpose): string {
  if (purpose === "ORDER_PROCESSING") {
    return "🟡 Pending — Activated when you save an address or place your first order";
  }
  return "Withdrawn / Inactive — you can enable below";
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
        void queryClient.invalidateQueries({ queryKey: ["consents"] });
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
        noticeText: meta.plainText
      });
      if (purpose === "ANALYTICS") {
        try {
          localStorage.setItem("gorola_analytics_consent", "accepted");
        } catch {
          /* ignore storage failure */
        }
      }
      await loadAndBuildCards();
      void queryClient.invalidateQueries({ queryKey: ["consents"] });
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
                className="rounded-xl border border-border/80 bg-white dark:bg-card p-4 shadow-xs space-y-2.5"
                key={card.purpose}
                data-testid={`consent-card-${card.purpose}`}
              >
                <div className="flex items-center justify-between gap-3 flex-wrap">
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

                  {!meta.essential ? (
                    <div>
                      {card.isActive ? (
                        <Button
                          className="h-8 text-xs"
                          data-testid={`withdraw-btn-${card.purpose}`}
                          disabled={actionLoading === card.purpose}
                          onClick={() => void handleWithdraw(card.purpose)}
                          size="sm"
                          variant="outline"
                        >
                          <ShieldOff className="mr-1 h-3.5 w-3.5 text-muted-foreground" />
                          {actionLoading === card.purpose ? "Withdrawing..." : "Withdraw"}
                        </Button>
                      ) : (
                        <Button
                          className="h-8 text-xs bg-gorola-pine text-white hover:bg-gorola-pine/90"
                          data-testid={`optin-btn-${card.purpose}`}
                          disabled={actionLoading === card.purpose}
                          onClick={() => void handleGrant(card.purpose)}
                          size="sm"
                        >
                          <ShieldCheck className="mr-1 h-3.5 w-3.5" />
                          {actionLoading === card.purpose ? "Enabling..." : "Opt In"}
                        </Button>
                      )}
                    </div>
                  ) : null}
                </div>

                <p className="text-xs text-muted-foreground leading-relaxed">{meta.description}</p>
                <div className="pt-0.5 text-xs text-muted-foreground">
                  <span>{meta.transparencyPrompt} </span>
                  <ConsentNoticeModal
                    purpose={card.purpose}
                    triggerLabel={meta.noticeLabel}
                    triggerClassName="inline-flex items-center align-baseline gap-1 text-xs font-semibold text-gorola-pine underline hover:text-emerald-700 cursor-pointer p-0 bg-transparent border-0"
                  />
                  <span> (or view our platform-wide </span>
                  <a
                    href="/privacy"
                    className="font-semibold text-gorola-pine underline hover:text-emerald-700 align-baseline"
                  >
                    Privacy Policy
                  </a>
                  <span>).</span>
                </div>
                <div className="flex items-center gap-2.5 flex-wrap pt-0.5 text-xs">
                  <span className="text-[11px] text-muted-foreground">
                    {card.isActive
                      ? card.grantedAt && !isNaN(new Date(card.grantedAt).getTime())
                        ? `Active since ${new Date(card.grantedAt).toLocaleDateString()} (v${card.consentVersion})`
                        : card.purpose === "OTP_AUTH"
                          ? "Active since account creation"
                          : `Active (v${card.consentVersion})`
                      : getInactiveStatusText(card.purpose)}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
