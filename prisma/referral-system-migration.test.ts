import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const SCHEMA_PATH = resolve(process.cwd(), "prisma/schema.prisma");
const MIGRATION_PATH = resolve(
  process.cwd(),
  "prisma/migrations/20260811000000_referral_system/migration.sql"
);

async function load(): Promise<{ schema: string; migration: string }> {
  const [schema, migration] = await Promise.all([
    readFile(SCHEMA_PATH, "utf8"),
    readFile(MIGRATION_PATH, "utf8"),
  ]);
  return { schema, migration };
}

describe("referral system migration", () => {
  it("adds the referral model, code and coupon link to the schema", async () => {
    const { schema } = await load();

    expect(schema).toMatch(/\breferralCode\s+String\?\s+@unique/);
    expect(schema).toMatch(/enum ReferralStatus \{\s*REWARDED\s+BLOCKED\s+REVOKED\s*\}/);
    expect(schema).toMatch(/model Referral \{/);
    expect(schema).toMatch(/refereeId\s+String\s+@unique/);
    expect(schema).toMatch(/@@index\(\[referrerId, createdAt\]\)/);
    expect(schema).toMatch(/referralsGiven\s+Referral\[\]\s+@relation\("Referrer"\)/);
    expect(schema).toMatch(/referralReceived\s+Referral\?\s+@relation\("Referee"\)/);
    expect(schema).toMatch(/REFERRAL_RECEIVED/);
    expect(schema).toMatch(/REFERRAL_GIVEN/);
    expect(schema).toMatch(/referral\s+Referral\?\s+@relation\("IssuedCouponReferral"/);
    expect(schema).toMatch(/coupons\s+IssuedCoupon\[\]\s+@relation\("IssuedCouponReferral"\)/);
  });

  it("drops the blanket userId+policyId unique so referrers can accrue rewards", async () => {
    const { schema, migration } = await load();

    // 이 유니크가 남아 있으면 추천인이 두 번째 REFERRAL_GIVEN 쿠폰을 받지 못한다.
    // 스키마에는 "되살리지 말라"는 주석이 같은 문자열을 담고 있으므로 주석을 걷어내고 본다.
    const declarations = schema
      .split("\n")
      .filter((line) => !line.trim().startsWith("//"))
      .join("\n");
    expect(declarations).not.toMatch(/@@unique\(\[userId, policyId\]\)/);
    expect(migration).toContain('DROP INDEX IF EXISTS "IssuedCoupon_userId_policyId_key"');
  });

  it("replaces it with the two partial unique indexes", async () => {
    const { migration } = await load();
    const flat = migration.replace(/\s+/g, " ");

    expect(flat).toContain(
      'CREATE UNIQUE INDEX IF NOT EXISTS "IssuedCoupon_nonreferral_unique" ON "IssuedCoupon"("userId", "policyId") WHERE "referralId" IS NULL'
    );
    expect(flat).toContain(
      'CREATE UNIQUE INDEX IF NOT EXISTS "IssuedCoupon_referral_unique" ON "IssuedCoupon"("policyId", "referralId") WHERE "referralId" IS NOT NULL'
    );
    expect(flat).toContain('CREATE TABLE IF NOT EXISTS "Referral"');
    expect(flat).toContain('ALTER TABLE "IssuedCoupon" ADD COLUMN IF NOT EXISTS "referralId" TEXT');
    expect(flat).toContain('CREATE TYPE "ReferralStatus"');
  });

  it("never auto-issues referral policies through coupon reconcile", async () => {
    const rules = await readFile(resolve(process.cwd(), "src/lib/coupons/rules.ts"), "utf8");

    // REFERRAL_* 정책이 활성 상태로 시드되므로, 기존의 "SIGNUP 이 아니면 계약 여부로 발급"
    // 분기를 그대로 두면 계약이 있는 모든 회원에게 추천 쿠폰이 자동 발급된다.
    expect(rules).toMatch(/if \(trigger === "FIRST_CONTRACT"\) return input\.convertedQuoteId !== null;/);
    expect(rules).toMatch(/return false;/);
  });
});
