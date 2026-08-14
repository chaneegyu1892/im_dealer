// 아임딜러 앱(Vercel)과의 통신. 릴레이는 앱을 향해 나가는 연결만 사용한다
// — 인바운드가 없으므로 이 서버에 도메인·TLS·방화벽 개방이 필요 없다.

import type {
  AlimtalkAcceptReport,
  AlimtalkClaimedMessage,
  AlimtalkResultReport,
} from "../../src/lib/alimtalk/types";

const REQUEST_TIMEOUT_MS = 30_000;

function base(): string {
  return (process.env.APP_BASE_URL ?? "").replace(/\/+$/, "");
}

async function post(path: string, body: unknown): Promise<unknown> {
  const res = await fetch(`${base()}${path}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${process.env.ALIMTALK_RELAY_SECRET}`,
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  if (!res.ok) {
    throw new Error(`앱 ${path} HTTP ${res.status}: ${(await res.text()).slice(0, 300)}`);
  }
  return res.json();
}

export async function claimMessages(): Promise<AlimtalkClaimedMessage[]> {
  const body = await post("/api/worker/alimtalk/claim", {});
  const messages = (body as { messages?: unknown }).messages;
  return Array.isArray(messages) ? (messages as AlimtalkClaimedMessage[]) : [];
}

export async function reportAccepted(reports: AlimtalkAcceptReport[]): Promise<void> {
  if (reports.length === 0) return;
  await post("/api/worker/alimtalk/accept", { reports });
}

export async function reportResults(results: AlimtalkResultReport[]): Promise<void> {
  if (results.length === 0) return;
  await post("/api/worker/alimtalk/result", { results });
}
