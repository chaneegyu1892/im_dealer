// .env 를 다른 import 보다 먼저 로드 (ESM 호이스팅 — load-env 가 항상 첫 import 여야 함)
import "./load-env";
import puppeteer, { type Browser } from "puppeteer";
import { z } from "zod";

import { decryptString } from "../../src/lib/pii";
import type { CatalogJobParams, CatalogProgress, CatalogTrimEntry, ScrapeJobParams, TrimScrapeResult } from "../../src/types/scraper";
import { buildDraftFromTrimResults } from "./mapping";
import { buildBrowserLaunchArgs } from "./browser-launch";
import { createCatalogResultBuffer } from "./catalog-buffer";
import { resolveAdapter } from "./adapters/registry";
import { AuthError } from "./adapters/types";
import type { AdapterContext } from "./adapters/types";
import { claimJob, getCollectedMdelCds, heartbeat, postCatalogResults, postResult, type ClaimedJob, type ClaimedCredential } from "./api-client";

const POLL_MS = Number(process.env.SCRAPER_POLL_MS ?? 5000);
const HEADFUL = process.env.SCRAPER_HEADFUL === "true";
const KEEPALIVE_MS = Number(process.env.SCRAPER_KEEPALIVE_MS ?? 120000); // 2분
const HEARTBEAT_MS = 30000;
const REQUEST_DELAY_MS = Number(process.env.SCRAPER_REQUEST_DELAY_MS ?? 2000); // 트림 간 지연(기본 2s)
const JOB_COOLDOWN_MS = Number(process.env.SCRAPER_JOB_COOLDOWN_MS ?? 30000); // 작업 간 쿨다운(기본 30s) — 볼륨 집중/버스트 완화
// 사람 속도 모사 + 탐지 footprint 완화용 랜덤 지터: base ~ base*1.6
const jitter = (base: number) => base + Math.floor(Math.random() * base * 0.6);

const scrapeJobParamsSchema = z.object({
  trimIds: z.array(z.string().min(1)),
  vehicleId: z.string().min(1),
  lineupIds: z.array(z.string().min(1)),
  weekOf: z.string().min(1),
  minVehiclePrice: z.number().nonnegative(),
  maxVehiclePrice: z.number().nonnegative(),
  scraperRef: z.object({ brandCd: z.string(), modelName: z.string() }).optional(),
  trims: z.array(z.object({ trimId: z.string(), name: z.string() })).optional(),
});

const catalogJobParamsSchema = z.object({
  mode: z.literal("catalog"),
  brands: z.array(z.object({ brandCd: z.string().min(1), name: z.string().min(1) })),
  weekOf: z.string().min(1),
  productType: z.string().min(1),
});

class CanceledError extends Error {
  constructor() {
    super("작업이 취소되었습니다.");
    this.name = "CanceledError";
  }
}

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

function requireEnv(): void {
  const missing = ["PII_ENCRYPTION_KEY", "SCRAPER_WORKER_SECRET", "WORKER_API_BASE"].filter(
    (k) => !process.env[k]
  );
  if (missing.length) {
    console.error(`[worker] 필수 환경변수 누락: ${missing.join(", ")} (scripts/scraper-worker/.env 확인)`);
    process.exit(1);
  }
}

