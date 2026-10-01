import { FileText, ShieldCheck } from "lucide-react";
import { ReactElement } from "react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";

export type ConsentPurpose = "OTP_AUTH" | "ORDER_PROCESSING" | "MARKETING_COMMS" | "ANALYTICS";

interface NoticeContent {
  title: string;
  version: string;
  effectiveDate: string;
  purpose: string;
  dataCollected: string[];
  thirdParties: string;
  retention: string;
  rights: string;
}

export const CONSENT_NOTICES: Record<ConsentPurpose, NoticeContent> = {
  OTP_AUTH: {
    title: "Authentication & Account Security",
    version: "1.0",
    effectiveDate: "29/09/2026",
    purpose:
      "We process your personal data exclusively to verify your identity via One-Time Passwords (OTP), prevent unauthorized account access, and ensure session security.",
    dataCollected: ["Phone Number"],
    thirdParties:
      "Your phone number is transmitted securely via our encrypted internal authentication microservices and shared with our authorized SMS Gateway Partners (such as Exotel) solely for automated OTP delivery. We do not sell or monetize your data.",
    retention:
      "Retained for the lifetime of your active account. If you delete your account, this data is permanently erased within 30 days.",
    rights:
      "You have the right to access, rectify, or erase your data. Contact dpo@gorola.com. You also hold the statutory right to lodge a complaint with the Data Protection Board of India (DPBI)."
  },
  ORDER_PROCESSING: {
    title: "Order Fulfillment & Location Services",
    version: "1.0",
    effectiveDate: "29/09/2026",
    purpose:
      "We process your location and transaction details to calculate accurate delivery routes, coordinate with local fulfillment hubs, assign delivery riders, and process electronic payments.",
    dataCollected: [
      "Delivery Address & Landmark Notes",
      "GPS Coordinates (saved address pin & order delivery coordinates)",
      "Display Name (if you have set one) — shared with your assigned store partner and delivery rider for order identification",
      "Transaction & Billing Details (excluding raw credit card data/CVV) — only when online payment is selected"
    ],
    thirdParties:
      "Shared strictly on a need-to-know basis with: Ola Maps (spatial routing and geolocation), Razorpay (secure payment processing — only when online payment is selected), Local Store Partners & Assigned Delivery Riders (physical order fulfillment).",
    retention:
      "Your saved delivery address (including GPS pin) is stored until you delete it or your account. The GPS coordinates copied to each order record are nulled out when you exercise your Right to Erasure; the financial record of the order (totals, payment method) is retained for 7 years under Indian GST and financial accounting law. Live GPS streams used for routing are never persisted — they are processed in-transit by Ola Maps and discarded.",
    rights:
      "You may update your saved addresses at any time. Contact dpo@gorola.com. You also hold the statutory right to lodge a complaint with the Data Protection Board of India (DPBI)."
  },
  MARKETING_COMMS: {
    title: "Promotions & Seasonal Offers",
    version: "1.0",
    effectiveDate: "29/09/2026",
    purpose:
      "We process your phone number and historical purchase categories to send you targeted seasonal Mussoorie harvest updates, hill-station discounts, and exclusive store coupons via SMS and app notifications.",
    dataCollected: [
      "Phone Number — used to send SMS promotional messages",
      "Display Name (if you have set one) — used for personalised greetings",
      "Purchase History & Regional Location (Mussoorie cluster) — used to personalise offers"
    ],
    thirdParties:
      "Promotional messages are sent via our authorised SMS gateway partners. No data is shared with external advertising networks or third-party marketers. Your phone number is never sold.",
    retention:
      "Processed for marketing until you withdraw your consent. Upon withdrawal, scrubbed from all promotional distributions within 48 hours.",
    rights:
      "Consent for marketing is entirely voluntary. You can withdraw your consent instantly via the Privacy Settings panel at any time without affecting your core service access."
  },
  ANALYTICS: {
    title: "Usage & Performance Analytics",
    version: "1.0",
    effectiveDate: "29/09/2026",
    purpose:
      "We collect system performance logs and navigation response rates to identify software bugs, optimise steep hill routing, and improve app speed over weak network bands.",
    dataCollected: [
      "Device Telemetry (OS version, hardware model, app crash logs)",
      "Network performance data and regional route latency parameters"
    ],
    thirdParties:
      "Processed natively within our secure internal systems. Not mapped to your personal identifier. Handled purely as bulk performance telemetry. Zero PII is tracked.",
    retention:
      "Retained in aggregated logs for a maximum of 180 days, then automatically purged or completely anonymized.",
    rights:
      "Turn off performance tracking at any time via the Privacy dashboard. Disabling this will not restrict any app features or purchases."
  }
};

