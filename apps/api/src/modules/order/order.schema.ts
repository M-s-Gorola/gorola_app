import { ValidationError } from "@gorola/shared";
import { PaymentMethod } from "@prisma/client";
import { z } from "zod";

export const placeBuyerOrderBodySchema = z
  .discriminatedUnion("addressMode", [
    z.object({
      addressMode: z.literal("saved"),
      addressId: z.string().min(1),
      deliveryNote: z.string().max(500).optional().nullable(),
      discountCode: z.string().trim().min(1).optional(),
      paymentMethod: z.nativeEnum(PaymentMethod)
    }),
    z
      .object({
        addressLabel: z.string().min(1).optional(),
        addressMode: z.literal("new"),
        deliveryNote: z.string().max(500).optional().nullable(),
        discountCode: z.string().trim().min(1).optional(),
        flatRoom: z.string().max(120).optional().nullable(),
        landmarkDescription: z.string().min(10),
        lat: z.number().optional().nullable(),
        lng: z.number().optional().nullable(),
        paymentMethod: z.nativeEnum(PaymentMethod),
        saveAddress: z.boolean().optional()
      })
      .superRefine((data, ctx) => {
        if (data.saveAddress === true && (data.addressLabel === undefined || data.addressLabel.length === 0)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "addressLabel required when saveAddress is true",
            path: ["addressLabel"]
          });
        }
      })
  ]);

export type PlaceBuyerOrderBody = z.infer<typeof placeBuyerOrderBodySchema>;

export function parsePlaceBuyerOrderBody(body: unknown): PlaceBuyerOrderBody {
  const result = placeBuyerOrderBodySchema.safeParse(body);
  if (!result.success) {
    throw new ValidationError("Invalid checkout payload", result.error.flatten());
  }
  return result.data;
}
