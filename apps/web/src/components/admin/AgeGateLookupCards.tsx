import type { AdminAgeGateAccountDto, AdminAgeGateLockoutDto } from "@gorola/shared";
import { CheckCircle, Clock, ShieldAlert, User } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";

interface AgeGateLockoutCardProps {
  lockout: AdminAgeGateLockoutDto;
  onUnlock: () => void;
  onDecline: () => void;
}

export function AgeGateLockoutCard({ lockout, onUnlock, onDecline }: AgeGateLockoutCardProps) {
  return (
    <Card className="border-amber-200 bg-amber-50/40 shadow-sm">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-base font-semibold flex items-center gap-2 text-amber-900">
          <ShieldAlert className="w-5 h-5 text-amber-600" />
          Lockout Record
        </CardTitle>
        <Badge variant={lockout.isActive ? "destructive" : "secondary"}>
          {lockout.isActive ? "ACTIVE LOCKOUT" : "EXPIRED"}
        </Badge>
      </CardHeader>
      <CardContent className="space-y-2 text-sm text-amber-950">
        <div className="flex justify-between">
          <span className="text-gray-600">Days Remaining:</span>
          <span className="font-semibold">{lockout.daysRemaining} days remaining</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-600">Strike Count:</span>
          <span className="font-semibold">{lockout.strikeCount}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-600">Locked Until:</span>
          <span>{new Date(lockout.lockedUntil).toLocaleDateString("en-IN")}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-600">Refusal Date:</span>
          <span>{new Date(lockout.createdAt).toLocaleString("en-IN")}</span>
        </div>
      </CardContent>
      <CardFooter className="flex gap-2 justify-end pt-2 border-t border-amber-100">
        <Button size="sm" variant="outline" onClick={onDecline}>
          Decline Appeal
        </Button>
        <Button size="sm" onClick={onUnlock}>
          Unlock Lockout
        </Button>
      </CardFooter>
    </Card>
  );
}

interface AgeGateAccountCardProps {
  account: AdminAgeGateAccountDto;
  onSuspend: () => void;
  onUnsuspend: () => void;
  onEraseUnderage: () => void;
}

export function AgeGateAccountCard({
  account,
  onSuspend,
  onUnsuspend,
  onEraseUnderage
}: AgeGateAccountCardProps) {
  const getBadgeVariant = (status: AdminAgeGateAccountDto["status"]) => {
    switch (status) {
      case "ACTIVE":
        return "default";
      case "SUSPENDED":
        return "destructive";
      case "PENDING_DELETION":
        return "secondary";
    }
  };

  return (
    <Card className="border-blue-200 bg-blue-50/30 shadow-sm">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-base font-semibold flex items-center gap-2 text-blue-900">
          <User className="w-5 h-5 text-blue-600" />
          Buyer Account
        </CardTitle>
        <Badge variant={getBadgeVariant(account.status)}>{account.status}</Badge>
      </CardHeader>
      <CardContent className="space-y-2 text-sm text-blue-950">
        <div className="flex justify-between">
          <span className="text-gray-600">Name:</span>
          <span className="font-semibold">{account.name || "N/A"}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-600">Phone:</span>
          <span className="font-mono font-medium">{account.maskedPhone}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-600">Total Orders:</span>
          <span className="font-semibold">{account.ordersCount}</span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-gray-600">Age Confirmed (18+):</span>
          {account.ageConfirmedAt ? (
            <span className="text-emerald-700 font-medium flex items-center gap-1 text-xs">
              <CheckCircle className="w-3.5 h-3.5" />
              {new Date(account.ageConfirmedAt).toLocaleDateString("en-IN")}
            </span>
          ) : (
            <span className="text-amber-700 font-medium flex items-center gap-1 text-xs">
              <Clock className="w-3.5 h-3.5" />
              Not Confirmed
            </span>
          )}
        </div>
        <div className="flex justify-between">
          <span className="text-gray-600">Account Created:</span>
          <span>{new Date(account.createdAt).toLocaleDateString("en-IN")}</span>
        </div>
      </CardContent>
      <CardFooter className="flex gap-2 justify-end pt-2 border-t border-blue-100">
        {account.status === "ACTIVE" ? (
          <Button size="sm" variant="outline" onClick={onSuspend}>
            Suspend User
          </Button>
        ) : account.status === "SUSPENDED" ? (
          <Button size="sm" variant="outline" onClick={onUnsuspend}>
            Unsuspend User
          </Button>
        ) : null}
        <Button
          size="sm"
          variant="destructive"
          onClick={onEraseUnderage}
          title="Minor Data Purge + 90-Day Block. After 90 days, a fresh account can be created."
        >
          Erase Underage (Minor Purge + 90d Block)
        </Button>
      </CardFooter>
    </Card>
  );
}
