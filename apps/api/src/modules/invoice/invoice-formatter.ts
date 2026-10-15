import type { InvoiceData } from "./invoice.types.js";

function formatCurrency(amount: number): string {
  return `₹${amount.toFixed(2)}`;
}

export function formatInvoice(data: InvoiceData): string {
  const lines: string[] = [];
  const divider = "============================================================";
  const subDivider = "------------------------------------------------------------";

  lines.push(divider);
  lines.push("                        TAX INVOICE                         ");
  lines.push(divider);
  lines.push(`Order ID    : ${data.orderId}`);
  lines.push(`Date        : ${data.createdAt.toISOString()}`);
  lines.push(`Order Type  : ${data.orderType}`);
  lines.push(`Status      : ${data.status}`);
  lines.push("");

  // Seller Details
  lines.push("SELLER DETAILS:");
  lines.push(`  Store Name : ${data.seller.storeName}`);
  lines.push(`  Address    : ${data.seller.address}`);
  if (data.seller.gstin) {
    lines.push(`  GSTIN      : ${data.seller.gstin}`);
  }
  if (data.seller.phone) {
    lines.push(`  Phone      : ${data.seller.phone}`);
  }
  lines.push("");

  // Buyer Details
  lines.push("BUYER DETAILS:");
  lines.push(`  Customer   : ${data.buyer.name}`);
  if (data.buyer.phone) {
    lines.push(`  Phone      : ${data.buyer.phone}`);
  }
  if (data.buyer.deliveryAddress) {
    lines.push(`  Address    : ${data.buyer.deliveryAddress}`);
  }
  lines.push("");

  // Itemized Table
  lines.push("ITEMIZED SUMMARY:");
  lines.push(subDivider);
  lines.push(
    `${"Item Description".padEnd(32)} ${"Qty".padStart(4)} ${"Unit Price".padStart(10)} ${"Total".padStart(10)}`
  );
  lines.push(subDivider);

  for (const item of data.items) {
    const itemLabel = item.variantLabel ? `${item.name} (${item.variantLabel})` : item.name;
    const truncatedLabel = itemLabel.length > 32 ? `${itemLabel.slice(0, 29)}...` : itemLabel;
    const qtyStr = item.quantity.toString().padStart(4);
    const unitPriceStr = item.unitPrice.toFixed(2).padStart(10);
    const lineTotalStr = item.lineTotal.toFixed(2).padStart(10);
    lines.push(`${truncatedLabel.padEnd(32)} ${qtyStr} ${unitPriceStr} ${lineTotalStr}`);
  }
  lines.push(subDivider);
  lines.push("");

  // Pricing Breakdown
  lines.push("PRICING BREAKDOWN:");
  lines.push(`  Subtotal                     : ${formatCurrency(data.pricing.subtotal)}`);
  lines.push(`  ${data.pricing.feeType.padEnd(28)} : ${formatCurrency(data.pricing.feeAmount)}`);

  if (data.pricing.discountSavingAmount && data.pricing.discountSavingAmount > 0) {
    const codeLabel = data.pricing.discountCode ? `Coupon (${data.pricing.discountCode})` : "Coupon Discount";
    lines.push(`  ${codeLabel.padEnd(28)} : -${formatCurrency(data.pricing.discountSavingAmount)}`);
  }

  if (data.pricing.offerSavingAmount && data.pricing.offerSavingAmount > 0) {
    const offerLabel = data.pricing.appliedOfferTitle ? `Offer (${data.pricing.appliedOfferTitle})` : "Store Offer";
    lines.push(`  ${offerLabel.padEnd(28)} : -${formatCurrency(data.pricing.offerSavingAmount)}`);
  }

  if (data.pricing.taxRate && data.pricing.taxRate > 0) {
    lines.push(`  GST (${data.pricing.taxRate.toFixed(2)}%)              : Applied in Grand Total`);
  }

  lines.push(subDivider);
  lines.push(`  Grand Total                  : ${formatCurrency(data.pricing.grandTotal)}`);
  lines.push(divider);

  return lines.join("\n");
}
