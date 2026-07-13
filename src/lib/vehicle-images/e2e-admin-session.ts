import { timingSafeEqual } from "node:crypto";
import type { User } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { assertVehicleImageE2ERuntime } from "./e2e-runtime";

export const VEHICLE_IMAGE_E2E_ADMIN_COOKIE = "vehicle_image_e2e_admin";

function equalToken(actual: string, expected: string): boolean {
  const actualBytes = Buffer.from(actual);
  const expectedBytes = Buffer.from(expected);
  return actualBytes.length === expectedBytes.length && timingSafeEqual(actualBytes, expectedBytes);
}

export async function getVehicleImageE2EAdmin(
  token: string | undefined,
  environment: NodeJS.ProcessEnv = process.env,
): Promise<User | null> {
  assertVehicleImageE2ERuntime(environment);
  const expected = environment.E2E_ADMIN_SESSION_TOKEN?.trim();
  const email = environment.E2E_ADMIN_EMAIL?.trim();
  if (!token || !expected || !email || !equalToken(token, expected)) return null;
  return prisma.user.findFirst({
    where: { email, isActive: true, role: { in: ["admin", "superadmin"] } },
  });
}
