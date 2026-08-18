import "@testing-library/jest-dom";

// XFF 헤더를 주입하는 테스트는 신뢰 프록시 배포(운영) 환경을 시뮬레이션한다.
// src/lib/client-ip.ts 는 TRUST_PROXY/VERCEL 없이는 x-forwarded-for 를 무시한다.
process.env.TRUST_PROXY = "true";

// hashIp 는 운영 솔트 폴백을 제공하지 않는다 — 테스트용 솔트를 명시적으로 부여.
// (실제 env 가 있으면 그 값을 존중한다)
process.env.IP_HASH_SALT ??= "vitest-ip-hash-salt-0123456789";
