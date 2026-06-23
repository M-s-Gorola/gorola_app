import { useQuery } from "@tanstack/react-query";

import { api } from "@/lib/api";

export type SuggestionItem = {
  id: string;
  name: string;
  type: "category" | "subcategory" | "product" | "service";
  redirectUrl: string;
};

export function useSearchSuggestions(query: string) {
  const trimmed = query.trim();
  return useQuery<SuggestionItem[]>({
    queryKey: ["search-suggestions", trimmed],
    queryFn: async () => {
      if (!api) throw new Error("API helper not initialized");
      if (trimmed.length === 0) return [];
      const res = await api.get<{ success: boolean; data: SuggestionItem[] }>(
        `/api/v1/search/suggestions?q=${encodeURIComponent(trimmed)}`
      );
      return res.data.data;
    },
    enabled: trimmed.length > 0,
    staleTime: 30 * 1000
  });
}
