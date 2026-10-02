import { AlertTriangle, Loader2, Trash2 } from "lucide-react";
import type { ReactElement } from "react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog";
import { api } from "@/lib/api";
import { useAuthStore } from "@/store/auth.store";

export function DangerZoneSection(): ReactElement {
  const [open, setOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const clearSession = useAuthStore((s) => s.clearSession);
  const navigate = useNavigate();

  const handleConfirmDelete = async (): Promise<void> => {
    setDeleting(true);
    try {
      if (!api) throw new Error("API client not available");

      const res = await api.delete<{
        success: boolean;
        data: {
          isPendingDeletion: boolean;
          deletionScheduledFor: string;
          message: string;
        };
      }>("/api/v1/user/account");

      if (!res.data?.success) {
        throw new Error("Failed to schedule account deletion");
      }

      toast.success("Account scheduled for deletion. You have 30 days to restore it by logging back in.");
      clearSession();
      setOpen(false);
      navigate("/", { replace: true });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to delete account";
      toast.error(msg);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <>
      <Card
        data-testid="danger-zone-card"
        className="border-red-200 bg-red-50/30 shadow-sm overflow-hidden"
      >
        <CardContent className="p-5 sm:p-6 space-y-4">
          <div className="flex items-start gap-3.5">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-red-100 text-red-600">
              <Trash2 className="h-5 w-5" />
            </span>
            <div className="space-y-1 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-heading text-base font-semibold text-red-950">
                  Delete Account
                </h3>
                <span className="inline-flex items-center rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-semibold text-red-700">
                  DPDP Act Sec 12
                </span>
              </div>
              <p className="text-xs text-red-800/80 leading-relaxed">
                Permanently delete your account and personal data. You will have a 30-day grace period to log back in and cancel deletion before your personal data is permanently scrubbed.
              </p>
            </div>
          </div>

          <div className="pt-1 flex justify-start">
            <Button
              type="button"
              data-testid="open-delete-dialog-btn"
              onClick={() => setOpen(true)}
              variant="destructive"
              className="rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-semibold px-4 py-2 flex items-center gap-1.5 transition-all shadow-sm active:scale-95"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Delete My Account
            </Button>
          </div>
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          data-testid="delete-account-dialog"
          className="sm:max-w-md rounded-2xl p-6"
        >
          <DialogHeader className="space-y-2 text-left">
            <div className="flex items-center gap-2 text-red-600">
              <AlertTriangle className="h-5 w-5 shrink-0" />
              <DialogTitle className="text-base font-bold text-gorola-charcoal font-heading">
                Confirm Account Deletion
              </DialogTitle>
            </div>
            <DialogDescription className="text-xs text-gorola-slate leading-relaxed">
              Your account will be deactivated immediately and you will be logged out.
              <br /><br />
              <strong>30-Day Recovery Grace Period:</strong> If you change your mind, simply log in with your phone number within 30 days to cancel deletion and restore all your data. After 30 days, your personal data will be permanently and irreversibly erased under India&apos;s DPDP Act 2023.
            </DialogDescription>
          </DialogHeader>

          <DialogFooter className="flex-col-reverse sm:flex-row gap-2 pt-4">
            <Button
              type="button"
              variant="outline"
              disabled={deleting}
              onClick={() => setOpen(false)}
              className="rounded-xl text-xs"
            >
              Cancel
            </Button>
            <Button
              type="button"
              data-testid="confirm-delete-account-btn"
              disabled={deleting}
              onClick={handleConfirmDelete}
              className="rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-semibold"
            >
              {deleting ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                  Scheduling Deletion...
                </>
              ) : (
                "Confirm & Delete Account"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
