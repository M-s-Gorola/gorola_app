import { isAxiosError } from "axios";
import { ChevronDown, ChevronUp, ShieldCheck, ShieldOff } from "lucide-react";
import type { MouseEvent, ReactElement, ReactNode } from "react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { ConsentNoticeModal } from "@/components/consent/ConsentNoticeModal";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { api } from "@/lib/api";
import { queryClient } from "@/lib/query-client";

// Raw shape returned by GET /api/v1/consent
type ConsentLogRow = {
  id: string;
  purpose: "OTP_AUTH" | "ORDER_PROCESSING" | "MARKETING_COMMS" | "ANALYTICS" | "AGE_DECLARATION";
  consentVersion: string;
  noticeText: string;
  isWithdrawn: boolean;
  withdrawnAt: string | null;
  createdAt: string;
};

type ConsentPurpose = "OTP_AUTH" | "AGE_DECLARATION" | "ORDER_PROCESSING" | "MARKETING_COMMS" | "ANALYTICS";

// Canonical 5-card display shape — one entry per purpose
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
  AGE_DECLARATION: {
    title: "Age Verification & Eligibility",
    description: (
      <span>
        GoRola is available only to people aged 18 and over. You confirm that the date of birth you enter is correct. We use it once to check eligibility and do not store it; we keep only the date on which you confirmed.
      </span>
    ),
    plainText:
      "GoRola is available only to people aged 18 and over. You confirm that the date of birth you enter is correct. We use it once to check eligibility and do not store it; we keep only the date on which you confirmed.",
    noticeLabel: "Age Declaration Notice",
    transparencyPrompt: "For full details on non-storage of raw DOB, 90-day lockout hashing, and data rights, read the",
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
  "AGE_DECLARATION",
  "ORDER_PROCESSING",
  "MARKETING_COMMS",
  "ANALYTICS"
];

