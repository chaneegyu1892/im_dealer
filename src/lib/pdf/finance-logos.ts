import { prisma } from "@/lib/prisma";

/** 한 로고를 받아오는 최대 대기 시간(ms). 초과 시 해당 로고만 생략한다. */
const FETCH_TIMEOUT_MS = 4000;
const ALLOWED_IMAGE_MIME = new Set(["image/png", "image/jpeg", "image/webp", "image/gif"]);

/**
 * 원격 로고 URL 을 data URI 로 받아온다.
 * 실패(네트워크/타임아웃/비이미지)하면 null 을 반환해 해당 로고만 생략한다.
 * → 로고 한 개가 깨져도 PDF 전체 렌더는 영향받지 않는다.
 */
async function fetchLogoDataUri(url: string): Promise<string | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) return null;

    const mime = (res.headers.get("content-type") ?? "").split(";")[0].trim().toLowerCase();
    if (!ALLOWED_IMAGE_MIME.has(mime)) return null;

    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.byteLength === 0) return null;

    return `data:${mime};base64,${buf.toString("base64")}`;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * 주어진 금융사명에 대해 DB 에 등록된 로고를 조회·프리페치해
 * `금융사명 → data URI` 맵으로 반환한다. (react-pdf <Image src> 에 그대로 사용)
 *
 * - logoUrl 이 없는 금융사는 결과에서 제외 → 로고 없이 이름만 표시된다.
 * - 어드민에서 로고를 업로드/교체하면 별도 배포 없이 다음 견적서부터 자동 반영된다.
 */
export async function resolveFinanceLogos(
  names: readonly string[]
): Promise<Record<string, string>> {
  const uniqueNames = [...new Set(names.filter((n) => n))];
  if (uniqueNames.length === 0) return {};

  const companies = await prisma.financeCompany.findMany({
    where: { name: { in: uniqueNames }, logoUrl: { not: null } },
    select: { name: true, logoUrl: true },
  });

  const entries = await Promise.all(
    companies.map(async (c) => {
      const dataUri = c.logoUrl ? await fetchLogoDataUri(c.logoUrl) : null;
      return dataUri ? ([c.name, dataUri] as const) : null;
    })
  );

  const out: Record<string, string> = {};
  for (const entry of entries) {
    if (entry) out[entry[0]] = entry[1];
  }
  return out;
}
