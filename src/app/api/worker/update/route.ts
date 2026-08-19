import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { NextResponse, type NextRequest } from "next/server";
import { requireWorker } from "@/lib/worker-auth";
import { WORKER_PROTOCOL_VERSION } from "@/lib/scraper/worker-version";

// GET /api/worker/update — 워커 자동 업데이트용 코드 zip.
// 빌드 시 scripts/make-worker-dist.mjs 가 만든 worker-dist/worker.zip 을 내려준다.
// 소스 코드이므로 반드시 워커 시크릿 인증 뒤에만 응답한다.
export async function GET(request: NextRequest) {
  const { error } = requireWorker(request);
  if (error) return error;

  try {
    const zip = await readFile(join(process.cwd(), "worker-dist", "worker.zip"));
    return new NextResponse(new Uint8Array(zip), {
      headers: {
        "content-type": "application/zip",
        "content-disposition": 'attachment; filename="worker.zip"',
        "x-worker-protocol-version": String(WORKER_PROTOCOL_VERSION),
        "cache-control": "no-store",
      },
    });
  } catch (e) {
    console.error("[worker update GET]", e);
    return NextResponse.json(
      { error: "업데이트 파일이 없습니다. 빌드에 make-worker-dist 가 포함됐는지 확인하세요." },
      { status: 404 }
    );
  }
}
