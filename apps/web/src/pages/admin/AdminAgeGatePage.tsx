import type { AgeGateLockoutList, AgeGateLookupResult } from "@gorola/shared";
import { useQuery } from "@tanstack/react-query";
import { AlertCircle, ChevronDown, ChevronLeft, ChevronRight, ChevronUp, Search, ShieldAlert, Users } from "lucide-react";
import type { FormEvent } from "react";
import { useState } from "react";
import { toast } from "sonner";

import {
  DeclineModal,
  EraseUnderageModal,
  SuspendModal,
  UnlockModal
} from "@/components/admin/AgeGateActionModals";
import {
  AgeGateAccountCard,
  AgeGateLockoutCard
} from "@/components/admin/AgeGateLookupCards";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { api } from "@/lib/api";

export function AdminAgeGatePage() {
  const [phoneInput, setPhoneInput] = useState("");
  const [searchedPhone, setSearchedPhone] = useState("");
  const [validationError, setValidationError] = useState("");
  const [isLedgerOpen, setIsLedgerOpen] = useState(false);
  const [page, setPage] = useState(1);
  const limit = 20;

  // Modals state
  const [unlockModalOpen, setUnlockModalOpen] = useState(false);
  const [declineModalOpen, setDeclineModalOpen] = useState(false);
  const [suspendModalOpen, setSuspendModalOpen] = useState(false);
  const [eraseModalOpen, setEraseModalOpen] = useState(false);

  // Fetch lockouts list & summary
  const {
    data: lockoutsData,
    isLoading: isLockoutsLoading,
    refetch: refetchLockouts
  } = useQuery({
    queryKey: ["admin", "age-gate", "lockouts", page],
    queryFn: async () => {
      if (!api) throw new Error("API not available");
      const res = await api.get<{ success: boolean; data: AgeGateLockoutList }>(
        `/api/v1/admin/age-gate/lockouts?page=${page}&limit=${limit}`
      );
      return res.data.data;
    }
  });

  // Fetch lookup result
  const {
    data: lookupResult,
    isLoading: isLookupLoading,
    refetch: refetchLookup
  } = useQuery({
    queryKey: ["admin", "age-gate", "lookup", searchedPhone],
    queryFn: async () => {
      if (!searchedPhone || !api) return null;
      const res = await api.post<{ success: boolean; data: AgeGateLookupResult }>(
        "/api/v1/admin/age-gate/lookup",
        { phone: searchedPhone }
      );
      return res.data.data;
    },
    enabled: !!searchedPhone
  });

  const normalizePhone = (raw: string): string | null => {
    const cleaned = raw.trim().replace(/\D/g, "");
    if (cleaned.length === 10 && /^[6-9]/.test(cleaned)) {
      return `+91${cleaned}`;
    }
    if (cleaned.length === 12 && cleaned.startsWith("91") && /^91[6-9]/.test(cleaned)) {
      return `+${cleaned}`;
    }
    return null;
  };

  const handleSearch = (e?: FormEvent) => {
    if (e) e.preventDefault();
    setValidationError("");
    const normalized = normalizePhone(phoneInput);
    if (!normalized) {
      setValidationError("Enter a valid 10-digit Indian mobile number");
      return;
    }
    setSearchedPhone(normalized);
  };

  const handleActionComplete = () => {
    void refetchLookup();
    void refetchLockouts();
  };

  const handleUnsuspend = async (userId: string) => {
    if (!api) return;
    try {
      await api.put(`/api/v1/admin/users/${userId}/unsuspend`);
      toast.success("User account unsuspended");
      handleActionComplete();
    } catch {
      toast.error("Failed to unsuspend user account");
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-gray-900 flex items-center gap-2">
          <ShieldAlert className="w-7 h-7 text-indigo-600" />
          Age Gate Case Pipeline
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          Review age refusals, evaluate customer appeals, manage underage account erasure, and monitor 18+ compliance under DPDP Act 2023.
        </p>
      </div>

      {/* Summary Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <Card className="border-l-4 border-l-red-500">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-semibold text-gray-500 uppercase tracking-wider flex items-center justify-between">
              Active Lockouts
              <ShieldAlert className="w-4 h-4 text-red-500" />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-gray-900">
              {lockoutsData?.summary?.activeCount ?? "—"}
            </div>
            <p className="text-xs text-gray-500 mt-1">Under 90-day refusal cooldown</p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-amber-500">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-semibold text-gray-500 uppercase tracking-wider flex items-center justify-between">
              Created in Last 7 Days
              <Users className="w-4 h-4 text-amber-500" />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-gray-900">
              {lockoutsData?.summary?.createdLast7Days ?? "—"}
            </div>
            <p className="text-xs text-gray-500 mt-1">New refusals recorded this week</p>
          </CardContent>
        </Card>
      </div>

      {/* Lookup Bar */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <Search className="w-4 h-4 text-gray-600" />
            Case Lookup by Phone Number
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSearch} className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400 font-medium text-sm">
                +91
              </div>
              <Input
                type="text"
                value={phoneInput}
                onChange={(e) => setPhoneInput(e.target.value)}
                placeholder="Enter 10-digit mobile number"
                className="pl-12"
              />
            </div>
            <Button type="submit" onClick={handleSearch} disabled={isLookupLoading}>
              <Search className="w-4 h-4 mr-2" />
              {isLookupLoading ? "Searching..." : "Look Up"}
            </Button>
          </form>
          {validationError && (
            <p className="text-xs text-red-600 font-medium mt-2 flex items-center gap-1">
              <AlertCircle className="w-3.5 h-3.5" />
              {validationError}
            </p>
          )}
        </CardContent>
      </Card>

      {/* Lookup Results */}
      {searchedPhone && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-gray-800">
            Lookup Results for <span className="font-mono text-sm bg-gray-100 px-2 py-0.5 rounded">{searchedPhone}</span>
          </h2>
          {isLookupLoading ? (
            <div className="p-8 text-center text-gray-500">Searching records...</div>
          ) : lookupResult && (lookupResult.lockout || lookupResult.account) ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {lookupResult.lockout && (
                <AgeGateLockoutCard
                  lockout={lookupResult.lockout}
                  onUnlock={() => setUnlockModalOpen(true)}
                  onDecline={() => setDeclineModalOpen(true)}
                />
              )}
              {lookupResult.account && (
                <AgeGateAccountCard
                  account={lookupResult.account}
                  onSuspend={() => setSuspendModalOpen(true)}
                  onUnsuspend={() => handleUnsuspend(lookupResult.account!.id)}
                  onEraseUnderage={() => setEraseModalOpen(true)}
                />
              )}
            </div>
          ) : (
            <Card className="p-6 text-center text-gray-500">
              No lockout record or buyer account found for this phone number.
            </Card>
          )}
        </div>
      )}

      {/* Collapsible Recent Refusals & Active Lockouts Accordion */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <div>
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-red-600" />
              Recent Refusals & Active Lockouts
            </CardTitle>
            <p className="text-xs text-gray-500 mt-1">
              Anonymous 90-day refusal cooldown records ledger
            </p>
          </div>
          <div className="flex items-center gap-2">
            {isLedgerOpen && (
              <Button variant="ghost" size="sm" onClick={() => void refetchLockouts()}>
                Refresh
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsLedgerOpen(!isLedgerOpen)}
              data-testid="toggle-lockouts-ledger"
            >
              {isLedgerOpen ? (
                <>
                  <ChevronUp className="w-4 h-4 mr-1" />
                  Hide Ledger
                </>
              ) : (
                <>
                  <ChevronDown className="w-4 h-4 mr-1" />
                  Show Ledger ({lockoutsData?.total ?? 0})
                </>
              )}
            </Button>
          </div>
        </CardHeader>
        {isLedgerOpen && (
          <CardContent className="pt-0 space-y-4">
            <p className="text-xs text-gray-500">
              All entries represent anonymous blind-hashed lockout cooldowns under DPDP Act 2023. To investigate, unlock, or act on a user case, look up their plain mobile number above.
            </p>
            <div className="border rounded-md overflow-hidden bg-white">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200 text-xs font-semibold text-gray-600 uppercase">
                    <th className="p-3">Refusal Date</th>
                    <th className="p-3">Locked Until</th>
                    <th className="p-3">Strike Count</th>
                    <th className="p-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 text-sm">
                  {isLockoutsLoading ? (
                    <tr>
                      <td colSpan={4} className="text-center py-6 text-gray-500">
                        Loading lockout records...
                      </td>
                    </tr>
                  ) : !lockoutsData?.items?.length ? (
                    <tr>
                      <td colSpan={4} className="text-center py-6 text-gray-500">
                        No lockout records found.
                      </td>
                    </tr>
                  ) : (
                    lockoutsData.items.map((item) => (
                      <tr key={item.id} className="hover:bg-gray-50/50">
                        <td className="p-3 text-sm">
                          {new Date(item.createdAt).toLocaleString("en-IN")}
                        </td>
                        <td className="p-3 text-sm">
                          {new Date(item.lockedUntil).toLocaleDateString("en-IN")}
                        </td>
                        <td className="p-3 text-sm font-semibold">
                          {item.strikeCount}
                        </td>
                        <td className="p-3">
                          <Badge variant={item.isActive ? "destructive" : "secondary"}>
                            {item.isActive ? "Active Lockout" : "Expired"}
                          </Badge>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {lockoutsData && lockoutsData.totalPages > 1 && (
              <div className="flex items-center justify-between pt-2">
                <span className="text-xs text-gray-500">
                  Page {lockoutsData.page} of {lockoutsData.totalPages} ({lockoutsData.total} total)
                </span>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page <= 1}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                  >
                    <ChevronLeft className="w-4 h-4 mr-1" />
                    Previous
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page >= lockoutsData.totalPages}
                    onClick={() => setPage((p) => p + 1)}
                  >
                    Next
                    <ChevronRight className="w-4 h-4 ml-1" />
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        )}
      </Card>

      {/* Action Modals */}
      {searchedPhone && (
        <>
          <UnlockModal
            isOpen={unlockModalOpen}
            phone={searchedPhone}
            onClose={() => setUnlockModalOpen(false)}
            onSuccess={handleActionComplete}
          />
          <DeclineModal
            isOpen={declineModalOpen}
            phone={searchedPhone}
            onClose={() => setDeclineModalOpen(false)}
            onSuccess={handleActionComplete}
          />
        </>
      )}

      {lookupResult?.account && (
        <>
          <SuspendModal
            isOpen={suspendModalOpen}
            userId={lookupResult.account.id}
            userName={lookupResult.account.name}
            onClose={() => setSuspendModalOpen(false)}
            onSuccess={handleActionComplete}
          />
          <EraseUnderageModal
            isOpen={eraseModalOpen}
            userId={lookupResult.account.id}
            userName={lookupResult.account.name}
            onClose={() => setEraseModalOpen(false)}
            onSuccess={handleActionComplete}
          />
        </>
      )}
    </div>
  );
}
