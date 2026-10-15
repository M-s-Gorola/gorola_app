import { CANONICAL_CONSENT_NOTICES, type ConsentPurpose } from "@gorola/shared";
import { useCallback, useState } from "react";

import { api } from "@/lib/api";
import { queryClient } from "@/lib/query-client";

export interface RecordConsentResult {
  success: boolean;
  error?: unknown;
}

export function useRecordConsent() {
  const [loading, setLoading] = useState(false);

  const recordConsent = useCallback(
    async (purpose: ConsentPurpose): Promise<RecordConsentResult> => {
      setLoading(true);
      try {
        if (!api) {
          return { success: false, error: new Error("API client not available") };
        }
        const notice = CANONICAL_CONSENT_NOTICES[purpose];
        if (!notice) {
          return { success: false, error: new Error(`Unknown purpose: ${purpose}`) };
        }

        await api.post("/api/v1/consent", {
          purpose,
          consentVersion: notice.version,
          noticeText: notice.plainText
        });

        await queryClient.invalidateQueries({ queryKey: ["consents"] });
        return { success: true };
      } catch (err: unknown) {
        return { success: false, error: err };
      } finally {
        setLoading(false);
      }
    },
    []
  );

  const withdrawConsent = useCallback(
    async (purpose: ConsentPurpose): Promise<RecordConsentResult> => {
      setLoading(true);
      try {
        if (!api) {
          return { success: false, error: new Error("API client not available") };
        }

        await api.delete(`/api/v1/consent/${purpose}`);
        await queryClient.invalidateQueries({ queryKey: ["consents"] });
        return { success: true };
      } catch (err: unknown) {
        return { success: false, error: err };
      } finally {
        setLoading(false);
      }
    },
    []
  );

  return {
    recordConsent,
    withdrawConsent,
    loading
  };
}
