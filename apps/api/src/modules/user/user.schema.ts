import { ValidationError } from "@gorola/shared";
import { z } from "zod";

export const updateProfileSchema = z.object({
  name: z.string().min(1, "Name is required").max(100, "Name is too long")
});

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;

export function parseUpdateProfileInput(body: unknown): UpdateProfileInput {
  const result = updateProfileSchema.safeParse(body);
  if (!result.success) {
    throw new ValidationError("Invalid profile payload", result.error.flatten());
  }
  return result.data;
}

export const updateNomineeSchema = z.object({
  nomineeName: z.string().trim().max(100, "Name is too long").nullable().optional(),
  nomineeContact: z.string().trim().max(100, "Contact info is too long").nullable().optional(),
  nomineeRelationship: z.string().trim().max(50, "Relationship is too long").nullable().optional()
});

export type UpdateNomineeInput = z.infer<typeof updateNomineeSchema>;

export function parseUpdateNomineeInput(body: unknown): UpdateNomineeInput {
  const result = updateNomineeSchema.safeParse(body);
  if (!result.success) {
    throw new ValidationError("Invalid nominee payload", result.error.flatten());
  }
  return result.data;
}

