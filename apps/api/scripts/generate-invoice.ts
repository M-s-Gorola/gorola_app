import { PrismaClient } from "@prisma/client";

import { fetchInvoiceData } from "../src/modules/invoice/invoice-data-fetcher.js";
import { formatInvoice } from "../src/modules/invoice/invoice-formatter.js";

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  let orderId: string | undefined;

  for (let i = 0; i < args.length; i++) {
    // eslint-disable-next-line security/detect-object-injection
    const arg = args[i];
    if (arg === "--orderId" || arg === "-o") {
      // eslint-disable-next-line security/detect-object-injection
      orderId = args[i + 1];
      i++;
    } else if (arg?.startsWith("--orderId=")) {
      orderId = arg.split("=")[1];
    }
  }

  const prisma = new PrismaClient();

  try {
    if (!orderId) {
      const latestOrder = await prisma.order.findFirst({
        orderBy: { createdAt: "desc" }
      });
      if (!latestOrder) {
        console.error("Error: No orders found in database and no --orderId provided.");
        console.error("Usage: pnpm ts-node scripts/generate-invoice.ts --orderId <order_id>");
        process.exit(1);
      }
      orderId = latestOrder.id;
      console.log(`No --orderId specified. Using latest order: ${orderId}\n`);
    }

    const data = await fetchInvoiceData(orderId, prisma);
    const invoiceOutput = formatInvoice(data);
    console.log(invoiceOutput);
  } catch (error) {
    console.error("Failed to generate invoice:", error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

void main();
