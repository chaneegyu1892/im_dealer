// 워커 셋업 검증용. 실제 작업은 하지 않고 "제대로 연결됐는지"만 알려준다.
//
// 새 PC 에서 워커를 띄울 때 흔한 실패 세 가지를 한 번에 잡는다:
//   1) 백엔드 주소 오타      → 요청 자체가 실패
//   2) 워커 시크릿 불일치     → 401
//   3) PII 암호화 키 불일치   → keyFingerprint 가 다름
//
// 3번이 특히 중요하다. 키가 틀려도 워커는 크래시하지 않고 job 을 받은 뒤에야
// 복호화에 실패해 조용히 끝나기 때문에, 원인을 찾기가 매우 어렵다.

import { NextResponse, type NextRequest } from "next/server";
import { requireWorker } from "@/lib/worker-auth";
import { keyFingerprint } from "@/lib/scraper/key-fingerprint";

export async function GET(request: NextRequest) {
  const { error } = requireWorker(request);
  if (error) return error;

  const fingerprint = keyFingerprint(process.env.PII_ENCRYPTION_KEY);

  return NextResponse.json({
    ok: true,
    // 키 미설정이면 null — 워커가 "백엔드에 키가 없다"고 구분해 안내할 수 있다.
    keyFingerprint: fingerprint,
    serverTime: new Date().toISOString(),
  });
}
