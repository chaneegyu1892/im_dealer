-- 관리자별 알림 읽음 기록(AdminNotificationRead) 신설.
-- AdminNotification.isRead(전역) 컬럼은 하위 호환으로 유지하므로 이 마이그레이션에서 건드리지 않는다.
-- 어드민 계정은 User(role 기반)이므로 adminUserId → User.id.
-- 기존 마이그레이션 편집 금지 원칙과 동일하게 안전 적용용으로 전체를 IF NOT EXISTS 가드로 감싼다.
DO $admin_notification_read$
BEGIN
  IF to_regclass('public."AdminNotificationRead"') IS NULL THEN
    CREATE TABLE IF NOT EXISTS public."AdminNotificationRead" (
      "id" TEXT NOT NULL,
      "notificationId" TEXT NOT NULL,
      "adminUserId" TEXT NOT NULL,
      "readAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

      CONSTRAINT "AdminNotificationRead_pkey" PRIMARY KEY ("id")
    );

    -- 1 관리자 × 1 알림 1행. 동시 읽음(upsert) 경합을 DB 유니크 제약이 흡수한다.
    CREATE UNIQUE INDEX IF NOT EXISTS "AdminNotificationRead_notificationId_adminUserId_key"
      ON public."AdminNotificationRead"("notificationId", "adminUserId");
    CREATE INDEX IF NOT EXISTS "AdminNotificationRead_adminUserId_idx"
      ON public."AdminNotificationRead"("adminUserId");

    IF NOT EXISTS (
      SELECT 1
      FROM pg_catalog.pg_constraint
      WHERE conrelid = 'public."AdminNotificationRead"'::regclass
        AND conname = 'AdminNotificationRead_notificationId_fkey'
    ) THEN
      ALTER TABLE public."AdminNotificationRead"
        ADD CONSTRAINT "AdminNotificationRead_notificationId_fkey"
        FOREIGN KEY ("notificationId") REFERENCES public."AdminNotification"("id")
        ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;

    IF NOT EXISTS (
      SELECT 1
      FROM pg_catalog.pg_constraint
      WHERE conrelid = 'public."AdminNotificationRead"'::regclass
        AND conname = 'AdminNotificationRead_adminUserId_fkey'
    ) THEN
      ALTER TABLE public."AdminNotificationRead"
        ADD CONSTRAINT "AdminNotificationRead_adminUserId_fkey"
        FOREIGN KEY ("adminUserId") REFERENCES public."User"("id")
        ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;

    -- 읽음 기록은 관리자 개인 열람 이력. RLS deny-all 로 잠근다(AlimtalkMessage 와 동일 방식).
    ALTER TABLE public."AdminNotificationRead" ENABLE ROW LEVEL SECURITY;
  END IF;
END
$admin_notification_read$;
