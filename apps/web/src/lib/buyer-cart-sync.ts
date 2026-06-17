import { api } from "@/lib/api";
import { waitForAllCartMutations } from "@/lib/cart-variant-mutation-queue";
import { type ActiveOffer, type CartLine, useCartStore } from "@/store/cart.store";

type CartGetEnvelope = {
  data?: {
    items?: unknown;
    activeOffer?: ActiveOffer | null;
    activeOffers?: ActiveOffer[];
    storeId?: string | null;
  };
  success?: boolean;
};

export function mapBuyerCartItemsToLines(items: unknown): CartLine[] {
  if (!Array.isArray(items)) {
    return [];
  }
  const lines: CartLine[] = [];
  for (const raw of items) {
    if (raw === null || typeof raw !== "object") {
      continue;
    }
    const o = raw as Record<string, unknown>;
    const vid = o.productVariantId;
    const qty = o.quantity;
    if (typeof vid !== "string" || vid.length === 0) {
      continue;
    }
    if (typeof qty !== "number" || !Number.isFinite(qty) || qty < 1) {
      continue;
    }
    const pn = o.productName;
    const vl = o.variantLabel;
    const vu = o.variantUnit;
    const up = o.unitPrice;
    const variantLabel =
      typeof vl === "string" && typeof vu === "string" && vu.length > 0
        ? `${vl} · ${vu}`
        : typeof vl === "string"
          ? vl
          : typeof vu === "string"
            ? vu
            : undefined;
    const parsed = typeof up === "string" ? Number.parseFloat(up) : typeof up === "number" ? up : NaN;
    const unitPrice = Number.isFinite(parsed) ? parsed : undefined;
    lines.push({
      ...(typeof pn === "string" ? { productName: pn } : {}),
      productVariantId: vid,
      quantity: qty,
      ...(unitPrice !== undefined ? { unitPrice } : {}),
      ...(variantLabel !== undefined ? { variantLabel } : {})
    });
  }
  return lines;
}

let syncChain = Promise.resolve();

/** Fetches authoritative buyer cart and replaces local Zustand lines. */
export function syncBuyerCartFromServer(): Promise<void> {
  const apiClient = api;
  if (apiClient === null) {
    return Promise.resolve();
  }

  const nextSync = syncChain.then(async () => {
    // 1. Wait for any in-flight additions/decrements to hit the server first
    await waitForAllCartMutations();

    // 2. Fetch current server state
    const res = await apiClient.get<CartGetEnvelope>("/api/v1/cart");
    const items = res.data.data?.items;
    const activeOffer = res.data.data?.activeOffer;
    const activeOffers = res.data.data?.activeOffers ?? (activeOffer ? [activeOffer] : []);
    const storeId = res.data.data?.storeId ?? null;
    const serverLines = mapBuyerCartItemsToLines(items);

    const localLines = useCartStore.getState().lines;

    // 3. RECONCILIATION: If server is empty but we have local items (guest cart), push them to server
    if (serverLines.length === 0 && localLines.length > 0) {
      let anyPushFailed = false;
      for (const line of localLines) {
        try {
          await apiClient.post("/api/v1/cart/items", {
            productVariantId: line.productVariantId,
            quantity: line.quantity
          });
        } catch (err) {
          console.error("Failed to sync guest line to server:", err);
          anyPushFailed = true;
        }
      }

      // If a push failed, we don't blindly replace with server (which might be partial/empty).
      // Instead, we re-fetch once to see what stuck, but if that's still empty and we had items, we KEEP local.
      if (anyPushFailed) {
        const retryRes = await apiClient.get<CartGetEnvelope>("/api/v1/cart");
        const retryLines = mapBuyerCartItemsToLines(retryRes.data.data?.items);
        if (retryLines.length > 0) {
          useCartStore.getState().replaceLines(retryLines);
          const retryOffer = retryRes.data.data?.activeOffer ?? null;
          const retryOffers = retryRes.data.data?.activeOffers ?? (retryOffer ? [retryOffer] : []);
          const retryStoreId = retryRes.data.data?.storeId ?? null;
          useCartStore.getState().setActiveOffer(retryOffer);
          useCartStore.getState().setActiveOffers(retryOffers);
          useCartStore.getState().setStoreId(retryStoreId);
        }
        // If still empty after failure, we just keep local state as is to prevent the "zero out" bug.
        return;
      }

      const secondRes = await apiClient.get<CartGetEnvelope>("/api/v1/cart");
      const finalLines = mapBuyerCartItemsToLines(secondRes.data.data?.items);
      useCartStore.getState().replaceLines(finalLines);
      const finalOffer = secondRes.data.data?.activeOffer ?? null;
      const finalOffers = secondRes.data.data?.activeOffers ?? (finalOffer ? [finalOffer] : []);
      const finalStoreId = secondRes.data.data?.storeId ?? null;
      useCartStore.getState().setActiveOffer(finalOffer);
      useCartStore.getState().setActiveOffers(finalOffers);
      useCartStore.getState().setStoreId(finalStoreId);
      return;
    }

    // 4. If server has items, it is the authority (replaces local items)
    // BUT: If server is empty and local is empty, this just sets empty (correct).
    // AND: If server is empty but local is NOT, it was handled above.
    useCartStore.getState().replaceLines(serverLines);
    useCartStore.getState().setActiveOffer(activeOffer ?? null);
    useCartStore.getState().setActiveOffers(activeOffers);
    useCartStore.getState().setStoreId(storeId);
  }).catch((err) => {
    console.error("Cart sync error:", err);
  });

  syncChain = nextSync;
  return nextSync;
}
