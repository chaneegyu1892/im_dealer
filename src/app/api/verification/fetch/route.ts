import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  verifyDriverLicense,
  verifyHealthInsurance,
  verifyBusiness,
} from "@/lib/codef";

const fetchSchema = z.object({
  verificationId: z.string().min(1),
  connectedId: z.string().min(1),
  name: z.string().min(1),
  birthDate: z.string().min(1),
  licenseNo: z.string().optional(),
  bizNo: z.string().optional(),
});

// ─── POST /api/verification/fetch ────────────────────────
// customerType에 따라 Codef API 순차 호출 후 결과 저장
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = fetchSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "입력값이 올바르지 않습니다.", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { verificationId, connectedId, name, birthDate, licenseNo, bizNo } = parsed.data;

    const verification = await prisma.customerVerification.findUnique({
      where: { id: verificationId },
    });

    if (!verification) {
      return NextResponse.json(
        { error: "해당 인증 레코드를 찾을 수 없습니다." },
        { status: 404 }
      );
    }

    const customerType = verification.customerType as
      | "individual"
      | "self_employed"
      | "corporate";

    // 운전면허 확인 (모든 타입 공통)
    const licenseResult = await verifyDriverLicense(
      connectedId,
      name,
      licenseNo ?? "",
      birthDate
    );

    // 건강보험 자격득실 (individual, self_employed)
    const needsInsurance =
      customerType === "individual" || customerType === "self_employed";
    const insuranceResult = needsInsurance
      ? await verifyHealthInsurance(connectedId, name, birthDate)
      : null;

    // 사업자등록 상태 (self_employed, corporate)
    const needsBiz =
      customerType === "self_employed" || customerType === "corporate";
    const bizResult =
      needsBiz && bizNo ? await verifyBusiness(bizNo) : null;

    // ─── 각 항목별 검증 성공 여부 판정 ────────────────────
    // 운전면허: API 호출 성공(CF-00000) + resAuthenticity === "1"
    const licenseRaw = licenseResult.success
      ? (licenseResult.data as Record<string, unknown>)
      : null;
    const licenseVerified =
      licenseResult.success && licenseRaw?.resAuthenticity === "1";

    // 건강보험: API 호출 성공(CF-00000) = 자격 확인됨
    const insuranceRaw = insuranceResult?.success
      ? (insuranceResult.data as Record<string, unknown>)
      : null;
    const insuranceVerified = insuranceResult?.success ?? false;

    // 사업자등록: resBusinessStatus === "01" (01=정상영업)
    const bizRaw = bizResult?.success
      ? (bizResult.data as Record<string, unknown>)
      : null;
    const bizVerified =
      bizResult?.success === true && bizRaw?.resBusinessStatus === "01";

    // DB 업데이트
    await prisma.customerVerification.update({
      where: { id: verificationId },
      data: {
        connectedId,
        licenseVerified,
        licenseData: licenseRaw
          ? (licenseRaw as Prisma.InputJsonValue)
          : Prisma.JsonNull,
        insuranceVerified,
        insuranceData: insuranceRaw
          ? (insuranceRaw as Prisma.InputJsonValue)
          : Prisma.JsonNull,
        bizVerified,
        bizData: bizRaw
          ? (bizRaw as Prisma.InputJsonValue)
          : Prisma.JsonNull,
        verifiedAt: new Date(),
      },
    });

    return NextResponse.json({
      success: true,
      results: {
        license: { verified: licenseVerified, raw: licenseRaw ?? {} },
        ...(insuranceResult !== null
          ? { insurance: { verified: insuranceVerified, raw: insuranceRaw ?? {} } }
          : {}),
        ...(bizResult !== null
          ? { biz: { verified: bizVerified, raw: bizRaw ?? {} } }
          : {}),
      },
    });
  } catch (error) {
    console.error("[POST /api/verification/fetch]", error);
    return NextResponse.json(
      { error: "서류 조회 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
