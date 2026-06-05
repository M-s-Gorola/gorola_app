import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, RefreshCw } from "lucide-react";
import type { ReactElement } from "react";
import { useState } from "react";
import { toast } from "sonner";

import { api } from "@/lib/api";

type FeatureFlagItem = {
  key: string;
  value: boolean;
  description: string | null;
  updatedBy: string;
  updatedAt: string;
};

type FeatureFlagsListResponse = {
  success: boolean;
  data: FeatureFlagItem[];
};

export function AdminFeatureFlagsPage(): ReactElement {
  const queryClient = useQueryClient();

  const [confirmingFlag, setConfirmingFlag] = useState<{ key: string; value: boolean } | null>(null);
  const [isUpdatingFlag, setIsUpdatingFlag] = useState(false);

  // Fetch feature flags query
  const { data: flags, isLoading, isError, isFetching, refetch } = useQuery<FeatureFlagItem[]>({
    queryKey: ["admin", "feature-flags"],
    queryFn: async () => {
      if (!api) throw new Error("API helper not initialized");
      const res = await api.get<FeatureFlagsListResponse>("/api/v1/admin/feature-flags");
      return res.data.data;
    },
    staleTime: 10000,
  });

  // Toggle feature flag mutation
  const toggleFlagMutation = useMutation({
    mutationFn: async ({ key, value }: { key: string; value: boolean }) => {
      if (!api) throw new Error("API helper not initialized");
      await api.put(`/api/v1/admin/feature-flags/${key}`, { value });
    },
    onSuccess: (_, variables) => {
      toast.success(`Feature flag '${variables.key}' updated successfully.`);
      void queryClient.invalidateQueries({ queryKey: ["admin", "feature-flags"] });
    },
    onError: (err) => {
      console.error("Failed to toggle feature flag", err);
      toast.error("Failed to update feature flag.");
    },
    onSettled: () => {
      setIsUpdatingFlag(false);
      setConfirmingFlag(null);
    }
  });

  const handleToggleFlag = (key: string, currentValue: boolean) => {
    const isHighImpact = key === "WEATHER_MODE_ACTIVE" || key === "RIDER_INTERFACE_ENABLED";
    if (isHighImpact) {
      setConfirmingFlag({ key, value: !currentValue });
    } else {
      setIsUpdatingFlag(true);
      toggleFlagMutation.mutate({ key, value: !currentValue });
    }
  };

  const confirmToggleFlag = () => {
    if (!confirmingFlag) return;
    setIsUpdatingFlag(true);
    toggleFlagMutation.mutate(confirmingFlag);
  };

  const formatTimestamp = (dateStr: string): string => {
    try {
      const date = new Date(dateStr);
      return date.toLocaleString("en-IN", {
        day: "numeric",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return dateStr;
    }
  };

  if (isLoading && !flags) {
    return (
      <div data-testid="feature-flags-loading-skeleton" className="space-y-6 animate-pulse">
        <div className="h-10 bg-gorola-charcoal/10 rounded-xl w-48" />
        <div className="h-14 bg-white rounded-2xl border border-gorola-charcoal/5 shadow-sm" />
        <div className="h-96 bg-white rounded-2xl border border-gorola-charcoal/5 shadow-sm" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] text-center space-y-4">
        <AlertTriangle className="h-10 w-10 text-red-500" />
        <h2 className="text-lg font-bold text-gorola-charcoal">Failed to load feature flags</h2>
        <button onClick={() => void refetch()} className="px-4 py-2 bg-gorola-pine text-white rounded-xl text-sm font-bold">
          Try Again
        </button>
      </div>
    );
  }

  const items = flags ?? [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="font-heading text-3xl font-bold text-gorola-charcoal">Feature Flags</h1>
          <p className="text-sm text-gorola-slate font-dm-sans">
            Configure platform-wide capability controls and toggle system-wide flags.
          </p>
        </div>

        <button
          onClick={() => void refetch()}
          disabled={isFetching}
          className="px-4 py-2.5 bg-white border border-gorola-mint/20 hover:border-gorola-pine/20 rounded-xl text-xs font-bold uppercase tracking-wider flex items-center gap-2 shadow-sm transition-all disabled:opacity-50"
        >
          <RefreshCw className={`h-4 w-4 text-gorola-pine ${isFetching ? "animate-spin" : ""}`} />
          Sync Flags
        </button>
      </header>

      {/* Feature Flags Table */}
      <div className="bg-white rounded-2xl border border-gorola-charcoal/10 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-gorola-charcoal/5 bg-gorola-charcoal/[0.02]">
                <th className="pl-4 pr-3 py-4 text-[10px] font-black uppercase tracking-wider text-gorola-slate whitespace-nowrap">Flag Key</th>
                <th className="px-3 py-4 text-[10px] font-black uppercase tracking-wider text-gorola-slate whitespace-nowrap">Description</th>
                <th className="px-3 py-4 text-[10px] font-black uppercase tracking-wider text-gorola-slate whitespace-nowrap">Last Updated</th>
                <th className="px-3 py-4 text-[10px] font-black uppercase tracking-wider text-gorola-slate whitespace-nowrap">Updated By</th>
                <th className="pl-3 pr-4 py-4 text-[10px] font-black uppercase tracking-wider text-gorola-slate text-right whitespace-nowrap">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gorola-charcoal/5">
              {items.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-12 text-center text-sm font-medium text-gorola-slate whitespace-nowrap">
                    No feature flags found.
                  </td>
                </tr>
              ) : (
                items.map((flag) => (
                  <tr key={flag.key} className="hover:bg-gorola-charcoal/[0.01] transition-all">
                    <td className="pl-4 pr-3 py-4 text-xs font-bold text-gorola-charcoal whitespace-nowrap">
                      {flag.key}
                    </td>
                    <td className="px-3 py-4 text-xs text-gorola-slate max-w-xs truncate" title={flag.description ?? ""}>
                      {flag.description || <span className="text-gorola-slate/40 italic">No description</span>}
                    </td>
                    <td className="px-3 py-4 text-xs text-gorola-slate whitespace-nowrap">
                      {formatTimestamp(flag.updatedAt)}
                    </td>
                    <td className="px-3 py-4 text-xs text-gorola-slate whitespace-nowrap">
                      {flag.updatedBy}
                    </td>
                    <td className="pl-3 pr-4 py-4 text-right whitespace-nowrap">
                      <button
                        role="switch"
                        aria-checked={flag.value}
                        aria-label={`Toggle flag ${flag.key}`}
                        disabled={isUpdatingFlag}
                        onClick={() => handleToggleFlag(flag.key, flag.value)}
                        className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none disabled:opacity-50 ${
                          flag.value ? "bg-gorola-pine" : "bg-gorola-charcoal/20"
                        }`}
                      >
                        <span
                          className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
                            flag.value ? "translate-x-5" : "translate-x-0.5"
                          }`}
                        />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="mt-4 pt-3 text-center">
        <span className="text-[10px] text-gorola-slate font-dm-sans block">
          * Note: Changes will propagate to Redis cache within 60s.
        </span>
      </div>

      {/* Confirmation Modal */}
      {confirmingFlag && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-gorola-charcoal/40 backdrop-blur-sm animate-in fade-in duration-200">
          <div role="dialog" aria-modal="true" className="bg-white rounded-2xl p-6 max-w-md w-full mx-4 shadow-xl border border-gorola-charcoal/10 transform animate-in zoom-in-95 duration-200">
            <h3 className="text-lg font-bold text-gorola-charcoal flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-red-500" />
              Confirm Feature Flag Update
            </h3>
            <p className="text-sm text-gorola-slate font-dm-sans mt-3">
              Are you sure you want to toggle the feature flag <strong>{confirmingFlag.key}</strong> to{" "}
              <strong>{confirmingFlag.value ? "ON" : "OFF"}</strong>?
              {confirmingFlag.key === "WEATHER_MODE_ACTIVE" && (
                <span className="block mt-2 text-xs text-amber-700 bg-amber-50 border border-amber-100 p-2 rounded-lg font-sans">
                  <strong>⚠️ Warning:</strong> Activating Weather Mode has high system impact, restricting rider delivery zones and altering pricing modifiers immediately.
                </span>
              )}
              {confirmingFlag.key === "RIDER_INTERFACE_ENABLED" && (
                <span className="block mt-2 text-xs text-amber-700 bg-amber-50 border border-amber-100 p-2 rounded-lg font-sans">
                  <strong>⚠️ Warning:</strong> Enabling the Rider Interface exposes delivery partner portals immediately.
                </span>
              )}
            </p>
            <div className="mt-6 flex justify-end gap-3">
              <button
                disabled={isUpdatingFlag}
                onClick={() => setConfirmingFlag(null)}
                className="px-4 py-2 border border-gorola-charcoal/10 hover:bg-gorola-charcoal/5 rounded-xl font-bold text-sm text-gorola-slate transition-colors"
              >
                Cancel
              </button>
              <button
                disabled={isUpdatingFlag}
                onClick={confirmToggleFlag}
                className="px-4 py-2 bg-gorola-pine hover:bg-gorola-pine/90 text-white rounded-xl font-bold text-sm shadow-sm transition-colors"
              >
                {isUpdatingFlag ? "Updating..." : "Confirm Update"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
