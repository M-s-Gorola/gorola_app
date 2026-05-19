import { zodResolver } from "@hookform/resolvers/zod";
import type { AxiosError } from "axios";
import type { ReactElement } from "react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { useLocation, useNavigate } from "react-router-dom";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { api } from "@/lib/api";
import { useAuthStore } from "@/store/auth.store";

const totpSchema = z.object({
  code: z
    .string()
    .length(6, "Code must be 6 digits")
    .regex(/^\d{6}$/, "Code must be 6 digits")
});

type TotpFormValues = z.infer<typeof totpSchema>;

type VerifyEnvelope = {
  success?: boolean;
  data?: {
    accessToken: string;
    refreshToken: string;
    userId: string;
    storeId: string;
  };
};

export function StoreTwoFactorPage(): ReactElement {
  const navigate = useNavigate();
  const location = useLocation();
  const setStoreOwnerSession = useAuthStore((s) => s.setStoreOwnerSession);

  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const email = (location.state as { email?: string; password?: string } | null)?.email;
  const password = (location.state as { email?: string; password?: string } | null)?.password;

  const {
    register,
    handleSubmit,
    formState: { errors }
  } = useForm<TotpFormValues>({
    defaultValues: { code: "" },
    resolver: zodResolver(totpSchema),
    mode: "onSubmit"
  });

  const onSubmit = handleSubmit(async (vals) => {
    setErrorMessage(null);
    if (!email || !password) {
      setErrorMessage("No credentials provided. Please go back to login.");
      return;
    }
    if (!api) {
      setErrorMessage("API not configured.");
      return;
    }

    setLoading(true);
    try {
      const res = await api.post<VerifyEnvelope>("/api/v1/auth/store-owner/login", {
        email,
        password,
        totpCode: vals.code
      });

      const body = res.data;
      const data = body.success === true && body.data !== undefined ? body.data : undefined;
      
      if (
        data === undefined ||
        typeof data.accessToken !== "string" ||
        typeof data.refreshToken !== "string" ||
        typeof data.userId !== "string" ||
        typeof data.storeId !== "string"
      ) {
        setErrorMessage("Unexpected response from server.");
        return;
      }

      setStoreOwnerSession({
        accessToken: data.accessToken,
        refreshToken: data.refreshToken,
        userId: data.userId,
        storeId: data.storeId
      });

      navigate("/store/dashboard", { replace: true });
    } catch (err) {
      const ax = err as AxiosError<{
        error?: { message?: string; code?: string };
      }>;
      const msg = ax.response?.data?.error?.message ?? "Invalid TOTP code";
      setErrorMessage(msg);
    } finally {
      setLoading(false);
    }
  });

  return (
    <div className="mx-auto flex min-h-[60vh] max-w-md flex-col justify-center gap-6 px-4 py-10">
      <div className="flex flex-col gap-2 text-center">
        <h1 className="font-heading text-3xl tracking-tight text-gorola-charcoal">Two-Factor Authentication</h1>
        <p className="text-muted-foreground text-sm">
          Please enter the 6-digit code from your authenticator app for <span className="text-gorola-charcoal font-medium">{email ?? "your account"}</span>
        </p>
      </div>

      <form className="flex flex-col gap-4" onSubmit={onSubmit}>
        <div className="flex flex-col gap-2">
          <label className="text-sm font-medium leading-none" htmlFor="totp-input">
            Two-Factor Code
          </label>
          <Input
            id="totp-input"
            type="text"
            placeholder="000000"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            {...register("code")}
            aria-invalid={errors.code ? "true" : undefined}
          />
          {errors.code && (
            <p className="text-destructive text-xs" role="alert">
              {errors.code.message}
            </p>
          )}
        </div>

        {errorMessage && (
          <p className="text-destructive text-sm font-medium text-center" role="alert">
            {errorMessage}
          </p>
        )}

        <Button className="w-full rounded-full" disabled={loading} type="submit">
          {loading ? "Verifying..." : "Verify"}
        </Button>
      </form>
    </div>
  );
}
