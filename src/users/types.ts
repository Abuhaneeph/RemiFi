import { z } from "zod";

export const OnboardingStateSchema = z.enum([
  "unknown",
  "wallet_pending",
  "wallet_ready",
  "funded",
  "send_pending",
]);

export type OnboardingState = z.infer<typeof OnboardingStateSchema>;

export const UserRecordSchema = z.object({
  userId: z.string().min(1),
  telegramUserId: z.string().optional(),
  walletAddress: z
    .string()
    .regex(/^0x[a-fA-F0-9]{40}$/)
    .optional(),
  authStartedAt: z.string().datetime().optional(),
  linkedAt: z.string().datetime().optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type UserRecord = z.infer<typeof UserRecordSchema>;

export type UserStatus = {
  state: OnboardingState;
  userId: string | null;
  telegramUserId: string | null;
  walletAddress: string | null;
  balanceUsd: number;
  sendToken: string;
  minSendUsd: number;
  links: {
    auth: string;
    deposit: string;
    people: string;
    telegram: string;
  };
  pendingConfirmUrl?: string;
};
