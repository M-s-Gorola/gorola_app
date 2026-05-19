import type { ReactElement } from "react";

export function AdminLoginPage(): ReactElement {
  return (
    <div className="mx-auto flex min-h-[60vh] max-w-md flex-col justify-center gap-6 px-4 py-10">
      <div className="flex flex-col gap-2 text-center">
        <h1 className="font-heading text-3xl tracking-tight text-gorola-charcoal">System Admin Sign In</h1>
        <p className="text-muted-foreground text-sm">Sign in to manage the GoRola platform</p>
      </div>
      <div className="rounded-2xl border border-gorola-pine/10 bg-white p-6 shadow-sm">
        <p className="font-dm-sans text-sm text-gorola-slate text-center">
          Admin portal login controls are under construction.
        </p>
      </div>
    </div>
  );
}
