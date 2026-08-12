import { prisma } from "../prisma";

export interface AdminVerification {
  id: string;
  sessionId: string;
  customerType: string;
  licenseVerified: boolean;
  insuranceVerified: boolean;
  bizVerified: boolean;
  consentedAt: Date;
  verifiedAt: Date | null;
  createdAt: Date;
}

export async function getRecentVerifications(take = 50): Promise<AdminVerification[]> {
  return prisma.customerVerification.findMany({
    orderBy: { createdAt: "desc" },
    take,
    select: {
      id: true,
      sessionId: true,
      customerType: true,
      licenseVerified: true,
      insuranceVerified: true,
      bizVerified: true,
      consentedAt: true,
      verifiedAt: true,
      createdAt: true,
    },
  });
}
