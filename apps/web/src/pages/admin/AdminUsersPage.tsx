import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  RefreshCw,
  Search
} from "lucide-react";
import type { ReactElement } from "react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

import { api } from "@/lib/api";
import { getScopedPath, resolveSubdomain } from "@/lib/subdomain-resolver";

type UserListItem = {
  id: string;
  maskedPhone: string;
  name: string;
  orderCount: number;
  totalSpent: number;
  createdAt: string;
  isActive: boolean;
};

type UsersListResponse = {
  success: boolean;
  data: UserListItem[];
};

export function AdminUsersPage(): ReactElement {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { isSubdomainMode } = resolveSubdomain(window.location.hostname);

  // Search and debounce states
  const [searchInput, setSearchInput] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  // Confirmation dialog states
  const [confirmStatusChangeUserId, setConfirmStatusChangeUserId] = useState<string | null>(null);

  // Debounce search effect (300ms)
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(searchInput.trim());
    }, 300);

    return () => {
      clearTimeout(handler);
    };
  }, [searchInput]);

  // Fetch users query
  const { data: users, isLoading, isError, isFetching, refetch } = useQuery<UserListItem[]>({
    queryKey: ["admin", "users", debouncedSearch],
    queryFn: async () => {
      if (!api) throw new Error("API helper not initialized");
      const url = debouncedSearch
        ? `/api/v1/admin/users?phone=${encodeURIComponent(debouncedSearch)}`
        : "/api/v1/admin/users";
      const res = await api.get<UsersListResponse>(url);
      return res.data.data;
    },
    staleTime: 10000
  });

  // Toggle user status mutation (Suspend / Unsuspend)
  const toggleStatusMutation = useMutation({
    mutationFn: async ({ userId, isCurrentlyActive }: { userId: string; isCurrentlyActive: boolean }) => {
      if (!api) throw new Error("API helper not initialized");
      const endpoint = isCurrentlyActive
        ? `/api/v1/admin/users/${userId}/suspend`
        : `/api/v1/admin/users/${userId}/unsuspend`;
      const res = await api.put(endpoint, {});
      return res.data;
    },
    onSuccess: async (_, variables) => {
      const action = variables.isCurrentlyActive ? "suspended" : "unsuspended";
      toast.success(`User successfully ${action}`);
      setConfirmStatusChangeUserId(null);
      await queryClient.invalidateQueries({ queryKey: ["admin", "users"] });
    },
    onError: (err: unknown) => {
      const error = err as { response?: { data?: { error?: { message?: string } } } };
      const msg = error.response?.data?.error?.message || "Failed to update user status";
      toast.error(msg);
    }
  });

  const formatCurrency = (val: number): string => {
    return `₹${val.toLocaleString("en-IN", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    })}`;
  };

  if (isLoading) {
    return (
      <div className="space-y-6 animate-pulse p-4 md:p-8">
        <div className="h-10 bg-gorola-charcoal/10 rounded-xl w-48" />
        <div className="h-12 bg-gorola-charcoal/10 rounded-2xl w-full" />
        <div className="h-64 bg-gorola-charcoal/10 rounded-2xl w-full" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="p-8 text-center space-y-4">
        <AlertTriangle className="h-10 w-10 text-gorola-clay mx-auto" />
        <h2 className="text-xl font-bold text-gorola-charcoal">Failed to load platform users</h2>
        <p className="text-sm text-gorola-slate">An error occurred while communicating with the server.</p>
        <button
          onClick={() => void refetch()}
          className="px-4 py-2 bg-gorola-pine text-white text-xs font-bold rounded-xl shadow-md hover:bg-gorola-pine/90"
        >
          Try Again
        </button>
      </div>
    );
  }

  const items = users || [];

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gorola-charcoal tracking-tight">Platform Users</h1>
          <p className="text-xs text-gorola-slate mt-1 font-medium">
            Search registered users, audit statutory DPDP privacy consents, and manage buyer account statuses.
          </p>
        </div>

        <button
          onClick={() => void refetch()}
          disabled={isFetching}
          className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-gorola-charcoal/10 hover:border-gorola-pine/20 rounded-xl text-xs font-bold text-gorola-charcoal shadow-sm transition-all self-start sm:self-auto disabled:opacity-50"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${isFetching ? "animate-spin text-gorola-pine" : "text-gorola-slate"}`} />
          Sync List
        </button>
      </header>

      {/* Filter and Search Bar */}
      <section className="bg-white rounded-2xl border border-gorola-charcoal/10 p-4 shadow-sm flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gorola-slate/60" />
          <input
            data-testid="search-phone-input"
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search by phone number (e.g. 9876)..."
            className="w-full bg-gorola-charcoal/5 border border-gorola-charcoal/10 rounded-xl pl-10 pr-4 py-2.5 text-sm text-gorola-charcoal placeholder:text-gorola-slate/50 focus:outline-none focus:ring-2 focus:ring-gorola-pine/20 focus:border-gorola-pine/35 transition-all"
          />
        </div>
      </section>

      {/* Users Table */}
      <div className="bg-white rounded-2xl border border-gorola-charcoal/10 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-gorola-charcoal/5 bg-gorola-charcoal/[0.02]">
                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-wider text-gorola-slate whitespace-nowrap">Name</th>
                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-wider text-gorola-slate whitespace-nowrap">Phone Number</th>
                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-wider text-gorola-slate text-center whitespace-nowrap">Orders Count</th>
                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-wider text-gorola-slate whitespace-nowrap">Total Spent</th>
                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-wider text-gorola-slate whitespace-nowrap">Joined Date</th>
                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-wider text-gorola-slate whitespace-nowrap">Status</th>
                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-wider text-gorola-slate text-right whitespace-nowrap">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gorola-charcoal/5">
              {items.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-sm font-medium text-gorola-slate whitespace-nowrap">
                    No buyer accounts matching the search query found.
                  </td>
                </tr>
              ) : (
                items.map((user) => {
                  const displayName = user.name?.trim() || "Registered User";
                  return (
                    <tr
                      key={user.id}
                      className={`hover:bg-gorola-charcoal/[0.01] transition-all cursor-pointer ${
                        !user.isActive ? "opacity-60 bg-gorola-slate-mist/5" : ""
                      }`}
                      onClick={() => navigate(getScopedPath(`/admin/users/${user.id}`, "admin", isSubdomainMode))}
                    >
                      <td className="px-6 py-4 font-bold text-gorola-charcoal whitespace-nowrap">{displayName}</td>
                      <td className="px-6 py-4 font-mono text-xs text-gorola-charcoal whitespace-nowrap">{user.maskedPhone}</td>
                      <td className="px-6 py-4 font-bold text-center text-gorola-charcoal whitespace-nowrap">{user.orderCount}</td>
                      <td className="px-6 py-4 font-bold text-gorola-charcoal whitespace-nowrap">{formatCurrency(user.totalSpent)}</td>
                      <td className="px-6 py-4 text-xs font-medium text-gorola-slate whitespace-nowrap">
                        {new Date(user.createdAt).toLocaleDateString("en-IN", {
                          year: "numeric",
                          month: "short",
                          day: "numeric"
                        })}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span
                          className={`inline-flex px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider border ${
                            user.isActive
                              ? "bg-emerald-100 text-emerald-800 border-emerald-200/50"
                              : "bg-rose-100 text-rose-800 border-rose-200/50"
                          }`}
                        >
                          {user.isActive ? "Active" : "Suspended"}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right space-x-2 whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                        <button
                          data-testid={`view-details-${user.id}`}
                          onClick={() => navigate(getScopedPath(`/admin/users/${user.id}`, "admin", isSubdomainMode))}
                          className="px-3 py-1.5 bg-white border border-gorola-mint/20 hover:border-gorola-pine/20 rounded-xl text-xs font-bold text-gorola-pine transition-all shadow-sm whitespace-nowrap"
                        >
                          View Details
                        </button>
                        <button
                          data-testid={`toggle-status-${user.id}`}
                          onClick={() => setConfirmStatusChangeUserId(user.id)}
                          className={`px-3 py-1.5 border rounded-xl text-xs font-bold transition-all shadow-sm whitespace-nowrap ${
                            user.isActive
                              ? "bg-rose-50 border-rose-200 text-rose-600 hover:bg-rose-100"
                              : "bg-emerald-50 border-emerald-200 text-emerald-600 hover:bg-emerald-100"
                          }`}
                        >
                          {user.isActive ? "Suspend" : "Unsuspend"}
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Confirmation Modal for Suspending/Unsuspending */}
      {confirmStatusChangeUserId && (
        <div className="fixed inset-0 bg-gorola-charcoal/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 md:p-8 max-w-md w-full shadow-2xl space-y-4 animate-in zoom-in-95 duration-200">
            {(() => {
              const targetUser = items.find((u) => u.id === confirmStatusChangeUserId);
              if (!targetUser) return null;
              return (
                <>
                  <h3 className="text-lg font-bold text-gorola-charcoal">
                    {targetUser.isActive ? "Suspend User Account?" : "Unsuspend User Account?"}
                  </h3>
                  <p className="text-xs text-gorola-slate leading-relaxed">
                    {targetUser.isActive
                      ? `Suspending ${targetUser.name || "this user"} will immediately terminate their active sessions and block further OTP verification.`
                      : `Unsuspending ${targetUser.name || "this user"} will restore their ability to log in.`}
                  </p>
                  <div className="flex items-center justify-end gap-3 pt-4 border-t border-gorola-charcoal/10">
                    <button
                      type="button"
                      onClick={() => setConfirmStatusChangeUserId(null)}
                      className="px-4 py-2 text-xs font-bold text-gorola-slate hover:bg-gorola-mint/10 rounded-xl"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      disabled={toggleStatusMutation.isPending}
                      onClick={() =>
                        toggleStatusMutation.mutate({
                          userId: targetUser.id,
                          isCurrentlyActive: targetUser.isActive
                        })
                      }
                      data-testid="confirm-status-change"
                      className={`px-5 py-2 text-xs font-black rounded-xl text-white shadow-md ${
                        targetUser.isActive
                          ? "bg-rose-600 hover:bg-rose-700"
                          : "bg-emerald-600 hover:bg-emerald-700"
                      }`}
                    >
                      {toggleStatusMutation.isPending ? "Updating..." : "Confirm"}
                    </button>
                  </div>
                </>
              );
            })()}
          </div>
        </div>
      )}
    </div>
  );
}
