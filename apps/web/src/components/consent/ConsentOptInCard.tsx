import { CANONICAL_CONSENT_NOTICES, type ConsentPurpose } from "@gorola/shared";
import type { ReactElement, ReactNode } from "react";

import { ConsentNoticeModal } from "@/components/consent/ConsentNoticeModal";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";

export type ConsentCardMode = "essential-gate" | "optional-opt-in" | "informational";

export interface ConsentOptInCardProps {
  purpose: ConsentPurpose;
  mode?: ConsentCardMode;
  checked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
  hasExistingActiveConsent?: boolean;
  disabled?: boolean;
  error?: string | null;
  className?: string;
  testId?: string;
  checkboxTestId?: string;
  checkboxLabel?: string;
  triggerLabel?: string;
  triggerClassName?: string;
  children?: ReactNode;
}

export function ConsentOptInCard({
  purpose,
  mode,
  checked = false,
  onCheckedChange,
  hasExistingActiveConsent = false,
  disabled = false,
  error,
  className,
  testId,
  checkboxTestId,
  checkboxLabel,
  triggerLabel,
  triggerClassName,
  children
}: ConsentOptInCardProps): ReactElement {
  const notice = CANONICAL_CONSENT_NOTICES[purpose];
  const isEssential = notice?.isEssential ?? false;

  // Determine effective mode
  const effectiveMode: ConsentCardMode =
    mode ?? (isEssential ? "essential-gate" : "optional-opt-in");

  const effectiveTestId = testId ?? `consent-card-${purpose}`;
  const effectiveCheckboxTestId =
    checkboxTestId ?? (purpose === "MARKETING_COMMS" ? "marketing-consent-checkbox" : `${purpose.toLowerCase()}-acknowledge-checkbox`);
  const effectiveCheckboxLabel = checkboxLabel ?? notice.checkboxLabel;
  const effectiveTriggerLabel = triggerLabel ?? notice.noticeTriggerLabel;

  return (
    <div
      data-testid={effectiveTestId}
      className={cn(
        "rounded-2xl border border-border/80 bg-white dark:bg-card p-4 sm:p-5 text-sm text-gorola-charcoal space-y-3.5 shadow-xs text-left",
        className
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 font-semibold text-xs sm:text-sm text-gorola-charcoal">
          <span
            className={cn(
              "inline-block h-2 w-2 rounded-full",
              isEssential ? "bg-emerald-600" : "bg-amber-500"
            )}
          />
          <span>{notice.title}</span>
        </div>
        <span
          className={cn(
            "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ring-1 ring-inset",
            isEssential
              ? "bg-emerald-50 text-emerald-700 ring-emerald-600/20"
              : "bg-amber-50 text-amber-700 ring-amber-600/20"
          )}
        >
          {isEssential ? "Essential" : "Optional"}
        </span>
      </div>

      {/* Summary */}
      <p className="text-muted-foreground leading-relaxed text-xs sm:text-sm">
        {notice.summaryText}
      </p>

      {/* Transparency Prompt / Notice Modal Link */}
      <div className="pt-0.5 text-xs text-muted-foreground">
        <span>{notice.transparencyPrompt} </span>
        <ConsentNoticeModal
          purpose={purpose}
          triggerLabel={effectiveTriggerLabel}
          triggerClassName={
            triggerClassName ??
            "inline-flex items-center align-baseline gap-1 text-xs font-semibold text-gorola-pine underline hover:text-emerald-700 cursor-pointer p-0 bg-transparent border-0"
          }
        />
        <span> (or view our platform-wide </span>
        <a
          href="/privacy"
          target="_blank"
          rel="noreferrer"
          className="font-semibold text-gorola-pine underline hover:text-emerald-700 align-baseline"
        >
          Privacy Policy
        </a>
        <span>).</span>
      </div>

      {/* Action / Status Row */}
      {effectiveMode === "informational" ? null : hasExistingActiveConsent ? (
        <div
          data-testid="consent-active-indicator"
          className="flex items-center gap-2 pt-2.5 border-t border-border/60 text-xs text-muted-foreground"
        >
          <span className="inline-flex items-center gap-1.5 font-medium text-emerald-700 dark:text-emerald-400">
            <span className="h-2 w-2 rounded-full bg-emerald-600 inline-block" />
            Consent Active
          </span>
          <span className="text-muted-foreground/40">•</span>
          {isEssential ? (
            <span>Permanent operational requirement</span>
          ) : (
            <span>
              Manage or withdraw in{" "}
              <a href="/account/privacy" className="underline text-gorola-pine hover:text-emerald-700">
                Privacy Settings
              </a>
            </span>
          )}
        </div>
      ) : (
        <div className="flex items-start gap-2.5 pt-2.5 border-t border-border/60">
          <Checkbox
            id={`consent-ack-${purpose}`}
            checked={checked}
            disabled={disabled}
            data-testid={effectiveCheckboxTestId}
            onCheckedChange={(val) => onCheckedChange?.(Boolean(val))}
          />
          <label
            htmlFor={`consent-ack-${purpose}`}
            className="text-xs font-medium text-gorola-charcoal/90 leading-tight cursor-pointer select-none"
          >
            {effectiveCheckboxLabel}
          </label>
        </div>
      )}

      {error ? (
        <p role="alert" className="text-xs font-medium text-destructive">
          {error}
        </p>
      ) : null}

      {children}
    </div>
  );
}
