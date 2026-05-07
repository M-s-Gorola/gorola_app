import type { ReactElement, ReactNode } from "react";

import { BuyerCartHydration } from "@/components/buyer/BuyerCartHydration";
import { BuyerFooter } from "@/components/buyer/BuyerFooter";
import { BuyerNav } from "@/components/buyer/BuyerNav";
import { CartDrawer } from "@/components/buyer/CartDrawer";

type BuyerLayoutProps = {
  children: ReactNode;
};

export function BuyerLayout({ children }: BuyerLayoutProps): ReactElement {
  return (
    <div className="flex min-h-screen flex-col bg-background transition-colors duration-500 ease-in-out">
      <BuyerCartHydration />
      <BuyerNav />
      <CartDrawer />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6" role="main">
        {children}
      </main>
      <BuyerFooter />
    </div>
  );
}
