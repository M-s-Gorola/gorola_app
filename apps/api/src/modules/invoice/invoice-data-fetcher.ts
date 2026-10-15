import { NotFoundError } from "@gorola/shared";
import type { PrismaClient } from "@prisma/client";

import { decryptPII } from "../../lib/crypto.js";
import type { InvoiceData, InvoiceItem } from "./invoice.types.js";

export async function fetchInvoiceData(orderId: string, db: PrismaClient): Promise<InvoiceData> {
  const order = await db.order.findUnique({
    where: { id: orderId },
    include: {
      store: true,
      user: true,
      items: {
        include: {
          productVariant: {
            include: {
              product: { select: { name: true } }
            }
          }
        }
      },
      bookingOrder: true
    }
  });

  if (!order) {
    throw new NotFoundError(`Order not found with ID: ${orderId}`);
  }

  // Fetch business GSTIN if available
  const gstinSetting = await db.systemSetting.findUnique({
    where: { key: "GST_NUMBER" }
  });

  // Decrypt customer phone if available
  let buyerPhone: string | undefined = undefined;
  if (order.user?.phone) {
    try {
      buyerPhone = decryptPII(order.user.phone);
    } catch {
      buyerPhone = order.user.phone;
    }
  }

  // Decrypt store phone if available
  let storePhone: string | undefined = undefined;
  if (order.store?.phone) {
    try {
      storePhone = decryptPII(order.store.phone);
    } catch {
      storePhone = order.store.phone;
    }
  }

  const items: InvoiceItem[] = order.items.map((item) => {
    const unitPrice = Number(item.price);
    const lineTotal = unitPrice * item.quantity;
    return {
      name: item.productName || item.productVariant?.product?.name || "Item",
      variantLabel: item.variantLabel || item.productVariant?.label || null,
      quantity: item.quantity,
      unitPrice,
      lineTotal
    };
  });

  const feeType = order.orderType === "BOOKING" ? "Service Fee" : "Delivery Fee";

  return {
    orderId: order.id,
    orderType: order.orderType as "QUICK" | "BOOKING",
    createdAt: order.createdAt,
    status: order.status,
    seller: {
      storeName: order.store?.name ?? "GoRola Store",
      address: order.store?.address ?? "Mussoorie, Uttarakhand",
      ...(storePhone ? { phone: storePhone } : {}),
      ...(gstinSetting?.value ? { gstin: gstinSetting.value } : {})
    },
    buyer: {
      name: order.user?.name ?? "Customer",
      ...(buyerPhone ? { phone: buyerPhone } : {}),
      ...(order.landmarkDescription ? { deliveryAddress: order.landmarkDescription } : {})
    },
    items,
    pricing: {
      subtotal: Number(order.subtotal),
      feeType,
      feeAmount: Number(order.deliveryFee),
      discountCode: order.appliedDiscountCode,
      discountSavingAmount: Number(order.discountSavingAmount ?? 0),
      appliedOfferTitle: order.appliedOfferTitle,
      offerSavingAmount: Number(order.offerSavingAmount ?? 0),
      taxRate: order.taxRate ? Number(order.taxRate) : null,
      grandTotal: Number(order.total)
    }
  };
}