async function runJob(job: ClaimedJob, credential: ClaimedCredential): Promise<void> {
  const log = (msg: string) => console.log(`[job ${job.id}] ${msg}`);

  const username = decryptString(credential.usernameEnc);
  const password = decryptString(credential.passwordEnc);
  if (!username || !password) {
    await postResult(job.id, { ok: false, error: "자격증명 복호화 실패 (PII_ENCRYPTION_KEY 불일치 가능)" });
    return;
  }

  const adapter = resolveAdapter(credential.config, credential.loginUrl);
  if (!adapter) {
    await postResult(job.id, { ok: false, error: "해당 캐피탈사에 맞는 어댑터가 없습니다." });
    return;
  }

  let canceled = false;
  let pageBusy = false;
  let currentProgress: CatalogProgress | null = null; // catalog 잡 진행률 (하트비트에 동봉)
  const paramsResult = job.jobType === "catalog"
    ? catalogJobParamsSchema.safeParse(job.params)
    : scrapeJobParamsSchema.safeParse(job.params);
  if (!paramsResult.success) {
    await postResult(job.id, { ok: false, error: "작업 파라미터가 올바르지 않습니다." });
    return;
  }
  const params: CatalogJobParams | ScrapeJobParams = paramsResult.data;

  const headless = !(credential.requiresHuman || HEADFUL);
  log(`브라우저 실행 (headless=${headless})`);
  const browser: Browser = await puppeteer.launch({
    headless,
    args: buildBrowserLaunchArgs({
      nodeEnv: process.env.NODE_ENV,
      disableSandbox: process.env.SCRAPER_DISABLE_SANDBOX === "true",
    }),
    executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
  });

  const heartbeatTimer = setInterval(async () => {
    try {
      const status = await heartbeat(job.id, currentProgress ? { progress: currentProgress } : undefined);
      if (status === "canceled") canceled = true;
    } catch (e) {
      log(`하트비트 오류: ${(e as Error).message}`);
    }
  }, HEARTBEAT_MS);

  let keepAliveTimer: ReturnType<typeof setInterval> | null = null;

  try {
    const page = await browser.newPage();

    const ctx: AdapterContext = {
      page,
      credentials: { username, password, loginUrl: credential.loginUrl },
      config: credential.config,
      params,
      log,
      isCanceled: () => canceled,
      waitForHuman: async (prompt: string) => {
        log(`사람 개입 대기: ${prompt}`);
        await heartbeat(job.id, { status: "needs_human", humanPrompt: prompt });
        // 어드민이 [재개] → running 으로 바뀔 때까지 폴링
        for (;;) {
          await sleep(3000);
          let status: string;
          try {
            status = await heartbeat(job.id);
          } catch {
            continue;
          }
          if (status === "canceled") {
            canceled = true;
            throw new CanceledError();
          }
          if (status === "running") {
            log("재개 신호 수신 — 계속 진행");
            return;
          }
        }
      },
    };

    // 세션 연장 인터벌 (페이지 점유 중에는 건너뜀)
    keepAliveTimer = setInterval(async () => {
      if (pageBusy || canceled) return;
      pageBusy = true;
      try {
        await adapter.keepAlive(ctx);
      } catch (e) {
        log(`연장 오류: ${(e as Error).message}`);
      } finally {
        pageBusy = false;
      }
    }, KEEPALIVE_MS);

    // 로그인
    pageBusy = true;
    await adapter.login(ctx);
    pageBusy = false;
    if (canceled) throw new CanceledError();

    if (job.jobType === "catalog") {
      // ── 카탈로그 전량 수집: 어댑터가 순회, 워커가 버퍼링/증분 flush ──
      if (!adapter.scrapeCatalog) {
        await postResult(job.id, { ok: false, error: "이 캐피탈사 어댑터는 카탈로그 수집을 지원하지 않습니다." });
        return;
      }
      if (!("mode" in params)) {
        throw new Error("카탈로그 작업 파라미터 종류가 일치하지 않습니다.");
      }
      const cParams = params;
      // 재개 지원: 이번주 이미 수집된 외부 트림코드는 스킵
      const collected = new Set(await getCollectedMdelCds(job.financeCompanyId, cParams.productType, cParams.weekOf));
      if (collected.size > 0) log(`이번주 기수집 ${collected.size}건 — 스킵하고 이어서 수집`);

      const resultBuffer = createCatalogResultBuffer<CatalogTrimEntry>(async (entries) => {
          await postCatalogResults({
            jobId: job.id, financeCompanyId: job.financeCompanyId,
            productType: cParams.productType, weekOf: cParams.weekOf, entries,
          });
      });
      const flush = async (required: boolean): Promise<void> => {
        const count = resultBuffer.size();
        const saved = await resultBuffer.flush({ required });
        if (saved && count > 0) log(`증분 저장 ${count}건`);
        if (!saved) log(`증분 저장 실패(${resultBuffer.size()}건 보류) — 다음 flush에서 재시도`);
      };

      pageBusy = true; // 어댑터가 세션을 계속 사용 — keepAlive 불필요(API 호출 자체가 세션 활동)
      let summary;
      try {
        summary = await adapter.scrapeCatalog(ctx, {
          brands: cParams.brands,
          isCollected: (mdelCd) => collected.has(mdelCd),
          onTrimResult: async (entry) => {
            resultBuffer.add(entry);
            if (resultBuffer.size() >= 20) await flush(false);
          },
          onModelDone: async () => flush(false),
          onProgress: (p) => { currentProgress = p; },
        });
      } finally {
        pageBusy = false;
        await flush(true);
      }
      if (canceled) throw new CanceledError();
      await postResult(job.id, {
        ok: true,
        catalogSummary: { mode: "catalog", ...summary, finishedAt: new Date().toISOString() },
      });
      log(`카탈로그 완료 — 수집 ${summary.total}건, 스킵 ${summary.skipped}건, 실패 ${summary.failed}건`);
    } else {
      // ── 기존 trim_rates: 지정 트림 수집 → 라인업 min/max 초안 ──
      if ("mode" in params) {
        throw new Error("트림 수집 작업 파라미터 종류가 일치하지 않습니다.");
      }
      const results: TrimScrapeResult[] = [];
      for (const trimId of params.trimIds) {
        if (canceled) throw new CanceledError();
        pageBusy = true;
        try {
          const r = await adapter.scrapeTrim(ctx, trimId);
          results.push(r);
          log(`트림 수집: ${trimId} (${r.matchConfidence})`);
        } finally {
          pageBusy = false;
        }
        await sleep(jitter(REQUEST_DELAY_MS)); // 트림 간 지연 + 랜덤 지터 (사람 속도 모사)
      }

      const draft = buildDraftFromTrimResults(
        results,
        params,
        job.productType,
        new Date().toISOString()
      );
      await postResult(job.id, { ok: true, draft });
      log(`완료 — 트림 ${results.length}건, 경고 ${draft.warnings.length}건`);
    }
  } catch (e) {
    if (e instanceof CanceledError) {
      log("취소됨");
    } else {
      const msg = (e as Error).message ?? String(e);
      const authFailed = e instanceof AuthError; // 자격증명 오류 → 차단기 작동(재시도 금지·자격증명 비활성화)
      log(authFailed ? `[차단기] 인증 실패 — 자격증명 비활성화 요청: ${msg}` : `실패: ${msg}`);
      try {
        await postResult(job.id, { ok: false, error: msg.slice(0, 500), ...(authFailed ? { authFailed: true } : {}) });
      } catch {
        /* 보고 실패는 무시 */
      }
    }
  } finally {
    clearInterval(heartbeatTimer);
    if (keepAliveTimer) clearInterval(keepAliveTimer);
    await browser.close().catch(() => null);
  }
}

async function main(): Promise<void> {
  requireEnv();
  console.log(`[worker] 시작 — API=${process.env.WORKER_API_BASE} poll=${POLL_MS}ms headful=${HEADFUL}`);
  for (;;) {
    try {
      const claimed = await claimJob();
      if (claimed) {
        console.log(`[worker] 작업 클레임: ${claimed.job.id} (캐피탈사 ${claimed.job.financeCompanyId})`);
        await runJob(claimed.job, claimed.credential);
        // 작업 간 쿨다운(분산) — 큐에 여러 작업이 있어도 몰아치지 않고 사람처럼 간격을 둠
        await sleep(jitter(JOB_COOLDOWN_MS));
      }
    } catch (e) {
      console.error(`[worker] 루프 오류: ${(e as Error).message}`);
    }
    await sleep(POLL_MS);
  }
}

main().catch((e) => {
  console.error("[worker] 치명적 오류:", e);
  process.exit(1);
});
