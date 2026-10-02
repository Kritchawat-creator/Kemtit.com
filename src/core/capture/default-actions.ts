"use server";

import { z } from "zod";

import { DOMAINS } from "@/core/domain/domains";

import { getCaptureSmartDefaults } from "./defaults";

const smartDefaultRequestSchema = z.object({
  fallbackDomain: z.enum(DOMAINS),
});

export async function loadCaptureSmartDefaults(input: unknown) {
  const parsed = smartDefaultRequestSchema.safeParse(input);
  if (!parsed.success) return null;
  return getCaptureSmartDefaults(parsed.data.fallbackDomain);
}
