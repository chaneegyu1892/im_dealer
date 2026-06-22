-- CreateTable
CREATE TABLE "VerificationDocument" (
    "id" TEXT NOT NULL,
    "verificationId" TEXT NOT NULL,
    "docType" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "fileName" TEXT,
    "mimeType" TEXT DEFAULT 'application/pdf',
    "contentEnc" JSONB,
    "docVerifyNo" TEXT,
    "failReason" TEXT,
    "issuedAt" TIMESTAMP(3),
    "piiPurgedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VerificationDocument_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "VerificationDocument_verificationId_idx" ON "VerificationDocument"("verificationId");

-- AddForeignKey
ALTER TABLE "VerificationDocument" ADD CONSTRAINT "VerificationDocument_verificationId_fkey" FOREIGN KEY ("verificationId") REFERENCES "CustomerVerification"("id") ON DELETE CASCADE ON UPDATE CASCADE;
