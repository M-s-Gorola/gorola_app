import { create } from "zustand";

export type CartLine = {
  productVariantId: string;
  quantity: number;
  productName?: string;
  variantLabel?: string;
  unitPrice?: number;
};

type CartState = {
  lines: CartLine[];
  isOpen: boolean;
  discountCode: string;
  discountSavedAmount: number;
  discountError: string | null;
  addOrMergeLine: (line: CartLine) => void;
  /** Replaces all lines (e.g. after `GET /api/v1/cart`). */
  replaceLines: (lines: CartLine[]) => void;
  removeLine: (productVariantId: string) => void;
  setQty: (productVariantId: string, quantity: number) => void;
  setDiscountState: (payload: {
    code: string;
    savedAmount: number;
    error: string | null;
  }) => void;
  resetDiscountState: () => void;
  open: () => void;
  close: () => void;
  toggle: () => void;
  clear: () => void;
  totalItemCount: () => number;
};

function mergeLine(lines: CartLine[], line: CartLine): CartLine[] {
  const idx = lines.findIndex((l) => l.productVariantId === line.productVariantId);
  if (idx === -1) {
    return [...lines, { ...line }];
  }
  const next = lines.slice();
  // eslint-disable-next-line security/detect-object-injection
  const existing = next[idx];
  if (existing === undefined) {
    return [...lines, { ...line }];
  }
  const productName = line.productName ?? existing.productName;
  const unitPrice = line.unitPrice ?? existing.unitPrice;
  const variantLabel = line.variantLabel ?? existing.variantLabel;
  // eslint-disable-next-line security/detect-object-injection
  next[idx] = {
    ...existing,
    quantity: existing.quantity + line.quantity,
    ...(productName !== undefined ? { productName } : {}),
    ...(unitPrice !== undefined ? { unitPrice } : {}),
    ...(variantLabel !== undefined ? { variantLabel } : {})
  };
  return next;
}

export const useCartStore = create<CartState>((set, get) => ({
  lines: [],
  isOpen: false,
  discountCode: "",
  discountSavedAmount: 0,
  discountError: null,
  addOrMergeLine: (line) =>
    set((s) => ({
      lines: mergeLine(s.lines, line)
    })),
  replaceLines: (lines) => set({ lines: lines.map((l) => ({ ...l })) }),
  removeLine: (productVariantId) =>
    set((s) => ({
      lines: s.lines.filter((l) => l.productVariantId !== productVariantId)
    })),
  setQty: (productVariantId, quantity) => {
    if (quantity <= 0) {
      get().removeLine(productVariantId);
      return;
    }
    set((s) => ({
      lines: s.lines.map((l) =>
        l.productVariantId === productVariantId ? { ...l, quantity } : l
      )
    }));
  },
  setDiscountState: ({ code, savedAmount, error }) =>
    set({
      discountCode: code,
      discountError: error,
      discountSavedAmount: savedAmount
    }),
  resetDiscountState: () =>
    set({
      discountCode: "",
      discountError: null,
      discountSavedAmount: 0
    }),
  open: () => set({ isOpen: true }),
  close: () => set({ isOpen: false }),
  toggle: () => set((s) => ({ isOpen: !s.isOpen })),
  clear: () =>
    set({
      lines: [],
      discountCode: "",
      discountError: null,
      discountSavedAmount: 0
    }),
  totalItemCount: () => get().lines.reduce((acc, l) => acc + l.quantity, 0)
}));
