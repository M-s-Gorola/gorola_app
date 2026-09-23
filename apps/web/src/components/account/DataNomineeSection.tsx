import { Loader2, ShieldAlert, UserCheck } from "lucide-react";
import type { FormEvent, ReactElement } from "react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { api } from "@/lib/api";

type NomineeData = {
  nomineeName: string | null;
  nomineeContact: string | null;
  nomineeRelationship: string | null;
};

export function DataNomineeSection(): ReactElement {
  const [name, setName] = useState("");
  const [contact, setContact] = useState("");
  const [relationship, setRelationship] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [hasExisting, setHasExisting] = useState(false);

  useEffect(() => {
    let isMounted = true;
    async function loadNominee(): Promise<void> {
      setLoading(true);
      try {
        if (!api) return;
        const res = await api.get<{
          success: boolean;
          data: NomineeData;
        }>("/api/v1/user/nominee");

        if (isMounted && res.data?.success && res.data.data) {
          const d = res.data.data;
          setName(d.nomineeName ?? "");
          setContact(d.nomineeContact ?? "");
          setRelationship(d.nomineeRelationship ?? "");
          setHasExisting(Boolean(d.nomineeName || d.nomineeContact || d.nomineeRelationship));
        }
      } catch {
        /* ignore prefetch error */
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    void loadNominee();
    return () => {
      isMounted = false;
    };
  }, []);

  const handleSubmit = async (e: FormEvent): Promise<void> => {
    e.preventDefault();
    setSaving(true);
    try {
      if (!api) throw new Error("API client not available");

      const res = await api.put<{
        success: boolean;
        data: NomineeData;
      }>("/api/v1/user/nominee", {
        nomineeName: name.trim() || null,
        nomineeContact: contact.trim() || null,
        nomineeRelationship: relationship.trim() || null
      });

      if (!res.data?.success) {
        throw new Error("Failed to save nominee details");
      }

      setHasExisting(Boolean(name.trim() || contact.trim() || relationship.trim()));
      toast.success("Nominee details updated successfully");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to update nominee";
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  const handleClear = async (): Promise<void> => {
    setSaving(true);
    try {
      if (!api) throw new Error("API client not available");

      await api.put("/api/v1/user/nominee", {
        nomineeName: null,
        nomineeContact: null,
        nomineeRelationship: null
      });

      setName("");
      setContact("");
      setRelationship("");
      setHasExisting(false);
      toast.success("Nominee details removed");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to clear nominee";
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card
      data-testid="data-nominee-card"
      className="border-gorola-pine/15 bg-white shadow-sm overflow-hidden"
    >
      <CardContent className="p-5 sm:p-6 space-y-4">
        <div className="flex items-start gap-3.5">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gorola-pine/10 text-gorola-pine">
            <UserCheck className="h-5 w-5" />
          </span>
          <div className="space-y-1 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-heading text-base font-semibold text-gorola-charcoal">
                Data Nominee
              </h3>
              <span className="inline-flex items-center rounded-full bg-gorola-sand/60 px-2 py-0.5 text-[10px] font-semibold text-gorola-pine">
                DPDP Act Sec 14
              </span>
            </div>
            <p className="text-xs text-gorola-slate leading-relaxed">
              Designate a trusted individual who may exercise your statutory data rights (such as data access or account erasure) in the event of death or incapacity.
            </p>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-6 text-gorola-slate text-xs gap-2">
            <Loader2 className="h-4 w-4 animate-spin text-gorola-pine" />
            Loading nominee details...
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-3 pt-2">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="space-y-1 text-left">
                <label htmlFor="nominee-name" className="text-xs font-medium text-gorola-charcoal block">
                  Full Name
                </label>
                <Input
                  id="nominee-name"
                  data-testid="nominee-name-input"
                  type="text"
                  placeholder="e.g. Aarav Sharma"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="h-9 text-xs rounded-xl border-gorola-pine/20 focus-visible:ring-gorola-pine"
                />
              </div>

              <div className="space-y-1 text-left">
                <label htmlFor="nominee-contact" className="text-xs font-medium text-gorola-charcoal block">
                  Contact (Phone / Email)
                </label>
                <Input
                  id="nominee-contact"
                  data-testid="nominee-contact-input"
                  type="text"
                  placeholder="e.g. +91 98765 43210"
                  value={contact}
                  onChange={(e) => setContact(e.target.value)}
                  className="h-9 text-xs rounded-xl border-gorola-pine/20 focus-visible:ring-gorola-pine"
                />
              </div>

              <div className="space-y-1 text-left">
                <label htmlFor="nominee-relationship" className="text-xs font-medium text-gorola-charcoal block">
                  Relationship
                </label>
                <Input
                  id="nominee-relationship"
                  data-testid="nominee-relationship-input"
                  type="text"
                  placeholder="e.g. Spouse / Sibling"
                  value={relationship}
                  onChange={(e) => setRelationship(e.target.value)}
                  className="h-9 text-xs rounded-xl border-gorola-pine/20 focus-visible:ring-gorola-pine"
                />
              </div>
            </div>

            <div className="flex items-center gap-2 pt-1">
              <Button
                type="submit"
                data-testid="save-nominee-btn"
                disabled={saving}
                className="rounded-xl bg-gorola-pine hover:bg-gorola-pine/90 text-white text-xs font-semibold px-4 py-2 flex items-center gap-1.5 transition-all shadow-sm active:scale-95"
              >
                {saving ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    Saving...
                  </>
                ) : (
                  "Save Nominee"
                )}
              </Button>

              {hasExisting && (
                <Button
                  type="button"
                  data-testid="clear-nominee-btn"
                  onClick={handleClear}
                  disabled={saving}
                  variant="outline"
                  className="rounded-xl border-gorola-clay/30 text-gorola-clay hover:bg-gorola-clay/10 text-xs font-semibold px-3 py-2 transition-all"
                >
                  <ShieldAlert className="h-3.5 w-3.5 mr-1" />
                  Remove Nominee
                </Button>
              )}
            </div>
          </form>
        )}
      </CardContent>
    </Card>
  );
}
