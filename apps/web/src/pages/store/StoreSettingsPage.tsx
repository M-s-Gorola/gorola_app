import { zodResolver } from "@hookform/resolvers/zod";
import type { AxiosError } from "axios";
import { Eye, EyeOff } from "lucide-react";
import type { ReactElement } from "react";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { api } from "@/lib/api";

const storeSettingsSchema = z.object({
  name: z.string().trim().min(1, "Store name is required"),
  description: z.string().trim(),
  phone: z.string().trim(),
  address: z.string().trim(),
  weatherModeDeliveryWindowStart: z.string().trim(),
  weatherModeDeliveryWindowEnd: z.string().trim()
});

type StoreSettingsFormValues = z.infer<typeof storeSettingsSchema>;

// 2. Change Password schema
const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, "Current password is required"),
  newPassword: z.string().min(8, "New password must be at least 8 characters"),
  confirmPassword: z.string().min(1, "Confirm password is required")
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: "New passwords do not match",
  path: ["confirmPassword"]
});

type ChangePasswordFormValues = z.infer<typeof changePasswordSchema>;

// 3. 2FA confirmation schema
const confirm2FASchema = z.object({
  code: z
    .string()
    .length(6, "Code must be 6 digits")
    .regex(/^\d{6}$/, "Code must be 6 digits")
});

type Confirm2FAFormValues = z.infer<typeof confirm2FASchema>;

type SettingsApiResponse = {
  success?: boolean;
  data?: {
    name: string;
    description: string;
    phone: string;
    address: string;
    weatherModeDeliveryWindowStart: string;
    weatherModeDeliveryWindowEnd: string;
    email: string;
    totpEnabled: boolean;
    riderEarningRatePct?: number | null;
  };
};

