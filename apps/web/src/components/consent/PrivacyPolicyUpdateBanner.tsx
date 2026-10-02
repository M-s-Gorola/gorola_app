import { AlertCircle, CheckCircle2, FileText } from "lucide-react";
import type { ReactElement } from "react";
import { useState } from "react";
import { Link } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import { useAuthStore } from "@/store/auth.store";

export type PrivacyPolicyUpdateBannerProps = {
  currentVersion?: string;
};

const GUEST_POLICY_STORAGE_KEY = "gorola_guest_policy_version";

export function PrivacyPolicyUpdateBanner({
  currentVersion = "1.0"
}: PrivacyPolicyUpdateBannerProps): ReactElement | null {
  const [loading, setLoading] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [guestAcceptedVersion, setGuestAcceptedVersion] = useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    try {
      return localStorage.getItem(GUEST_POLICY_STORAGE_KEY);
    } catch {
      return null;
    }
  });

  const accessToken = useAuthStore((s) => s.accessToken);
  const role = useAuthStore((s) => s.role);
  const userPolicyVersion = useAuthStore((s) => s.privacyPolicyVersionAccepted);
  const setPrivacyPolicyVersionAccepted = useAuthStore((s) => s.setPrivacyPolicyVersionAccepted);

  const isAuthenticated = Boolean(accessToken);

  // If logged in as non-BUYER (STORE_OWNER, ADMIN, RIDER), suppress buyer policy banner
  if (isAuthenticated && role !== "BUYER") {
    return null;
  }

  // Determine accepted version: if logged-in buyer, use auth store; if guest, use localStorage (both fallback to "1.0")
  const effectiveVersion = isAuthenticated
    ? (userPolicyVersion ?? "1.0")
    : (guestAcceptedVersion ?? "1.0");

  const isOutdated = Boolean(
    effectiveVersion !== currentVersion &&
      parseFloat(effectiveVersion) < parseFloat(currentVersion)
  );

  if (!isOutdated || dismissed) {
    return null;
  }

  const handleAccept = async (): Promise<void> => {
    setLoading(true);
    try {
      if (isAuthenticated && api) {
        await api.post("/api/v1/user/accept-policy", { version: currentVersion });
        setPrivacyPolicyVersionAccepted(currentVersion);
      }
      try {
        localStorage.setItem(GUEST_POLICY_STORAGE_KEY, currentVersion);
        setGuestAcceptedVersion(currentVersion);
      } catch {
        /* storage disabled */
      }
      setDismissed(true);
    } catch {
      /* network error handling */
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      data-testid="privacy-policy-update-banner"
      className="relative z-40 w-full bg-gorola-charcoal text-white px-4 py-3 shadow-md border-b border-amber-400/30 animate-in slide-in-from-top duration-300"
    >
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 text-xs sm:flex-row sm:text-sm">
        <div className="flex items-center gap-2 text-center sm:text-left">
          <AlertCircle className="h-4 w-4 shrink-0 text-amber-300" />
          <span>
            We&apos;ve updated our <strong>Privacy Policy &amp; Terms</strong> (v{currentVersion}) to reflect India&apos;s DPDP Act 2023. By continuing to use GoRola, you acknowledge the updated disclosures.
          </span>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <Link
            to="/privacy"
            className="inline-flex items-center gap-1 font-semibold text-gorola-sand hover:underline"
          >
            <FileText className="h-3.5 w-3.5" />
            Review Policy
          </Link>
          <Button
            data-testid="accept-policy-btn"
            size="sm"
            onClick={() => void handleAccept()}
            disabled={loading}
            className="rounded-full bg-white text-gorola-pine hover:bg-gorola-sand text-xs font-bold px-3 py-1 h-8 shadow-xs"
          >
            <CheckCircle2 className="mr-1 h-3.5 w-3.5 text-gorola-pine" />
            Accept &amp; Continue
          </Button>
        </div>
      </div>
    </div>
  );
}
