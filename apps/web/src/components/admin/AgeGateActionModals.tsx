import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { api } from "@/lib/api";

interface UnlockModalProps {
  isOpen: boolean;
  phone: string;
  onClose: () => void;
  onSuccess: () => void;
}

export function UnlockModal({ isOpen, phone, onClose, onSuccess }: UnlockModalProps) {
  const [reason, setReason] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const isValid = reason.trim().length >= 10;

  const handleUnlock = async () => {
    if (!isValid || !api) return;
    setIsLoading(true);
    try {
      await api.post("/api/v1/admin/age-gate/unlock", {
        phone,
        reason: reason.trim()
      });
      toast.success("Age-gate lockout cleared successfully");
      setReason("");
      onSuccess();
      onClose();
    } catch {
      toast.error("Failed to unlock age-gate lockout");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Unlock Age-Gate Lockout</DialogTitle>
          <DialogDescription>
            Clear the 90-day refusal lockout for phone {phone}. The user will be able to retry age declaration.
          </DialogDescription>
        </DialogHeader>
        <div className="py-2 space-y-2">
          <label className="text-xs font-semibold text-gray-700">
            Mandatory Reason (min 10 characters)
          </label>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Enter reason for unlocking (e.g. verified government ID showing 18+ eligibility)"
            rows={3}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
          <p className="text-xs text-gray-500">{reason.trim().length} / 10 characters minimum</p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isLoading}>
            Cancel
          </Button>
          <Button onClick={handleUnlock} disabled={!isValid || isLoading}>
            {isLoading ? "Unlocking..." : "Confirm Unlock"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface DeclineModalProps {
  isOpen: boolean;
  phone: string;
  onClose: () => void;
  onSuccess: () => void;
}

export function DeclineModal({ isOpen, phone, onClose, onSuccess }: DeclineModalProps) {
  const [reason, setReason] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const isValid = reason.trim().length >= 10;

  const handleDecline = async () => {
    if (!isValid || !api) return;
    setIsLoading(true);
    try {
      await api.post("/api/v1/admin/age-gate/decline", {
        phone,
        reason: reason.trim()
      });
      toast.success("Appeal decline recorded");
      setReason("");
      onSuccess();
      onClose();
    } catch {
      toast.error("Failed to record appeal decline");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Decline Age-Gate Appeal</DialogTitle>
          <DialogDescription>
            Maintain the lockout and record the administrative decline in the audit log.
          </DialogDescription>
        </DialogHeader>
        <div className="py-2 space-y-2">
          <label className="text-xs font-semibold text-gray-700">
            Mandatory Decline Reason (min 10 characters)
          </label>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Enter reason for declining appeal"
            rows={3}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
          <p className="text-xs text-gray-500">{reason.trim().length} / 10 characters minimum</p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isLoading}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={handleDecline} disabled={!isValid || isLoading}>
            {isLoading ? "Declining..." : "Confirm Decline"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface SuspendModalProps {
  isOpen: boolean;
  userId: string;
  userName?: string | null;
  onClose: () => void;
  onSuccess: () => void;
}

export function SuspendModal({ isOpen, userId, userName, onClose, onSuccess }: SuspendModalProps) {
  const [reason, setReason] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleSuspend = async () => {
    if (!api) return;
    setIsLoading(true);
    try {
      const payload = reason.trim().length >= 10 ? { reason: reason.trim() } : {};
      await api.put(`/api/v1/admin/users/${userId}/suspend`, payload);
      toast.success("User account suspended");
      setReason("");
      onSuccess();
      onClose();
    } catch {
      toast.error("Failed to suspend user account");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Suspend User Account</DialogTitle>
          <DialogDescription>
            Suspend access for {userName || userId}. Active sessions will be revoked immediately.
          </DialogDescription>
        </DialogHeader>
        <div className="py-2 space-y-2">
          <label className="text-xs font-semibold text-gray-700">
            Suspension Reason (optional)
          </label>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Optional suspension reason for audit trail"
            rows={3}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isLoading}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={handleSuspend} disabled={isLoading}>
            {isLoading ? "Suspending..." : "Suspend Account"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface EraseUnderageModalProps {
  isOpen: boolean;
  userId: string;
  userName?: string | null;
  onClose: () => void;
  onSuccess: () => void;
}

export function EraseUnderageModal({ isOpen, userId, userName, onClose, onSuccess }: EraseUnderageModalProps) {
  const [reason, setReason] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const isValid = reason.trim().length >= 10;

  const handleErase = async () => {
    if (!isValid || !api) return;
    setIsLoading(true);
    try {
      await api.post(`/api/v1/admin/users/${userId}/erase-underage`, {
        reason: reason.trim()
      });
      toast.success("Underage account erased & locked for 90 days");
      setReason("");
      onSuccess();
      onClose();
    } catch {
      toast.error("Failed to erase underage user");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Erase Underage Account (Minor Data Purge + 90-Day Block)</DialogTitle>
          <DialogDescription>
            Permanently purges all personal data (PII, addresses, cart items) for {userName || userId} under DPDP Act 2023 Sec 12, revokes all active sessions, and places a 90-day refusal lockout on this phone number. After 90 days (if not removed from block earlier), any subsequent login attempt with this number will start fresh and create a brand-new account.
          </DialogDescription>
        </DialogHeader>
        <div className="py-2 space-y-2">
          <label className="text-xs font-semibold text-gray-700">
            Mandatory Reason (min 10 characters)
          </label>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Mandatory reason for underage erasure (e.g. user reported underage)"
            rows={3}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
          <p className="text-xs text-gray-500">{reason.trim().length} / 10 characters minimum</p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isLoading}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={handleErase} disabled={!isValid || isLoading}>
            {isLoading ? "Purging Data..." : "Erase & Block 90 Days"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