export function StoreSettingsPage(): ReactElement {
  const [loading, setLoading] = useState(true);
  const [submittingSettings, setSubmittingSettings] = useState(false);
  const [submittingPassword, setSubmittingPassword] = useState(false);
  const [submitting2FA, setSubmitting2FA] = useState(false);
  const [settings, setSettings] = useState<NonNullable<SettingsApiResponse["data"]> | null>(null);
  
  // 2FA local states
  const [setup2FAData, setSetup2FAData] = useState<{ secret: string; qrCodeUri: string } | null>(null);
  const [setupError, setSetupError] = useState<string | null>(null);

  // Password visibility states
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Form 1: Settings
  const {
    register: registerSettings,
    handleSubmit: handleSubmitSettings,
    reset: resetSettings,
    formState: { errors: settingsErrors }
  } = useForm<StoreSettingsFormValues>({
    resolver: zodResolver(storeSettingsSchema),
    mode: "onChange"
  });

  // Form 2: Password
  const {
    register: registerPassword,
    handleSubmit: handleSubmitPassword,
    reset: resetPassword,
    formState: { errors: passwordErrors }
  } = useForm<ChangePasswordFormValues>({
    resolver: zodResolver(changePasswordSchema),
    mode: "onSubmit"
  });

  // Form 3: 2FA verify
  const {
    register: register2FA,
    handleSubmit: handleSubmit2FA,
    reset: reset2FA,
    formState: { errors: errors2FA }
  } = useForm<Confirm2FAFormValues>({
    resolver: zodResolver(confirm2FASchema),
    mode: "onSubmit"
  });

  // Fetch settings on mount
  const fetchSettings = async () => {
    setLoading(true);
    try {
      const res = await api!.get<SettingsApiResponse>("/api/v1/store/settings");
      if (res.data.success && res.data.data) {
        setSettings(res.data.data);
        resetSettings({
          name: res.data.data.name,
          description: res.data.data.description,
          phone: res.data.data.phone,
          address: res.data.data.address,
          weatherModeDeliveryWindowStart: res.data.data.weatherModeDeliveryWindowStart,
          weatherModeDeliveryWindowEnd: res.data.data.weatherModeDeliveryWindowEnd
        });
      } else {
        toast.error("Failed to load settings.");
      }
    } catch {
      toast.error("Failed to fetch store settings.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  // Save Settings
  const onSaveSettings = handleSubmitSettings(async (vals) => {
    setSubmittingSettings(true);
    try {
      const res = await api!.put("/api/v1/store/settings", vals);
      if (res.data.success) {
        toast.success("Settings updated successfully!");
        setSettings((prev) => prev ? { ...prev, ...vals } : null);
      } else {
        toast.error("Failed to update settings.");
      }
    } catch (err) {
      const ax = err as AxiosError<{ error?: { message?: string } }>;
      toast.error(ax.response?.data?.error?.message ?? "Failed to save settings.");
    } finally {
      setSubmittingSettings(false);
    }
  });

  // Update Password
  const onUpdatePassword = handleSubmitPassword(async (vals) => {
    setSubmittingPassword(true);
    try {
      const res = await api!.put("/api/v1/auth/store-owner/change-password", {
        currentPassword: vals.currentPassword,
        newPassword: vals.newPassword
      });
      if (res.data.success) {
        toast.success("Password changed successfully!");
        resetPassword({
          currentPassword: "",
          newPassword: "",
          confirmPassword: ""
        });
        setShowCurrentPassword(false);
        setShowNewPassword(false);
        setShowConfirmPassword(false);
      } else {
        toast.error("Failed to update password.");
      }
    } catch (err) {
      const ax = err as AxiosError<{ error?: { message?: string } }>;
      toast.error(ax.response?.data?.error?.message ?? "Invalid current password.");
    } finally {
      setSubmittingPassword(false);
    }
  });

  // Setup 2FA
  const onSetup2FA = async () => {
    if (!settings?.email) return;
    setSetupError(null);
    setSubmitting2FA(true);
    try {
      const res = await api!.post<{ success?: boolean; data?: { secret: string; qrCodeUri: string } }>(
        "/api/v1/auth/store-owner/setup-2fa",
        { email: settings.email }
      );
      if (res.data.success && res.data.data) {
        setSetup2FAData(res.data.data);
      } else {
        setSetupError("Failed to generate 2FA secret key.");
      }
    } catch {
      setSetupError("Failed to initiate 2FA setup.");
    } finally {
      setSubmitting2FA(false);
    }
  };

  // Verify 2FA
  const onVerify2FA = handleSubmit2FA(async (vals) => {
    if (!settings?.email) return;
    setSetupError(null);
    setSubmitting2FA(true);
    try {
      const res = await api!.post<{ success?: boolean; data?: { verified: boolean } }>(
        "/api/v1/auth/store-owner/verify-2fa",
        {
          email: settings.email,
          code: vals.code
        }
      );
      if (res.data.success) {
        toast.success("2FA enabled successfully!");
        setSettings((prev) => prev ? { ...prev, totpEnabled: true } : null);
        setSetup2FAData(null);
        reset2FA({ code: "" });
      } else {
        setSetupError("Verification failed.");
      }
    } catch {
      setSetupError("Invalid TOTP code.");
    } finally {
      setSubmitting2FA(false);
    }
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <p className="text-muted-foreground text-sm">Loading settings...</p>
      </div>
    );
  }

  return (
    <div className="container max-w-4xl py-8 px-4 space-y-8 animate-in fade-in duration-300">
      <div>
        <h1 className="font-heading text-3xl font-bold tracking-tight text-gorola-charcoal">Store Settings</h1>
        <p className="text-muted-foreground text-sm">
          Manage profile configurations, update credentials, and secure your owner panel.
        </p>
      </div>

      <div className="grid gap-8">
        {/* Section 1: Store Info */}
        <section className="bg-white rounded-2xl border border-gorola-mint/30 shadow-sm p-6 space-y-6">
          <div className="border-b border-gorola-mint/20 pb-4">
            <h2 className="text-xl font-semibold text-gorola-charcoal">Store Information</h2>
            <p className="text-xs text-muted-foreground">General details representing your store to customers.</p>
          </div>

          <form className="space-y-4" onSubmit={onSaveSettings}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-semibold text-gorola-charcoal" htmlFor="store-name">
                  Store Name
                </label>
                <Input
                  id="store-name"
                  type="text"
                  placeholder="e.g. Mussoorie Sweets"
                  {...registerSettings("name")}
                  aria-invalid={settingsErrors.name ? "true" : undefined}
                />
                {settingsErrors.name && (
                  <p className="text-destructive text-xs" role="alert">
                    {settingsErrors.name.message}
                  </p>
                )}
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-semibold text-gorola-charcoal" htmlFor="store-phone">
                  Phone Number
                </label>
                <Input
                  id="store-phone"
                  type="text"
                  placeholder="+919876543210"
                  {...registerSettings("phone")}
                />
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-semibold text-gorola-charcoal" htmlFor="store-description">
                Description
              </label>
              <Input
                id="store-description"
                type="text"
                placeholder="Delicious fresh pastries and desserts..."
                {...registerSettings("description")}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-semibold text-gorola-charcoal" htmlFor="store-address">
                Landmark Address
              </label>
              <Input
                id="store-address"
                type="text"
                placeholder="Library Chowk, Mussoorie"
                {...registerSettings("address")}
              />
            </div>

            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200/60 space-y-3">
              <div>
                <h4 className="text-sm font-semibold text-gorola-charcoal">Weather Mode Delivery Window</h4>
                <p className="text-xs text-muted-foreground">
                  Specifies delay extensions applied when inclement weather alerts are active.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4 max-w-sm">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium text-muted-foreground" htmlFor="delivery-start">
                    Start Minutes
                  </label>
                  <Input
                    id="delivery-start"
                    type="text"
                    placeholder="30"
                    {...registerSettings("weatherModeDeliveryWindowStart")}
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium text-muted-foreground" htmlFor="delivery-end">
                    End Minutes
                  </label>
                  <Input
                    id="delivery-end"
                    type="text"
                    placeholder="45"
                    {...registerSettings("weatherModeDeliveryWindowEnd")}
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-end">
              <Button disabled={submittingSettings} type="submit">
                {submittingSettings ? "Saving..." : "Save Changes"}
              </Button>
            </div>
          </form>
        </section>

        {/* Section 2: Password Update */}
        <section className="bg-white rounded-2xl border border-gorola-mint/30 shadow-sm p-6 space-y-6">
          <div className="border-b border-gorola-mint/20 pb-4">
            <h2 className="text-xl font-semibold text-gorola-charcoal">Change Password</h2>
            <p className="text-xs text-muted-foreground">Keep your management credentials updated and secure.</p>
          </div>

          <form className="space-y-4" onSubmit={onUpdatePassword}>
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-semibold text-gorola-charcoal" htmlFor="current-password">
                Current Password
              </label>
              <div className="relative">
                <Input
                  id="current-password"
                  type={showCurrentPassword ? "text" : "password"}
                  placeholder="••••••••"
                  className="pr-10"
                  {...registerPassword("currentPassword")}
                  aria-invalid={passwordErrors.currentPassword ? "true" : undefined}
                />
                <button
                  type="button"
                  onClick={() => setShowCurrentPassword((prev) => !prev)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground focus:outline-none"
                  aria-label={showCurrentPassword ? "Hide" : "Show"}
                >
                  {showCurrentPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {passwordErrors.currentPassword && (
                <p className="text-destructive text-xs" role="alert">
                  {passwordErrors.currentPassword.message}
                </p>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-semibold text-gorola-charcoal" htmlFor="new-password">
                  New Password
                </label>
                <div className="relative">
                  <Input
                    id="new-password"
                    type={showNewPassword ? "text" : "password"}
                    placeholder="••••••••"
                    className="pr-10"
                    {...registerPassword("newPassword")}
                    aria-invalid={passwordErrors.newPassword ? "true" : undefined}
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword((prev) => !prev)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground focus:outline-none"
                    aria-label={showNewPassword ? "Hide" : "Show"}
                  >
                    {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {passwordErrors.newPassword && (
                  <p className="text-destructive text-xs" role="alert">
                    {passwordErrors.newPassword.message}
                  </p>
                )}
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-semibold text-gorola-charcoal" htmlFor="confirm-password">
                  Confirm New Password
                </label>
                <div className="relative">
                  <Input
                    id="confirm-password"
                    type={showConfirmPassword ? "text" : "password"}
                    placeholder="••••••••"
                    className="pr-10"
                    {...registerPassword("confirmPassword")}
                    aria-invalid={passwordErrors.confirmPassword ? "true" : undefined}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword((prev) => !prev)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground focus:outline-none"
                    aria-label={showConfirmPassword ? "Hide" : "Show"}
                  >
                    {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {passwordErrors.confirmPassword && (
                  <p className="text-destructive text-xs" role="alert">
                    {passwordErrors.confirmPassword.message}
                  </p>
                )}
              </div>
            </div>

            <div className="flex justify-end">
              <Button disabled={submittingPassword} type="submit">
                {submittingPassword ? "Updating..." : "Update Password"}
              </Button>
            </div>
          </form>
        </section>

        {/* Section 3: Two-Factor Auth */}
        <section className="bg-white rounded-2xl border border-gorola-mint/30 shadow-sm p-6 space-y-6">
          <div className="border-b border-gorola-mint/20 pb-4">
            <h2 className="text-xl font-semibold text-gorola-charcoal">Two-Factor Authentication</h2>
            <p className="text-xs text-muted-foreground">Add an extra layer of security with TOTP apps.</p>
          </div>

          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200/60">
            <div>
              <p className="text-sm text-gorola-charcoal font-medium">
                Registered Email: <span className="font-semibold">{settings?.email}</span>
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Two-Factor Auth is currently:{" "}
                <span
                  className={`font-semibold px-2 py-0.5 rounded text-xs ${
                    settings?.totpEnabled
                      ? "bg-emerald-100 text-emerald-800"
                      : "bg-amber-100 text-amber-800"
                  }`}
                >
                  {settings?.totpEnabled ? "Enabled" : "Disabled"}
                </span>
              </p>
            </div>

            {!settings?.totpEnabled && !setup2FAData && (
              <Button disabled={submitting2FA} onClick={onSetup2FA}>
                {submitting2FA ? "Configuring..." : "Setup 2FA"}
              </Button>
            )}
          </div>

          {setup2FAData && (
            <div className="flex flex-col gap-6 items-center border border-dashed border-gorola-mint/45 p-6 rounded-2xl animate-in slide-in-from-bottom duration-200">
              <div className="text-center space-y-1">
                <h4 className="text-sm font-semibold text-gorola-charcoal">Scan this QR Code</h4>
                <p className="text-xs text-muted-foreground">
                  Use your authenticator app to scan the code.
                </p>
              </div>

              <div className="bg-white p-3 rounded-xl shadow-sm border border-slate-100">
                <img
                  className="w-40 h-40"
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(setup2FAData.qrCodeUri)}`}
                  alt="QR Code"
                />
              </div>

              <div className="text-center space-y-1">
                <p className="text-xs text-muted-foreground">Secret Key (Manual input)</p>
                <code className="bg-gorola-mint/10 px-3 py-1.5 rounded text-gorola-charcoal font-mono text-sm tracking-wider font-bold">
                  {setup2FAData.secret}
                </code>
              </div>

              <form className="flex flex-col gap-4 w-full max-w-xs" onSubmit={onVerify2FA}>
                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-semibold text-gorola-charcoal" htmlFor="totp-verification-code">
                    Enter 6-digit TOTP Code
                  </label>
                  <Input
                    id="totp-verification-code"
                    type="text"
                    placeholder="000000"
                    maxLength={6}
                    {...register2FA("code")}
                    aria-invalid={errors2FA.code ? "true" : undefined}
                  />
                  {errors2FA.code && (
                    <p className="text-destructive text-xs" role="alert">
                      {errors2FA.code.message}
                    </p>
                  )}
                </div>

                {setupError && (
                  <p className="text-destructive text-xs font-semibold text-center" role="alert">
                    {setupError}
                  </p>
                )}

                <Button className="w-full" disabled={submitting2FA} type="submit">
                  {submitting2FA ? "Enabling..." : "Verify and Enable"}
                </Button>
              </form>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