export interface ConsentNoticeModalProps {
  purpose: ConsentPurpose;
  triggerLabel?: string;
  triggerClassName?: string;
}

export function ConsentNoticeModal({
  purpose,
  triggerLabel = "View Complete Notice",
  triggerClassName
}: ConsentNoticeModalProps): ReactElement {
  const notice = CONSENT_NOTICES[purpose];

  return (
    <Dialog>
      <DialogTrigger asChild>
        <button
          type="button"
          data-testid={`view-notice-btn-${purpose}`}
          className={
            triggerClassName ??
            "inline-flex items-center gap-1.5 text-xs font-medium text-gorola-pine hover:underline cursor-pointer transition-colors p-0 bg-transparent border-0"
          }
        >
          <FileText className="h-3.5 w-3.5" />
          <span>{triggerLabel}</span>
        </button>
      </DialogTrigger>
      <DialogContent
        data-testid="consent-notice-modal"
        className="max-w-lg bg-white dark:bg-card border border-border/80 shadow-xl sm:rounded-2xl p-0 overflow-hidden"
      >
        <DialogHeader className="p-6 pb-3 border-b border-border/60 bg-muted/20">
          <div className="flex items-center gap-2 text-gorola-pine mb-1">
            <ShieldCheck className="h-5 w-5" />
            <span className="text-xs font-semibold uppercase tracking-wider">
              Statutory DPDP Notice (v{notice.version})
            </span>
          </div>
          <DialogTitle className="text-lg font-bold text-gorola-charcoal">
            {notice.title}
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Effective Date: {notice.effectiveDate} &bull; DPDP Act 2023 Compliant
          </DialogDescription>
        </DialogHeader>

        <ScrollArea data-lenis-prevent className="max-h-[60vh] overflow-y-auto p-6 space-y-4 overscroll-contain">
          <div className="space-y-4 text-xs text-gorola-charcoal/90 leading-relaxed">
            <div>
              <h4 className="font-semibold text-sm text-gorola-charcoal mb-1">
                1. Purpose of Processing
              </h4>
              <p className="text-muted-foreground">{notice.purpose}</p>
            </div>

            <div>
              <h4 className="font-semibold text-sm text-gorola-charcoal mb-1">
                2. Categories of Personal Data Collected
              </h4>
              <ul className="list-disc pl-5 space-y-1 text-muted-foreground">
                {notice.dataCollected.map((item, idx) => (
                  <li key={idx}>{item}</li>
                ))}
              </ul>
            </div>

            <div>
              <h4 className="font-semibold text-sm text-gorola-charcoal mb-1">
                3. Third-Party Recipients &amp; Processors
              </h4>
              <p className="text-muted-foreground">{notice.thirdParties}</p>
            </div>

            <div>
              <h4 className="font-semibold text-sm text-gorola-charcoal mb-1">
                4. Retention Period
              </h4>
              <p className="text-muted-foreground">{notice.retention}</p>
            </div>

            <div>
              <h4 className="font-semibold text-sm text-gorola-charcoal mb-1">
                5. Your Rights &amp; Complaints
              </h4>
              <p className="text-muted-foreground">{notice.rights}</p>
            </div>
          </div>
        </ScrollArea>

        <div className="p-4 border-t border-border/60 bg-muted/10 flex flex-col sm:flex-row items-center justify-between gap-3 text-[11px] text-muted-foreground">
          <span>
            Grievance Officer:{" "}
            <a
              href="mailto:dpo@gorola.com"
              className="font-medium text-gorola-pine underline hover:text-gorola-pine/80"
            >
              dpo@gorola.com
            </a>
          </span>
          <span>Data Protection Board of India (DPBI)</span>
        </div>
      </DialogContent>
    </Dialog>
  );
}
