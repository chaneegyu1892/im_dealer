import { config } from "dotenv";
config({ path: ".env.local" });
config();
import { PrismaClient } from "@prisma/client";
const p = new PrismaClient();

// 추천 전환 현황 UI 미리보기용 데모 데이터 (로컬 개발 DB 전용).
// 데모 계정: demo-ref-*@demo.local / 추천인은 DEV_LOGIN_EMAIL 회원.
const DEMO_EMAILS = [
  "demo-ref-1@demo.local",
  "demo-ref-2@demo.local",
  "demo-ref-3@demo.local",
  "demo-ref-4@demo.local",
];

const email = process.env.DEV_LOGIN_EMAIL?.trim();
if (!email) throw new Error("DEV_LOGIN_EMAIL이 .env에 필요합니다.");

const referrer = await p.user.findFirst({ where: { email } });
if (!referrer) throw new Error(`추천인 회원 없음: ${email} (개발용 로그인을 먼저 한 번 실행하세요)`);

// 재실행 대비: 기존 데모 데이터 정리
const existing = await p.user.findMany({
  where: { email: { in: DEMO_EMAILS } },
  select: { id: true },
});
const existingIds = existing.map((u) => u.id);
if (existingIds.length > 0) {
  await p.savedQuote.deleteMany({ where: { userId: { in: existingIds } } });
  await p.referral.deleteMany({ where: { refereeId: { in: existingIds } } });
  await p.user.deleteMany({ where: { id: { in: existingIds } } });
}

const vehicle = await p.vehicle.findFirst({
  where: { isVisible: true },
  include: { trims: { take: 1 } },
});
if (!vehicle || vehicle.trims.length === 0) throw new Error("차량/트림 데이터가 없습니다.");
const trim = vehicle.trims[0];

const demos = [
  { name: "김진규", signedUp: "2026-08-02", quote: { status: "CONVERTED" as const, contactedAt: new Date("2026-08-05"), convertedAt: new Date("2026-08-09") } },
  { name: "박지영", signedUp: "2026-08-10", quote: { status: "IN_PROGRESS" as const, contactedAt: new Date("2026-08-12") } },
  { name: "이준수", signedUp: "2026-08-11", quote: { status: "LOST" as const, contactedAt: null } },
  { name: "최민지", signedUp: "2026-08-15", quote: null },
];

for (let i = 0; i < demos.length; i++) {
  const d = demos[i];
  const referee = await p.user.create({
    data: {
      email: DEMO_EMAILS[i],
      name: d.name,
      role: "member",
      provider: "kakao",
      profileCompleted: true,
      isActive: true,
      createdAt: new Date(`${d.signedUp}T00:00:00Z`),
    },
  });
  await p.referral.create({
    data: {
      referrerId: referrer.id,
      refereeId: referee.id,
      code: referrer.referralCode ?? "DEMO1",
      status: "REWARDED",
      createdAt: new Date(`${d.signedUp}T00:00:00Z`),
    },
  });
  if (d.quote) {
    await p.savedQuote.create({
      data: {
        sessionId: `demo-ref-${i + 1}-${Date.now()}`,
        userId: referee.id,
        vehicleId: vehicle.id,
        trimId: trim.id,
        contractMonths: 36,
        annualMileage: 20000,
        depositRate: 0,
        prepayRate: 0,
        contractType: "반납형",
        monthlyPayment: 500000,
        totalCost: 18000000,
        breakdown: {},
        expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 30),
        status: d.quote.status,
        contactedAt: d.quote.contactedAt,
        ...(d.quote.status === "CONVERTED" && "convertedAt" in d.quote
          ? { convertedAt: d.quote.convertedAt }
          : {}),
      },
    });
  }
  console.log(`✓ ${d.name} (${d.quote?.status ?? "견적 없음"})`);
}

console.log("\n데모 데이터 삽입 완료. /mypage/referral 새로고침으로 확인하세요.");
await p.$disconnect();
