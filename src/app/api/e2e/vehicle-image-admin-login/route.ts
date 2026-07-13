import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { assertVehicleImageE2ERuntime } from "@/lib/vehicle-images/e2e-runtime";
import { VEHICLE_IMAGE_E2E_ADMIN_COOKIE } from "@/lib/vehicle-images/e2e-admin-session";

const credentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
}).strict();

function equal(actual: string, expected: string): boolean {
  const actualBytes = Buffer.from(actual);
  const expectedBytes = Buffer.from(expected);
  return actualBytes.length === expectedBytes.length && timingSafeEqual(actualBytes, expectedBytes);
}

export async function POST(request: Request): Promise<NextResponse> {
  try {
    assertVehicleImageE2ERuntime(process.env);
    const parsed = credentialsSchema.safeParse(await request.json());
    const email = process.env.E2E_ADMIN_EMAIL?.trim() ?? "";
    const password = process.env.E2E_ADMIN_PASSWORD ?? "";
    const token = process.env.E2E_ADMIN_SESSION_TOKEN?.trim() ?? "";
    if (!parsed.success || !email || !password || !token
      || !equal(parsed.data.email, email) || !equal(parsed.data.password, password)) {
      return NextResponse.json({ error: "인증 정보가 올바르지 않습니다." }, { status: 401 });
    }
    const response = NextResponse.json({ success: true });
    response.cookies.set(VEHICLE_IMAGE_E2E_ADMIN_COOKIE, token, {
      httpOnly: true,
      sameSite: "strict",
      secure: false,
      path: "/",
    });
    return response;
  } catch (error) { // no-excuse-ok: catch -- E2E-only HTTP boundary fails closed.
    if (error instanceof SyntaxError) {
      return NextResponse.json({ error: "요청 형식이 올바르지 않습니다." }, { status: 400 });
    }
    return NextResponse.json({ error: "E2E 런타임이 허용되지 않았습니다." }, { status: 403 });
  }
}
