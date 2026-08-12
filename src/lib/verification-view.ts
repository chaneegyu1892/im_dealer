import type { Prisma } from "@prisma/client";
import { decryptPII } from "@/lib/pii";

const verificationStatusSelect = {
  customerType: true,
  licenseVerified: true,
  insuranceVerified: true,
  bizVerified: true,
  licenseData: true,
  insuranceData: true,
  bizData: true,
  consentedAt: true,
  verifiedAt: true,
} satisfies Prisma.CustomerVerificationSelect;

export const verificationDetailSelect = verificationStatusSelect;

export const verificationDetailWithDocumentsSelect = {
  ...verificationStatusSelect,
  documents: {
    select: {
      id: true,
      docType: true,
      status: true,
      failReason: true,
    },
    orderBy: { createdAt: "asc" },
  },
} satisfies Prisma.CustomerVerificationSelect;

type VerificationDetailRow = Prisma.CustomerVerificationGetPayload<{
  select: typeof verificationDetailSelect;
}>;

type VerificationDetailWithDocumentsRow =
  Prisma.CustomerVerificationGetPayload<{
    select: typeof verificationDetailWithDocumentsSelect;
  }>;

export interface VerificationDetailView {
  customerType: string;
  licenseVerified: boolean;
  insuranceVerified: boolean;
  bizVerified: boolean;
  licenseStatus: string | null;
  insuranceWorkplace: string | null;
  bizStatus: string | null;
  consentedAt: Date;
  verifiedAt: Date | null;
  documents?: Array<{
    id: string;
    docType: string;
    status: string;
    failReason: string | null;
  }>;
}

export function toVerificationDetailView(
  row: VerificationDetailRow | VerificationDetailWithDocumentsRow
): VerificationDetailView {
  const license = providerRecord(row.licenseData);
  const insurance = providerRecord(row.insuranceData);
  const business = providerRecord(row.bizData);

  return {
    customerType: row.customerType,
    licenseVerified: row.licenseVerified,
    insuranceVerified: row.insuranceVerified,
    bizVerified: row.bizVerified,
    licenseStatus:
      providerString(license, "resAuthenticityDesc") ??
      providerString(license, "resLicenseStatus") ??
      providerString(license, "status"),
    insuranceWorkplace:
      providerString(insurance, "resCompanyNm") ??
      providerString(insurance, "resWorkplaceName") ??
      providerString(insurance, "workplaceName"),
    bizStatus:
      providerString(business, "resBusinessStatusDesc") ??
      providerString(business, "resBizStatus") ??
      providerString(business, "bizStatus") ??
      providerString(business, "status"),
    consentedAt: row.consentedAt,
    verifiedAt: row.verifiedAt,
    ...("documents" in row
      ? {
          documents: row.documents.map((document) => ({
            id: document.id,
            docType: document.docType,
            status: document.status,
            failReason: document.failReason,
          })),
        }
      : {}),
  };
}

function providerRecord(value: unknown): Record<string, unknown> | null {
  const decrypted = decryptPII<unknown>(value);
  return decrypted !== null &&
    typeof decrypted === "object" &&
    !Array.isArray(decrypted)
    ? (decrypted as Record<string, unknown>)
    : null;
}

function providerString(
  value: Record<string, unknown> | null,
  key: string
): string | null {
  const candidate = value?.[key];
  return typeof candidate === "string" && candidate.length > 0
    ? candidate
    : null;
}
