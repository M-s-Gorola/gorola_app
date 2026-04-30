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
  addOrMergeLine: (line: CartLine) => void;
  removeLine: (productVariantId: string) => void;
  setQty: (productVariantId: string, quantity: number) => void;
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
  const existing = next[idx];
  if (existing === undefined) {
    return [...lines, { ...line }];
  }
  const productName = line.productName ?? existing.productName;
  const unitPrice = line.unitPrice ?? existing.unitPrice;
  const variantLabel = line.variantLabel ?? existing.variantLabel;
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
  addOrMergeLine: (line) =>
    set((s) => ({
      lines: mergeLine(s.lines, line)
    })),
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
  open: () => set({ isOpen: true }),
  close: () => set({ isOpen: false }),
  toggle: () => set((s) => ({ isOpen: !s.isOpen })),
  clear: () => set({ lines: [] }),
  totalItemCount: () => get().lines.reduce((acc, l) => acc + l.quantity, 0)
}));
