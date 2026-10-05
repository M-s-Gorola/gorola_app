import { CONSENT_NOTICES } from "@gorola/shared";
import { type ReactElement, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export type AgeStepProps = {
  mode?: "entry" | "blocked";
  onConfirm: (dateOfBirthIso: string) => Promise<void> | void;
  error?: string | null;
};

export function AgeStep({
  mode = "entry",
  onConfirm,
  error: externalError
}: AgeStepProps): ReactElement {
  const [subStep, setSubStep] = useState<"fields" | "confirm">("fields");
  const [day, setDay] = useState("");
  const [month, setMonth] = useState("");
  const [year, setYear] = useState("");
  const [localError, setLocalError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (mode === "blocked") {
    return (
      <div className="mt-6 flex flex-col gap-5" data-testid="age-blocked-step">
        <div className="rounded-2xl border border-destructive/30 bg-destructive/10 p-5 text-sm text-gorola-charcoal space-y-3.5 shadow-xs">
          <h2 className="text-base font-semibold text-destructive font-heading">
            We can&apos;t create your account
          </h2>
          <p className="text-muted-foreground leading-relaxed text-xs sm:text-sm">
            GoRola is available only to people aged 18 and over. If you think this is a mistake, write to{" "}
            <a
              href="mailto:privacy@gorola.in"
              className="font-medium text-gorola-pine underline hover:text-emerald-700"
            >
              privacy@gorola.in
            </a>
            .
          </p>
        </div>
      </div>
    );
  }

  const isComplete = day.trim().length > 0 && month.trim().length > 0 && year.trim().length > 0;

  function validateInputs(): { valid: boolean; iso?: string; formatted?: string } {
    const d = parseInt(day, 10);
    const m = parseInt(month, 10);
    const y = parseInt(year, 10);

    if (isNaN(d) || isNaN(m) || isNaN(y)) {
      return { valid: false };
    }

    if (year.length !== 4 || y < 1900 || m < 1 || m > 12) {
      return { valid: false };
    }

    // Days in month validation
    const daysInMonth = new Date(Date.UTC(y, m, 0)).getUTCDate();
    if (d < 1 || d > daysInMonth) {
      return { valid: false };
    }

    const paddedD = String(d).padStart(2, "0");
    const paddedM = String(m).padStart(2, "0");
    const iso = `${y}-${paddedM}-${paddedD}`;

    const now = new Date();
    const formatter = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Kolkata",
      year: "numeric",
      month: "2-digit",
      day: "2-digit"
    });
    const todayStr = formatter.format(now);
    if (iso > todayStr) {
      return { valid: false };
    }

    const displayDate = new Date(Date.UTC(y, m - 1, d));
    const formatted = new Intl.DateTimeFormat("en-IN", {
      day: "numeric",
      month: "long",
      year: "numeric",
      timeZone: "UTC"
    }).format(displayDate);

    return { valid: true, iso, formatted };
  }

  function handleContinue(): void {
    setLocalError(null);
    const result = validateInputs();
    if (!result.valid) {
      setLocalError("Please enter a valid date of birth.");
      return;
    }
    setSubStep("confirm");
  }

  async function handleConfirmYes(): Promise<void> {
    if (submitting) return;
    const result = validateInputs();
    if (!result.valid || !result.iso) {
      setLocalError("Please enter a valid date of birth.");
      setSubStep("fields");
      return;
    }

    setSubmitting(true);
    try {
      await onConfirm(result.iso);
    } finally {
      setSubmitting(false);
    }
  }

  const { formatted: confirmedFormattedDate } = validateInputs();

  if (subStep === "confirm") {
    return (
      <div className="mt-6 flex flex-col gap-5" data-testid="age-confirm-step">
        <div className="rounded-2xl border border-border/80 bg-white dark:bg-card p-5 text-sm text-gorola-charcoal space-y-3.5 shadow-xs">
          <p data-testid="age-confirm-text" className="text-sm font-medium text-gorola-charcoal leading-relaxed">
            You entered <span className="font-semibold text-gorola-pine">{confirmedFormattedDate}</span>. Is this correct?
          </p>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Please make sure your date of birth is accurate before proceeding.
          </p>
        </div>

        <div className="flex flex-col gap-3">
          <Button
            className="w-full rounded-full"
            data-testid="age-confirm-yes-btn"
            disabled={submitting}
            onClick={handleConfirmYes}
            type="button"
          >
            {submitting ? "Confirming..." : "Yes, continue"}
          </Button>

          <Button
            className="w-full rounded-full"
            data-testid="age-confirm-edit-btn"
            disabled={submitting}
            onClick={() => setSubStep("fields")}
            type="button"
            variant="outline"
          >
            Edit
          </Button>
        </div>

        {externalError ? (
          <p className="text-destructive text-sm" data-testid="age-error" role="alert" aria-live="polite">
            {externalError}
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <div className="mt-6 flex flex-col gap-5" data-testid="age-step">
      <div className="rounded-2xl border border-border/80 bg-white dark:bg-card p-5 text-sm text-gorola-charcoal space-y-3.5 shadow-xs">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 font-semibold text-gorola-pine">
            <span className="inline-block h-2 w-2 rounded-full bg-emerald-600" />
            <span>Age Confirmation</span>
          </div>
          <span className="inline-flex items-center rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-medium text-emerald-700 ring-1 ring-inset ring-emerald-600/20">
            Essential
          </span>
        </div>

        <p className="text-muted-foreground leading-relaxed text-xs sm:text-sm">
          {CONSENT_NOTICES.AGE_DECLARATION["1.1"]}
        </p>

        <div className="pt-2">
          <label className="text-xs font-medium text-gorola-charcoal block mb-2">
            Date of birth
          </label>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label htmlFor="age-day-input" className="sr-only">
                Day
              </label>
              <Input
                id="age-day-input"
                data-testid="age-day"
                aria-label="Day"
                autoComplete="off"
                inputMode="numeric"
                maxLength={2}
                placeholder="DD"
                value={day}
                onChange={(e) => {
                  setLocalError(null);
                  setDay(e.target.value.replace(/\D/g, "").slice(0, 2));
                }}
                className="text-center font-mono"
              />
            </div>
            <div>
              <label htmlFor="age-month-input" className="sr-only">
                Month
              </label>
              <Input
                id="age-month-input"
                data-testid="age-month"
                aria-label="Month"
                autoComplete="off"
                inputMode="numeric"
                maxLength={2}
                placeholder="MM"
                value={month}
                onChange={(e) => {
                  setLocalError(null);
                  setMonth(e.target.value.replace(/\D/g, "").slice(0, 2));
                }}
                className="text-center font-mono"
              />
            </div>
            <div>
              <label htmlFor="age-year-input" className="sr-only">
                Year
              </label>
              <Input
                id="age-year-input"
                data-testid="age-year"
                aria-label="Year"
                autoComplete="off"
                inputMode="numeric"
                maxLength={4}
                placeholder="YYYY"
                value={year}
                onChange={(e) => {
                  setLocalError(null);
                  setYear(e.target.value.replace(/\D/g, "").slice(0, 4));
                }}
                className="text-center font-mono"
              />
            </div>
          </div>
        </div>
      </div>

      <Button
        className="w-full rounded-full"
        data-testid="age-continue-btn"
        disabled={!isComplete}
        onClick={handleContinue}
        type="button"
      >
        Continue
      </Button>

      {localError || externalError ? (
        <p
          className="text-destructive text-sm"
          data-testid="age-error"
          role="alert"
          aria-live="polite"
        >
          {localError || externalError}
        </p>
      ) : null}
    </div>
  );
}
