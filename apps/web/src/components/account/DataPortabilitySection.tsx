import { Download, FileJson, Loader2 } from "lucide-react";
import type { ReactElement } from "react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { api } from "@/lib/api";

export function DataPortabilitySection(): ReactElement {
  const [downloading, setDownloading] = useState(false);

  const handleDownload = async (): Promise<void> => {
    setDownloading(true);
    try {
      if (!api) {
        throw new Error("API client not available");
      }

      const res = await api.get<{
        success: boolean;
        data: Record<string, unknown>;
      }>("/api/v1/user/my-data");

      if (!res.data?.success || !res.data.data) {
        throw new Error("Failed to export user data");
      }

      const jsonStr = JSON.stringify(res.data.data, null, 2);
      const blob = new Blob([jsonStr], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const dateStr = new Date().toISOString().split("T")[0];

      const a = document.createElement("a");
      a.href = url;
      a.download = `gorola-my-data-${dateStr}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast.success("Data export downloaded successfully");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to download data export";
      toast.error(msg);
    } finally {
      setDownloading(false);
    }
  };

  return (
    <Card
      data-testid="data-portability-card"
      className="border-gorola-pine/15 bg-white shadow-sm overflow-hidden"
    >
      <CardContent className="p-5 sm:p-6 space-y-4">
        <div className="flex items-start gap-3.5">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gorola-pine/10 text-gorola-pine">
            <FileJson className="h-5 w-5" />
          </span>
          <div className="space-y-1 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-heading text-base font-semibold text-gorola-charcoal">
                Download My Data
              </h3>
              <span className="inline-flex items-center rounded-full bg-gorola-sand/60 px-2 py-0.5 text-[10px] font-semibold text-gorola-pine">
                DPDP Act Sec 11
              </span>
            </div>
            <p className="text-xs text-gorola-slate leading-relaxed">
              Download a complete machine-readable JSON archive of your personal data held by GoRola, including your profile, saved addresses, order history, and statutory consent audit trail.
            </p>
          </div>
        </div>

        <div className="pt-1 flex justify-start">
          <Button
            type="button"
            data-testid="download-my-data-btn"
            onClick={handleDownload}
            disabled={downloading}
            className="rounded-xl bg-gorola-pine hover:bg-gorola-pine/90 text-white text-xs font-semibold px-4 py-2 flex items-center gap-2 transition-all shadow-sm active:scale-95"
          >
            {downloading ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Generating Export...
              </>
            ) : (
              <>
                <Download className="h-3.5 w-3.5" />
                Download Data Archive (JSON)
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
