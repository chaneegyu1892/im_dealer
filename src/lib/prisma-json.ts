import { Prisma } from "@prisma/client";

function toNestedPrismaJson(value: unknown): Prisma.InputJsonValue | null {
  if (value === null || typeof value === "string" || typeof value === "boolean") return value;
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new Error("JSON number must be finite");
    return value;
  }
  if (Array.isArray(value)) {
    return value.filter((item) => item !== undefined).map(toNestedPrismaJson);
  }
  if (typeof value === "object") {
    const output: Record<string, Prisma.InputJsonValue | null> = {};
    for (const [key, item] of Object.entries(value)) {
      if (item !== undefined) output[key] = toNestedPrismaJson(item);
    }
    return output;
  }
  throw new Error(`Unsupported JSON value: ${typeof value}`);
}

export function toPrismaJson(value: unknown): Prisma.InputJsonValue {
  const result = toNestedPrismaJson(value);
  if (result === null) throw new Error("Top-level JSON null is not supported");
  return result;
}
