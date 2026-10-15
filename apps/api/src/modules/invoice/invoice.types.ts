export interface InvoiceItem {
  name: string;
  variantLabel?: string | null;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
}

export interface InvoiceData {
  orderId: string;
  orderType: "QUICK" | "BOOKING";
  createdAt: Date;
  status: string;
  seller: {
    storeName: string;
    address: string;
    phone?: string;
    gstin?: string;
  };
  buyer: {
    name: string;
    phone?: string;
    deliveryAddress?: string;
  };
  items: InvoiceItem[];
  pricing: {
    subtotal: number;
    feeType: "Delivery Fee" | "Service Fee";
    feeAmount: number;
    discountCode?: string | null;
    discountSavingAmount?: number;
    appliedOfferTitle?: string | null;
    offerSavingAmount?: number;
    taxRate?: number | null;
    grandTotal: number;
  };
}
