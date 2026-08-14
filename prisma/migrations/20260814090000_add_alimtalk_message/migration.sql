CREATE TABLE "AlimtalkMessage" (
    "id" TEXT NOT NULL,
    "templateKey" TEXT NOT NULL,
    "templateCode" TEXT NOT NULL,
    "recipient" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "buttons" JSONB,
    "userId" TEXT,
    "refType" TEXT,
    "refId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "responseCode" TEXT,
    "resultCode" TEXT,
    "sendType" TEXT,
    "uid" TEXT,
    "failReason" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "leaseToken" TEXT,
    "claimedAt" TIMESTAMP(3),
    "sentAt" TIMESTAMP(3),
    "resultAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AlimtalkMessage_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AlimtalkMessage_status_createdAt_idx" ON "AlimtalkMessage"("status", "createdAt");
CREATE INDEX "AlimtalkMessage_userId_createdAt_idx" ON "AlimtalkMessage"("userId", "createdAt");
CREATE INDEX "AlimtalkMessage_refType_refId_idx" ON "AlimtalkMessage"("refType", "refId");

-- 수신자 번호(암호문)와 고객명·차량이 포함된 본문을 담는다. 서버(service_role)만 접근.
ALTER TABLE public."AlimtalkMessage" ENABLE ROW LEVEL SECURITY;
-- no policies (deny-all for non-bypass roles)
