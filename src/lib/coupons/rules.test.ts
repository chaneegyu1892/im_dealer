import { describe, expect, it } from "vitest";
import {
  planCouponReconcile,
  type CouponReconcileInput,
  type CouponView,
  type PolicyView,
} from "./rules";

const NOW = new Date("2026-08-06T00:00:00.000Z");

const signupPolicy: PolicyView = {
  id: "policy-signup",
  trigger: "SIGNUP",
  title: "첫가입 축하 주유권",
  rewardLabel: "주유권 10만원",
  rewardAmount: 100_000,
  validDays: 90,
  isActive: true,
  startsAt: null,
  endsAt: null,
};

const contractPolicy: PolicyView = {
  id: "policy-contract",
  trigger: "FIRST_CONTRACT",
  title: "첫계약 축하금",
  rewardLabel: "축하금 30만원",
  rewardAmount: 300_000,
  validDays: null,
  isActive: true,
  startsAt: null,
  endsAt: null,
};

function makeInput(overrides: Partial<CouponReconcileInput> = {}): CouponReconcileInput {
  return {
    now: NOW,
    profileCompleted: true,
    convertedQuoteId: null,
    policies: [signupPolicy, contractPolicy],
    coupons: [],
    ...overrides,
  };
}

function heldSignup(overrides: Partial<CouponView> = {}): CouponView {
  return {
    id: "coupon-1",
    policyId: "policy-signup",
    status: "HELD",
    expiresAt: null,
    ...overrides,
  };
}

describe("planCouponReconcile", () => {
  it("가입 폼 미완료 회원에게는 아무것도 발급하지 않는다", () => {
    const plan = planCouponReconcile(makeInput({ profileCompleted: false }));
    expect(plan.issue).toEqual([]);
  });

  it("가입 폼을 완료했고 계약이 없으면 첫가입 쿠폰만 HELD 로 발급한다", () => {
    const plan = planCouponReconcile(makeInput());
    expect(plan.issue).toHaveLength(1);
    expect(plan.issue[0]).toMatchObject({
      policyId: "policy-signup",
      status: "HELD",
      titleSnapshot: "첫가입 축하 주유권",
      rewardLabelSnapshot: "주유권 10만원",
      rewardAmountSnapshot: 100_000,
      qualifiedQuoteId: null,
    });
  });

  it("validDays 로 만료일을 계산한다", () => {
    const plan = planCouponReconcile(makeInput());
    expect(plan.issue[0]?.expiresAt).toEqual(new Date("2026-11-04T00:00:00.000Z"));
  });

  it("validDays 가 null 이면 만료일이 없다", () => {
    const plan = planCouponReconcile(makeInput({ convertedQuoteId: "quote-1" }));
    const contract = plan.issue.find((item) => item.policyId === "policy-contract");
    expect(contract?.expiresAt).toBeNull();
  });

  it("계약이 있으면 첫계약 쿠폰을 처음부터 PENDING 으로 발급한다", () => {
    const plan = planCouponReconcile(makeInput({ convertedQuoteId: "quote-1" }));
    const contract = plan.issue.find((item) => item.policyId === "policy-contract");
    expect(contract).toMatchObject({ status: "PENDING", qualifiedQuoteId: "quote-1" });
  });

  it("계약이 있으면 첫가입 쿠폰도 PENDING 으로 발급한다", () => {
    const plan = planCouponReconcile(makeInput({ convertedQuoteId: "quote-1" }));
    const signup = plan.issue.find((item) => item.policyId === "policy-signup");
    expect(signup).toMatchObject({ status: "PENDING", qualifiedQuoteId: "quote-1" });
  });

  it("이미 보유한 정책은 다시 발급하지 않는다", () => {
    const plan = planCouponReconcile(makeInput({ coupons: [heldSignup()] }));
    expect(plan.issue.map((item) => item.policyId)).not.toContain("policy-signup");
  });

  it("계약이 생기면 보유 중인 HELD 를 PENDING 으로 올린다", () => {
    const plan = planCouponReconcile(
      makeInput({ convertedQuoteId: "quote-1", coupons: [heldSignup()] })
    );
    expect(plan.qualify).toEqual(["coupon-1"]);
  });

  it("계약이 철회되면 PENDING 을 HELD 로 되돌린다", () => {
    const plan = planCouponReconcile(
      makeInput({ coupons: [heldSignup({ status: "PENDING" })] })
    );
    expect(plan.unqualify).toEqual(["coupon-1"]);
  });

  it("계약이 철회돼도 PAID 는 건드리지 않는다", () => {
    const plan = planCouponReconcile(
      makeInput({ coupons: [heldSignup({ status: "PAID" })] })
    );
    expect(plan.unqualify).toEqual([]);
    expect(plan.expire).toEqual([]);
  });

  it("만료일이 지난 HELD 를 EXPIRED 로 만든다", () => {
    const plan = planCouponReconcile(
      makeInput({ coupons: [heldSignup({ expiresAt: new Date("2026-08-05T00:00:00.000Z") })] })
    );
    expect(plan.expire).toEqual(["coupon-1"]);
  });

  it("만료일이 지나도 PENDING 은 만료시키지 않는다", () => {
    const plan = planCouponReconcile(
      makeInput({
        convertedQuoteId: "quote-1",
        coupons: [heldSignup({ status: "PENDING", expiresAt: new Date("2026-08-05T00:00:00.000Z") })],
      })
    );
    expect(plan.expire).toEqual([]);
  });

  it("비활성 정책은 신규 발급하지 않는다", () => {
    const plan = planCouponReconcile(
      makeInput({ policies: [{ ...signupPolicy, isActive: false }] })
    );
    expect(plan.issue).toEqual([]);
  });

  it("노출 기간이 끝난 정책은 신규 발급하지 않는다", () => {
    const plan = planCouponReconcile(
      makeInput({ policies: [{ ...signupPolicy, endsAt: new Date("2026-08-05T00:00:00.000Z") }] })
    );
    expect(plan.issue).toEqual([]);
  });

  it("노출 시작 전 정책은 신규 발급하지 않는다", () => {
    const plan = planCouponReconcile(
      makeInput({ policies: [{ ...signupPolicy, startsAt: new Date("2026-09-01T00:00:00.000Z") }] })
    );
    expect(plan.issue).toEqual([]);
  });

  it("정책이 비활성이어도 이미 발급된 쿠폰의 전이는 계속 처리한다", () => {
    const plan = planCouponReconcile(
      makeInput({
        convertedQuoteId: "quote-1",
        policies: [{ ...signupPolicy, isActive: false }],
        coupons: [heldSignup()],
      })
    );
    expect(plan.qualify).toEqual(["coupon-1"]);
  });

  it("입력 배열을 변형하지 않는다", () => {
    const coupons = [heldSignup()];
    const snapshot = JSON.stringify(coupons);
    planCouponReconcile(makeInput({ convertedQuoteId: "quote-1", coupons }));
    expect(JSON.stringify(coupons)).toBe(snapshot);
  });
});
