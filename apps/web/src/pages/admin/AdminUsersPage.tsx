import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  MapPin,
  Phone,
  RefreshCw,
  Search
} from "lucide-react";
import type { ReactElement } from "react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { api } from "@/lib/api";

type UserListItem = {
  id: string;
  maskedPhone: string;
  name: string;
  orderCount: number;
  totalSpent: number;
  createdAt: string;
  isActive: boolean;
};

type OrderHistoryItem = {
  id: string;
  storeName: string;
  total: number;
  status: string;
  createdAt: string;
};

type AddressItem = {
  id: string;
  flatRoom?: string | null;
  landmarkDescription?: string | null;
};

type UserDetail = {
  id: string;
  name: string;
  maskedPhone: string;
  isActive: boolean;
  createdAt: string;
  orders: OrderHistoryItem[];
  addresses: AddressItem[];
};

type UsersListResponse = {
  success: boolean;
  data: UserListItem[];
};

type UserDetailResponse = {
  success: boolean;
  data: UserDetail;
};

export function AdminUsersPage(): ReactElement {
  const queryClient = useQueryClient();

  // Search and debounce states
  const [searchInput, setSearchInput] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  // Drawer / modal states
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
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

  // Fetch single user detail query
  const { data: userDetail, isLoading: isDetailLoading } = useQuery<UserDetail>({
    queryKey: ["admin", "user-detail", selectedUserId],
    queryFn: async () => {
      if (!api) throw new Error("API helper not initialized");
      const res = await api.get<UserDetailResponse>(`/api/v1/admin/users/${selectedUserId}`);
      return res.data.data;
    },
    enabled: !!selectedUserId
  });

  // Find user details helper for confirmation modal
  const confirmUser = users?.find((u) => u.id === confirmStatusChangeUserId);

  // Suspend / Unsuspend mutations
  const toggleStatusMutation = useMutation({
    mutationFn: async ({ userId, suspend }: { userId: string; suspend: boolean }) => {
      if (!api) throw new Error("API helper not initialized");
      const endpoint = `/api/v1/admin/users/${userId}/${suspend ? "suspend" : "unsuspend"}`;
      await api.put(endpoint, {});
    },
    onSuccess: (_, variables) => {
      const action = variables.suspend ? "suspended" : "unsuspended";
      toast.success(`User successfully ${action}`);
      void queryClient.invalidateQueries({ queryKey: ["admin", "users"] });
      // Also invalidate details query if open
      if (selectedUserId === variables.userId) {
        void queryClient.invalidateQueries({ queryKey: ["admin", "user-detail", selectedUserId] });
      }
      setConfirmStatusChangeUserId(null);
    },
    onError: (err: unknown) => {
      const error = err as { response?: { data?: { error?: { message?: string } } } };
      const msg = error.response?.data?.error?.message || "Failed to update user status";
      toast.error(msg);
    }
  });

  const handleToggleStatusConfirm = () => {
    if (!confirmStatusChangeUserId || !confirmUser) return;
    toggleStatusMutation.mutate({
      userId: confirmStatusChangeUserId,
      suspend: confirmUser.isActive
    });
  };

  const formatCurrency = (val: number): string => {
    return `₹${val.toLocaleString("en-IN", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    })}`;
  };

  if (isLoading && !users) {
    return (
      <div data-testid="users-loading-skeleton" className="space-y-6 animate-pulse">
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
        <h2 className="text-lg font-bold text-gorola-charcoal">Failed to load platform buyers</h2>
        <button onClick={() => void refetch()} className="px-4 py-2 bg-gorola-pine text-white rounded-xl text-sm font-bold">
          Try Again
        </button>
      </div>
    );
  }

  const items = users ?? [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="font-heading text-3xl font-bold text-gorola-charcoal">Platform Users</h1>
          <p className="text-sm text-gorola-slate font-dm-sans">
            Manage buyer accounts, search by contact numbers, inspect orders, and suspend or unsuspend sessions.
          </p>
        </div>

        <button
          onClick={() => void refetch()}
          disabled={isFetching}
          className="px-4 py-2.5 bg-white border border-gorola-mint/20 hover:border-gorola-pine/20 rounded-xl text-xs font-bold uppercase tracking-wider flex items-center gap-2 shadow-sm transition-all disabled:opacity-50"
        >
          <RefreshCw className={`h-4 w-4 text-gorola-pine ${isFetching ? "animate-spin" : ""}`} />
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
                items.map((user) => (
                  <tr
                    key={user.id}
                    className={`hover:bg-gorola-charcoal/[0.01] transition-all ${
                      !user.isActive ? "opacity-60 bg-gorola-slate-mist/5" : ""
                    }`}
                  >
                    <td className="px-6 py-4 font-bold text-gorola-charcoal whitespace-nowrap">{user.name}</td>
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
                    <td className="px-6 py-4 text-right space-x-2 whitespace-nowrap">
                      <button
                        data-testid={`view-details-${user.id}`}
                        onClick={() => setSelectedUserId(user.id)}
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
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* User Details Drawer (Slide-over) */}
      {selectedUserId && (
        <div
          data-testid="user-details-drawer"
          className="fixed inset-0 bg-gorola-charcoal/40 backdrop-blur-sm z-50 flex justify-end animate-in fade-in duration-200"
          onClick={() => setSelectedUserId(null)}
        >
          <div
            className="bg-white h-full w-full max-w-lg shadow-2xl p-6 md:p-8 space-y-6 overflow-y-auto animate-in slide-in-from-right duration-300"
            onClick={(e) => e.stopPropagation()}
          >
            {isDetailLoading ? (
              <div className="h-full flex flex-col items-center justify-center space-y-4">
                <RefreshCw className="h-8 w-8 text-gorola-pine animate-spin" />
                <span className="text-sm text-gorola-slate">Retrieving detailed records...</span>
              </div>
            ) : (
              userDetail && (
                <>
                  {/* Drawer Header */}
                  <div className="flex justify-between items-start gap-4">
                    <div>
                      <span
                        className={`inline-flex px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider border mb-3 ${
                          userDetail.isActive
                            ? "bg-emerald-100 text-emerald-800 border-emerald-200/50"
                            : "bg-rose-100 text-rose-800 border-rose-200/50"
                        }`}
                      >
                        {userDetail.isActive ? "Active" : "Suspended"}
                      </span>
                      <h2 className="text-2xl font-bold text-gorola-charcoal">{userDetail.name}</h2>
                      <p className="text-xs text-gorola-slate mt-1 font-medium">
                        Joined on: {new Date(userDetail.createdAt).toLocaleString("en-IN")}
                      </p>
                    </div>
                    <button
                      onClick={() => setSelectedUserId(null)}
                      className="h-8 w-8 rounded-full border border-gorola-charcoal/10 hover:border-gorola-pine/20 flex items-center justify-center font-bold text-gorola-slate transition-all"
                      aria-label="Close details"
                    >
                      ✕
                    </button>
                  </div>

                  {/* Profile info cards */}
                  <div className="bg-gorola-mint/5 border border-gorola-mint/15 rounded-2xl p-4 space-y-3">
                    <div className="flex items-center gap-3">
                      <Phone className="h-4 w-4 text-gorola-slate" />
                      <div>
                        <p className="text-[10px] text-gorola-slate font-bold uppercase tracking-wide">Contact Number</p>
                        <p className="text-xs font-black text-gorola-charcoal">{userDetail.maskedPhone}</p>
                      </div>
                    </div>
                  </div>

                  {/* Addresses */}
                  <div className="space-y-3">
                    <h3 className="text-xs font-black uppercase tracking-wider text-gorola-slate">Registered Addresses</h3>
                    {userDetail.addresses.length === 0 ? (
                      <p className="text-xs text-gorola-slate italic">No registered addresses found.</p>
                    ) : (
                      <div className="space-y-2">
                        {userDetail.addresses.map((address) => (
                          <div
                            key={address.id}
                            className="flex items-start gap-3 bg-gorola-charcoal/[0.01] border border-gorola-charcoal/5 rounded-xl p-3.5"
                          >
                            <MapPin className="h-4 w-4 text-gorola-pine shrink-0 mt-0.5" />
                            <div className="text-xs font-medium text-gorola-charcoal leading-relaxed">
                              {address.flatRoom ? `${address.flatRoom}, ` : ""}
                              {address.landmarkDescription}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Order History */}
                  <div className="space-y-3">
                    <h3 className="text-xs font-black uppercase tracking-wider text-gorola-slate">Order History</h3>
                    {userDetail.orders.length === 0 ? (
                      <p className="text-xs text-gorola-slate italic">No order history found for this buyer.</p>
                    ) : (
                      <div className="border border-gorola-charcoal/10 rounded-xl overflow-hidden bg-white">
                        <table className="w-full text-left border-collapse">
                          <thead>
                            <tr className="border-b border-gorola-charcoal/5 bg-gorola-charcoal/[0.01]">
                              <th className="px-4 py-2.5 text-[9px] font-black uppercase tracking-wider text-gorola-slate">Order ID</th>
                              <th className="px-4 py-2.5 text-[9px] font-black uppercase tracking-wider text-gorola-slate">Store</th>
                              <th className="px-4 py-2.5 text-[9px] font-black uppercase tracking-wider text-gorola-slate">Total</th>
                              <th className="px-4 py-2.5 text-[9px] font-black uppercase tracking-wider text-gorola-slate">Status</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gorola-charcoal/5 text-xs">
                            {userDetail.orders.map((order) => (
                              <tr key={order.id} className="hover:bg-gorola-charcoal/[0.005]">
                                <td className="px-4 py-3 font-mono font-bold text-gorola-charcoal">
                                  #{order.id.slice(0, 8).toUpperCase()}
                                </td>
                                <td className="px-4 py-3 font-bold text-gorola-charcoal">{order.storeName}</td>
                                <td className="px-4 py-3 font-bold text-gorola-charcoal">{formatCurrency(order.total)}</td>
                                <td className="px-4 py-3">
                                  <span className="font-bold text-[10px] uppercase text-gorola-pine">
                                    {order.status}
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </>
              )
            )}
          </div>
        </div>
      )}

      {/* Confirmation Dialog Modal */}
      {confirmStatusChangeUserId && confirmUser && (
        <div
          className="fixed inset-0 bg-gorola-charcoal/40 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200"
          onClick={() => setConfirmStatusChangeUserId(null)}
        >
          <div
            className="bg-white rounded-3xl w-full max-w-md shadow-2xl p-6 md:p-8 space-y-6 animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start gap-4">
              <div className="h-10 w-10 rounded-full bg-rose-50 border border-rose-100 flex items-center justify-center shrink-0">
                <AlertTriangle className="h-5 w-5 text-rose-600" />
              </div>
              <div className="space-y-1.5">
                <h3 className="text-lg font-bold text-gorola-charcoal">
                  {confirmUser.isActive ? "Suspend User Account" : "Unsuspend User Account"}
                </h3>
                <p className="text-xs text-gorola-slate leading-relaxed">
                  Are you sure you want to {confirmUser.isActive ? "suspend" : "unsuspend"} this user?
                </p>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={() => setConfirmStatusChangeUserId(null)}
                className="px-4 py-2 border border-gorola-charcoal/10 hover:bg-gorola-charcoal/5 rounded-xl text-xs font-bold text-gorola-slate transition-all"
              >
                Cancel
              </button>
              <button
                data-testid="confirm-status-change"
                onClick={handleToggleStatusConfirm}
                disabled={toggleStatusMutation.isPending}
                className={`px-4 py-2 rounded-xl text-xs font-bold text-white transition-all flex items-center gap-1.5 ${
                  confirmUser.isActive
                    ? "bg-rose-600 hover:bg-rose-700 active:bg-rose-800"
                    : "bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800"
                }`}
              >
                {toggleStatusMutation.isPending && (
                  <RefreshCw className="h-3 w-3 animate-spin" />
                )}
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