/**
 * Collapses raw ConsentLog rows into exactly 5 canonical purpose cards
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
    const isEssentialDefault = purpose === "OTP_AUTH" || purpose === "AGE_DECLARATION";

    return {
      purpose,
      latestId: "",
      consentVersion: purpose === "AGE_DECLARATION" ? "1.1" : "1.0",
      isActive: isEssentialDefault || isAnalyticsAcceptedInStorage,
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
  const [expandedPurposes, setExpandedPurposes] = useState<Record<string, boolean>>({
    OTP_AUTH: true
  });
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

  const togglePurpose = (purpose: ConsentPurpose): void => {
    setExpandedPurposes((prev) => ({
      ...prev,
      [purpose]: !prev[purpose]
    }));
  };

  const handleWithdraw = async (purpose: ConsentPurpose, e?: MouseEvent): Promise<void> => {
    e?.stopPropagation();
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

  const handleGrant = async (purpose: ConsentPurpose, e?: MouseEvent): Promise<void> => {
    e?.stopPropagation();
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
    <Card className="border-gorola-pine/15 bg-white shadow-sm overflow-hidden">
      <CardContent className="p-5 sm:p-6 space-y-4">
        <div className="flex items-start gap-3.5">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gorola-pine/10 text-gorola-pine">
            <ShieldCheck className="h-5 w-5" />
          </span>
          <div className="space-y-0.5 min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="font-heading text-base font-bold text-gorola-charcoal">
                Privacy &amp; Consent Preferences
              </h2>
              <span className="inline-flex items-center rounded-full bg-gorola-sand/60 px-2 py-0.5 text-[10px] font-semibold text-gorola-pine">
                DPDP Act Sec 6(1)
              </span>
            </div>
            <p className="text-xs text-gorola-slate">
              Manage statutory consent preferences and access rights under India&apos;s DPDP Act 2023.
            </p>
          </div>
        </div>

        <div className="space-y-2.5 pt-1">
          {loading ? (
            <div className="py-6 text-center text-sm text-gorola-slate">Loading consent settings...</div>
          ) : cards.length === 0 ? (
            <div className="py-6 text-center text-sm text-gorola-slate">No consent records found.</div>
          ) : (
            cards.map((card) => {
              const meta = PURPOSE_META[card.purpose];
              const isExpanded = Boolean(expandedPurposes[card.purpose]);

              return (
                <div
                  className="rounded-xl border border-gorola-charcoal/10 bg-gorola-charcoal/[0.015] overflow-hidden transition-all shadow-xs"
                  key={card.purpose}
                  data-testid={`consent-card-${card.purpose}`}
                >
                  <div
                    onClick={() => togglePurpose(card.purpose)}
                    className="flex items-center justify-between gap-3 p-3.5 sm:p-4 cursor-pointer hover:bg-gorola-charcoal/[0.03] transition-colors select-none"
                    role="button"
                    aria-expanded={isExpanded}
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        togglePurpose(card.purpose);
                      }
                    }}
                  >
                    <div className="flex items-center gap-2.5 flex-wrap min-w-0 flex-1">
                      <span className="font-bold text-sm text-gorola-charcoal">
                        {meta.title}
                      </span>
                      {meta.essential ? (
                        <span className="inline-flex items-center rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700 ring-1 ring-inset ring-emerald-600/20">
                          Essential
                        </span>
                      ) : card.isActive ? (
                        <span className="inline-flex items-center rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-700 ring-1 ring-inset ring-amber-600/20">
                          Active
                        </span>
                      ) : (
                        <span className="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-bold text-gray-600">
                          Withdrawn
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {!meta.essential && (
                        <div onClick={(e) => e.stopPropagation()}>
                          {card.isActive ? (
                            <Button
                              className="h-7 sm:h-8 text-xs font-semibold px-2.5 sm:px-3"
                              data-testid={`withdraw-btn-${card.purpose}`}
                              disabled={actionLoading === card.purpose}
                              onClick={(e) => void handleWithdraw(card.purpose, e)}
                              size="sm"
                              variant="outline"
                            >
                              <ShieldOff className="mr-1 h-3 w-3 sm:h-3.5 sm:w-3.5 text-muted-foreground" />
                              {actionLoading === card.purpose ? "Withdrawing..." : "Withdraw"}
                            </Button>
                          ) : (
                            <Button
                              className="h-7 sm:h-8 text-xs font-semibold px-2.5 sm:px-3 bg-gorola-pine text-white hover:bg-gorola-pine/90"
                              data-testid={`optin-btn-${card.purpose}`}
                              disabled={actionLoading === card.purpose}
                              onClick={(e) => void handleGrant(card.purpose, e)}
                              size="sm"
                            >
                              <ShieldCheck className="mr-1 h-3 w-3 sm:h-3.5 sm:w-3.5" />
                              {actionLoading === card.purpose ? "Enabling..." : "Opt In"}
                            </Button>
                          )}
                        </div>
                      )}

                      <div className="flex h-7 w-7 sm:h-8 sm:w-8 items-center justify-center rounded-lg bg-gorola-charcoal/5 text-gorola-charcoal">
                        {isExpanded ? (
                          <ChevronUp className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                        ) : (
                          <ChevronDown className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                        )}
                      </div>
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="border-t border-gorola-charcoal/5 bg-white p-3.5 sm:p-4 space-y-2.5 text-xs">
                      <p className="text-muted-foreground leading-relaxed">
                        {meta.description}
                      </p>
                      <div className="pt-0.5 text-muted-foreground">
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
                      <div className="flex items-center gap-2.5 flex-wrap pt-0.5">
                        <span className="text-[11px] text-muted-foreground">
                          {card.isActive
                            ? card.grantedAt && !isNaN(new Date(card.grantedAt).getTime())
                              ? card.purpose === "AGE_DECLARATION"
                                ? `Confirmed on ${new Date(card.grantedAt).toLocaleDateString()} (v${card.consentVersion})`
                                : `Active since ${new Date(card.grantedAt).toLocaleDateString()} (v${card.consentVersion})`
                              : card.purpose === "OTP_AUTH"
                                ? "Active since account creation"
                                : card.purpose === "AGE_DECLARATION"
                                  ? `Confirmed (v${card.consentVersion})`
                                  : `Active (v${card.consentVersion})`
                            : getInactiveStatusText(card.purpose)}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </CardContent>
    </Card>
  );
}

