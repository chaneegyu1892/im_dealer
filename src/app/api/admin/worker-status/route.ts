// 수집 PC(워커)가 지금 켜져 있는지 알려준다.
// 워커가 꺼진 줄 모르고 작업을 만들어 놓고 기다리는 상황을 막기 위한 화면 표시용.

import { NextResponse } from "next/server";
import { requireRoleAtLeast } from "@/lib/require-admin";
import { getWorkerPresence } from "@/lib/scraper/worker-presence";

export async function GET() {
  const { error } = await requireRoleAtLeast("staff");
  if (error) return error;

  return NextResponse.json(await getWorkerPresence());
}
