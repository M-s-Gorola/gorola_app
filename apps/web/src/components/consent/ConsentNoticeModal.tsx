import { CANONICAL_CONSENT_NOTICES, type ConsentPurpose, GRIEVANCE_EMAIL } from "@gorola/shared";
import { FileText, ShieldCheck } from "lucide-react";
import type { ReactElement, ReactNode } from "react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";

export type { ConsentPurpose };

export interface NoticeContent {
  title: string;
  version: string;
  effectiveDate: string;
  purpose: string | ReactNode;
  dataCollected: (string | ReactNode)[];
  thirdParties: string | ReactNode;
  retention: string | ReactNode;
  rights: string | ReactNode;
}

export const CONSENT_NOTICES: Record<ConsentPurpose, NoticeContent> = Object.fromEntries(
  (Object.keys(CANONICAL_CONSENT_NOTICES) as ConsentPurpose[]).map((purpose) => {
    const canonical = CANONICAL_CONSENT_NOTICES[purpose];
    return [
      purpose,
      {
        title: canonical.title,
        version: canonical.version,
        effectiveDate: canonical.effectiveDate,
        purpose: canonical.summaryText,
        dataCollected: canonical.disclosures.dataCollected,
        thirdParties: canonical.disclosures.thirdParties,
        retention: canonical.disclosures.retention,
        rights: canonical.disclosures.rights
      }
    ];
  })
) as Record<ConsentPurpose, NoticeContent>;

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
            "inline-flex items-center align-baseline gap-1 text-xs font-semibold text-gorola-pine underline hover:text-emerald-700 cursor-pointer transition-colors p-0 bg-transparent border-0"
          }
        >
          <FileText className="h-3.5 w-3.5 shrink-0 inline-block align-middle -mt-0.5" />
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
              href={`mailto:${GRIEVANCE_EMAIL}`}
              className="font-medium text-gorola-pine underline hover:text-gorola-pine/80"
            >
              {GRIEVANCE_EMAIL}
            </a>
          </span>
          <span>Data Protection Board of India (DPBI)</span>
        </div>
      </DialogContent>
    </Dialog>
  );
}
