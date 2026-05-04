import { prisma } from "../prisma";
import { decryptVerificationRow } from "@/lib/pii";

export interface AdminVerification {
  id: string;
  sessionId: string;
  customerType: string;
  licenseVerified: boolean;
  insuranceVerified: boolean;
  bizVerified: boolean;
  licenseData: Record<string, unknown> | null;
  insuranceData: Record<string, unknown> | null;
  bizData: Record<string, unknown> | null;
  consentedAt: Date;
  verifiedAt: Date | null;
  createdAt: Date;
}

export async function getRecentVerifications(take = 50): Promise<AdminVerification[]> {
  const rows = await prisma.customerVerification.findMany({
    orderBy: { createdAt: "desc" },
    take,
  });

  return rows.map((r) => {
    const decrypted = decryptVerificationRow(r);
    return {
      id: r.id,
      sessionId: r.sessionId,
      customerType: r.customerType,
      licenseVerified: r.licenseVerified,
      insuranceVerified: r.insuranceVerified,
      bizVerified: r.bizVerified,
      licenseData: decrypted.licenseData as Record<string, unknown> | null,
      insuranceData: decrypted.insuranceData as Record<string, unknown> | null,
      bizData: decrypted.bizData as Record<string, unknown> | null,
      consentedAt: r.consentedAt,
      verifiedAt: r.verifiedAt,
      createdAt: r.createdAt,
    };
  });
}
