import { zodResolver } from "@hookform/resolvers/zod";
import type { AxiosError } from "axios";
import type { ReactElement } from "react";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { useLocation, useNavigate } from "react-router-dom";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { api } from "@/lib/api";
import { getScopedPath, resolveSubdomain } from "@/lib/subdomain-resolver";

const confirmSchema = z.object({
  code: z
    .string()
    .length(6, "Code must be 6 digits")
    .regex(/^\d{6}$/, "Code must be 6 digits")
});

type ConfirmFormValues = z.infer<typeof confirmSchema>;

type SetupResponse = {
  success?: boolean;
  data?: {
    secret: string;
    qrCodeUri: string;
  };
};

type VerifyResponse = {
  success?: boolean;
  data?: {
    verified: boolean;
  };
};

export function AdminSetup2FAPage(): ReactElement {
  const navigate = useNavigate();
  const location = useLocation();

  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [setupData, setSetupData] = useState<{ secret: string; qrCodeUri: string } | null>(null);

  const email = (location.state as { email?: string } | null)?.email;

  const {
    register,
    handleSubmit,
    formState: { errors }
  } = useForm<ConfirmFormValues>({
    defaultValues: { code: "" },
    resolver: zodResolver(confirmSchema),
    mode: "onSubmit"
  });

  const { isSubdomainMode } = resolveSubdomain(window.location.hostname);

  useEffect(() => {
    if (!email) {
      setErrorMessage("No email provided. Please go back to login.");
      return;
    }
    const httpClient = api;
    if (!httpClient) {
      setErrorMessage("API not configured.");
      return;
    }

    const initSetup = async () => {
      setLoading(true);
      try {
        const res = await httpClient.post<SetupResponse>("/api/v1/auth/admin/setup-2fa", {
          email
        });
        const body = res.data;
        if (body.success === true && body.data !== undefined) {
          setSetupData(body.data);
        } else {
          setErrorMessage("Failed to initialize 2FA setup.");
        }
      } catch (err) {
        const ax = err as AxiosError<{
          error?: { message?: string; code?: string };
        }>;
        setErrorMessage(ax.response?.data?.error?.message ?? "Failed to initialize 2FA setup.");
      } finally {
        setLoading(false);
      }
    };

    initSetup();
  }, [email]);

  const onSubmit = handleSubmit(async (vals) => {
    setErrorMessage(null);
    if (!email) {
      setErrorMessage("No email provided. Please go back to login.");
      return;
    }
    const httpClient = api;
    if (!httpClient) {
      setErrorMessage("API not configured.");
      return;
    }

    setLoading(true);
    try {
      const res = await httpClient.post<VerifyResponse>("/api/v1/auth/admin/verify-2fa", {
        email,
        code: vals.code
      });

      const body = res.data;
      if (body.success === true) {
        // Redirection to admin login after successful 2FA registration
        navigate(getScopedPath("/admin/login", "admin", isSubdomainMode), { replace: true });
      } else {
        setErrorMessage("Verification failed.");
      }
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
        <h1 className="font-heading text-3xl tracking-tight text-gorola-charcoal">Setup Two-Factor Authentication</h1>
        <p className="text-muted-foreground text-sm">
          Scan the QR code below using Google Authenticator, Authy or any standard TOTP app.
        </p>
      </div>

      {loading && !setupData && (
        <p className="text-center text-sm text-muted-foreground">Initializing 2FA...</p>
      )}

      {setupData && (
        <div className="flex flex-col gap-6 items-center">
          <div className="bg-white p-4 rounded-xl shadow-sm border border-gorola-mint/35">
            <img
              className="w-48 h-48"
              src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(setupData.qrCodeUri)}`}
              alt="QR Code"
            />
          </div>

          <div className="w-full text-center">
            <p className="text-xs text-muted-foreground mb-1">Or enter this key manually:</p>
            <code className="bg-gorola-mint/10 px-3 py-1 rounded text-gorola-charcoal font-mono text-sm tracking-widest font-bold">
              {setupData.secret}
            </code>
          </div>

          <form className="flex flex-col gap-4 w-full" onSubmit={onSubmit}>
            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium leading-none" htmlFor="setup-totp-code">
                Confirmation Code
              </label>
              <Input
                id="setup-totp-code"
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
              {loading ? "Verifying..." : "Verify and Enable"}
            </Button>
          </form>
        </div>
      )}

      {errorMessage && !setupData && (
        <div className="flex flex-col gap-4 items-center">
          <p className="text-destructive text-sm font-medium text-center text-balance" role="alert">
            {errorMessage}
          </p>
          <Button className="rounded-full" onClick={() => navigate(getScopedPath("/admin/login", "admin", isSubdomainMode))}>
            Back to Login
          </Button>
        </div>
      )}
    </div>
  );
}
