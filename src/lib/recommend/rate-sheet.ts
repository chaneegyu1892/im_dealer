import { z } from "zod";
import type { RateSheetRaw } from "@/types/admin";

const rateSheetRawSchema = z.object({
  "36_10000": z.number(),
  "36_20000": z.number(),
  "36_30000": z.number(),
  "48_10000": z.number(),
  "48_20000": z.number(),
  "48_30000": z.number(),
  "60_10000": z.number(),
  "60_20000": z.number(),
  "60_30000": z.number(),
});

export function parseRateSheetRaw(value: unknown): RateSheetRaw | null {
  const parsed = rateSheetRawSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}
