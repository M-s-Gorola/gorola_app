import type { ReactElement, ReactNode } from "react";

import { BuyerFooter } from "@/components/buyer/BuyerFooter";
import { BuyerNav } from "@/components/buyer/BuyerNav";

type BuyerLayoutProps = {
  children: ReactNode;
};

export function BuyerLayout({ children }: BuyerLayoutProps): ReactElement {
  return (
    <div className="flex min-h-screen flex-col bg-gorola-fog">
      <BuyerNav />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6" role="main">
        {children}
      </main>
      <BuyerFooter />
    </div>
  );
}
