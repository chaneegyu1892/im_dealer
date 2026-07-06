import { Prisma } from "@prisma/client";
import { normalizeHex } from "../vehicle-import-mappings";
import { buildColorMetadata } from "./prisma-apply-helpers";
import type { CrawlColorSnapshot } from "./types";

export async function upsertColors(
  tx: Prisma.TransactionClient,
  input: {
    readonly vehicleId: string;
    readonly colors: readonly CrawlColorSnapshot[];
    readonly kind: "EXTERIOR" | "INTERIOR";
  }
): Promise<number> {
  let count = 0;
  for (const [index, color] of input.colors.entries()) {
    await tx.vehicleColor.upsert({
      where: {
        vehicleId_kind_externalId: {
          vehicleId: input.vehicleId,
          kind: input.kind,
          externalId: color.colorId,
        },
      },
      create: {
        vehicleId: input.vehicleId,
        kind: input.kind,
        externalId: color.colorId,
        name: color.name ?? `color-${color.colorId}`,
        hexCode: normalizeHex(color.rgb),
        priceDelta: color.price,
        isDefault: index === 0,
        sortOrder: index,
        mfgCode: color.code,
        metadata: buildColorMetadata(color),
      },
      update: {
        name: color.name ?? `color-${color.colorId}`,
        hexCode: normalizeHex(color.rgb),
        priceDelta: color.price,
        mfgCode: color.code,
        metadata: buildColorMetadata(color),
      },
    });
    count++;
  }
  return count;
}
