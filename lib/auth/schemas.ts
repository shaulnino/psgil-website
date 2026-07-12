/**
 * Zod schemas for public auth input (PW-2b). Server actions parse form data
 * through these before touching the account store.
 */
import { z } from "zod";
import { emailSchema } from "@/lib/accounts/types";

export const passwordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters.")
  .max(200);

export const registerSchema = z.object({
  name: z.string().trim().min(1, "Please enter your name.").max(120),
  email: emailSchema,
  password: passwordSchema,
});

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "Please enter your password."),
});

export const forgotPasswordSchema = z.object({
  email: emailSchema,
});

export const resetPasswordSchema = z.object({
  password: passwordSchema,
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
