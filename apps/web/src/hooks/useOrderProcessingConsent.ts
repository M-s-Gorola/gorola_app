import { useQuery } from "@tanstack/react-query";

import { api } from "@/lib/api";
import { useAuthStore } from "@/store/auth.store";

type ConsentRecord = {
  purpose: string;
  isWithdrawn: boolean;
};

export function useOrderProcessingConsent() {
  const isBootstrapPending = useAuthStore((s) => s.isBootstrapPending);
  const accessToken = useAuthStore((s) => s.accessToken);

  const { data: consents, isLoading } = useQuery({
    enabled: !isBootstrapPending && !!accessToken,
    queryKey: ["consents"],
    queryFn: async () => {
      const res = await api?.get<{ data?: { consents: ConsentRecord[] } }>("/api/v1/consent");
      return res?.data?.data?.consents ?? [];
    }
  });

  const hasConsent = Boolean(
    consents?.some((c) => c.purpose === "ORDER_PROCESSING" && !c.isWithdrawn)
  );

  return { hasConsent, isLoading };
}
