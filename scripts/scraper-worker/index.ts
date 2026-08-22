// .env 를 다른 import 보다 먼저 로드 (ESM 호이스팅 — load-env 가 항상 첫 import 여야 함)
import "./load-env";
import puppeteer, { type Browser } from "puppeteer";
import { z } from "zod";

import { decryptString } from "../../src/lib/pii";
import { keyFingerprint } from "../../src/lib/scraper/key-fingerprint";
import { WORKER_PROTOCOL_VERSION } from "../../src/lib/scraper/worker-version";
import type { CatalogJobParams, CatalogProgress, CatalogTrimEntry, ModelsJobParams, ScrapeJobParams, TrimScrapeResult } from "../../src/types/scraper";
import { buildDraftFromTrimResults } from "./mapping";
import { buildBrowserLaunchArgs } from "./browser-launch";
import { createCatalogResultBuffer } from "./catalog-buffer";
import { resolveAdapter } from "./adapters/registry";
import { AuthError } from "./adapters/types";
import type { AdapterContext } from "./adapters/types";
import { createApiClient, parseApiBases, type ApiClient, type ClaimedJob, type ClaimedCredential } from "./api-client";
import { shouldApplyJobCooldown, type JobOutcome } from "./job-outcome";
import { SAFE_PACE } from "./pace";

const POLL_MS = Number(process.env.SCRAPER_POLL_MS ?? 5000);
const HEADFUL = process.env.SCRAPER_HEADFUL === "true";
const KEEPALIVE_MS = Number(process.env.SCRAPER_KEEPALIVE_MS ?? 120000); // 2분
// 하트비트 겸 취소 감지 주기. 짧을수록 [취소] 후 브라우저를 더 빨리 닫고 다음 작업을 잡는다.
const HEARTBEAT_MS = Number(process.env.SCRAPER_HEARTBEAT_MS ?? 10000);
// 트림 간 지연·작업 간 쿨다운. 기본은 빠름 — SCRAPER_PACE=safe 면 예전 값(2s/30s)으로 복귀한다.
const REQUEST_DELAY_MS = Number(process.env.SCRAPER_REQUEST_DELAY_MS ?? (SAFE_PACE ? 2000 : 300));
const JOB_COOLDOWN_MS = Number(process.env.SCRAPER_JOB_COOLDOWN_MS ?? (SAFE_PACE ? 30000 : 5000)); // 볼륨 집중/버스트 완화
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
  brands: z.array(
    z.object({
      brandCd: z.string().min(1),
      name: z.string().min(1),
      modelCds: z.array(z.string().min(1)).optional(), // 있으면 그 모델만 수집
    })
  ),
  weekOf: z.string().min(1),
  productType: z.string().min(1),
});

const modelsJobParamsSchema = z.object({
  mode: z.literal("models"),
  brands: z.array(z.object({ brandCd: z.string().min(1), name: z.string().min(1) })),
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

/**
 * 백엔드와 실제로 통할 수 있는지 job 을 가져오기 전에 확인한다.
 *
 * 특히 PII_ENCRYPTION_KEY 불일치는 크래시를 내지 않고 job 을 하나 소비한 뒤에야
 * "자격증명 복호화 실패"로 끝나기 때문에, 여기서 미리 걸러야 원인을 알 수 있다.
 * 백엔드가 구버전이라 preflight 라우트가 없으면(404) 경고만 남기고 계속 진행한다.
 *
 * 통과하면 true. 실패 시 즉시 exit 하지 않고 false 를 돌려 main 이 정상 종료하게 한다
 * (열린 fetch 핸들 위에서 process.exit 하면 Windows 에서 libuv assertion 이 뜬다).
 */
async function preflight(base: string): Promise<boolean> {
  try {
    const res = await fetch(`${base}/api/worker/preflight`, {
      headers: { authorization: `Bearer ${process.env.SCRAPER_WORKER_SECRET}` },
    });

    if (res.status === 404) {
      console.warn(`[worker] ${base}: preflight 라우트 없음(구버전 백엔드) — 점검을 건너뜁니다.`);
      return true;
    }
    if (res.status === 401) {
      console.error(`[worker] ${base}: 인증 실패 — SCRAPER_WORKER_SECRET 이 이 서버 값과 다릅니다.`);
      return false;
    }
    if (!res.ok) {
      console.error(`[worker] ${base}: preflight 실패 — HTTP ${res.status}`);
      return false;
    }

    const { keyFingerprint: serverKey, expectedWorkerVersion } = (await res.json()) as {
      keyFingerprint: string | null;
      expectedWorkerVersion?: number;
    };
    const localKey = keyFingerprint(process.env.PII_ENCRYPTION_KEY);

    if (expectedWorkerVersion !== undefined && expectedWorkerVersion !== WORKER_PROTOCOL_VERSION) {
      console.error(
        `[worker] ${base}: 프로그램이 오래되었습니다 (이 프로그램 v${WORKER_PROTOCOL_VERSION} / 서버 요구 v${expectedWorkerVersion}).\n` +
          "        '수집 시작.bat' 을 다시 실행하면 자동으로 업데이트됩니다.\n" +
          "        접속 정보는 유지되므로 다시 입력하지 않아도 됩니다."
      );
      return false;
    }

    if (serverKey && localKey && serverKey !== localKey) {
      console.error(
        `[worker] ${base}: PII_ENCRYPTION_KEY 불일치 (워커 ${localKey} ≠ 백엔드 ${serverKey}).\n` +
          "        이대로 실행하면 job 을 받아도 자격증명 복호화에 실패합니다.\n" +
          "        백엔드의 PII_ENCRYPTION_KEY 를 그대로 복사해 넣으세요. (`pnpm scraper:doctor` 로 재점검)"
      );
      return false;
    }
    console.log(`[worker] ${base}: preflight 통과 (키 지문 ${localKey ?? "?"})`);
    return true;
  } catch (error) {
    console.error(
      `[worker] 백엔드에 연결할 수 없습니다: ${base}\n` +
        `        ${error instanceof Error ? error.message : "알 수 없는 오류"}\n` +
        "        WORKER_API_BASE 가 맞는지, 백엔드가 떠 있는지 확인하세요."
    );
    return false;
  }
}

async function runJob(job: ClaimedJob, credential: ClaimedCredential, api: ApiClient): Promise<JobOutcome> {
  const log = (msg: string) => console.log(`[job ${job.id}] ${msg}`);

  // requiresHuman 캐피탈사(키패드·SMS)는 어댑터가 자격증명을 쓰지 않고 사람에게 로그인을 넘긴다.
  // 그런 곳은 서버가 애초에 자격증명을 저장하지 않으므로 빈 값이 정상이다.
  const hasCiphertext = Boolean(credential.usernameEnc && credential.passwordEnc);
  const username = decryptString(credential.usernameEnc) ?? "";
  const password = decryptString(credential.passwordEnc) ?? "";
  if (!credential.requiresHuman && (!username || !password)) {
    // 암호문 유무로 원인을 갈라 준다. 둘을 같은 메시지로 뭉뚱그리면
    // 실제로는 워커가 옛 코드인데 키 문제로 오진하게 된다.
    await api.postResult(job.id, job.leaseToken, {
      ok: false,
      error: hasCiphertext
        ? "자격증명 복호화 실패 (PII_ENCRYPTION_KEY 불일치 가능)"
        : "이 작업에 자격증명이 없습니다. 워커가 옛 버전일 수 있으니 재시작 후 다시 시도하세요.",
    });
    return "failed";
  }

  const adapter = resolveAdapter(credential.config, credential.loginUrl);
  if (!adapter) {
    await api.postResult(job.id, job.leaseToken, { ok: false, error: "해당 캐피탈사에 맞는 어댑터가 없습니다." });
    return "failed";
  }

  let canceled = false;
  let pageBusy = false;
  let currentProgress: CatalogProgress | null = null; // catalog 잡 진행률 (하트비트에 동봉)
  const paramsResult = job.jobType === "catalog"
    ? catalogJobParamsSchema.safeParse(job.params)
    : job.jobType === "models"
      ? modelsJobParamsSchema.safeParse(job.params)
      : scrapeJobParamsSchema.safeParse(job.params);
  if (!paramsResult.success) {
    await api.postResult(job.id, job.leaseToken, { ok: false, error: "작업 파라미터가 올바르지 않습니다." });
    return "failed";
  }
  const params: CatalogJobParams | ModelsJobParams | ScrapeJobParams = paramsResult.data;

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

  // 응답 지연 시 이전 heartbeat가 아직 진행 중일 수 있다 — 겹치면 서버 혼란만 키우므로 스킵.
  let heartbeatInFlight = false;
  const heartbeatTimer = setInterval(async () => {
    if (heartbeatInFlight) return;
    heartbeatInFlight = true;
    try {
      const status = await api.heartbeat(job.id, job.leaseToken, currentProgress ? { progress: currentProgress } : undefined);
      if (status === "canceled") canceled = true;
    } catch (e) {
      log(`하트비트 오류: ${(e as Error).message}`);
    } finally {
      heartbeatInFlight = false;
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
        await api.heartbeat(job.id, job.leaseToken, { status: "needs_human", humanPrompt: prompt });
        // 어드민이 [재개] → running 으로 바뀔 때까지 폴링
        for (;;) {
          await sleep(3000);
          let status: string;
          try {
            status = await api.heartbeat(job.id, job.leaseToken);
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

    if (job.jobType === "models") {
      // ── 차량(모델) 목록만 동기화: 트림 견적 없이 목록만 — 브랜드당 수 초 ──
      if (!adapter.listModels) {
        await api.postResult(job.id, job.leaseToken, { ok: false, error: "이 캐피탈사 어댑터는 차량 목록 조회를 지원하지 않습니다." });
        return "failed";
      }
      if (!("mode" in params) || params.mode !== "models") {
        throw new Error("차량 목록 작업 파라미터 종류가 일치하지 않습니다.");
      }
      const mParams = params;

      pageBusy = true; // 어댑터가 세션을 계속 사용 — API 호출 자체가 세션 활동
      let summary;
      try {
        summary = await adapter.listModels(ctx, {
          brands: mParams.brands,
          onBrandModels: async (brand, models) => {
            await api.postModelResults({
              jobId: job.id, leaseToken: job.leaseToken, financeCompanyId: job.financeCompanyId,
              productType: mParams.productType, brandCd: brand.brandCd, brandName: brand.name, models,
            });
          },
        });
      } finally {
        pageBusy = false;
      }
      if (canceled) throw new CanceledError();
      await api.postResult(job.id, job.leaseToken, {
        ok: true,
        modelsSummary: { mode: "models", ...summary, finishedAt: new Date().toISOString() },
      });
      log(`차량 목록 완료 — ${summary.total}개 (브랜드 ${summary.brands.length}개)`);
    } else if (job.jobType === "catalog") {
      // ── 카탈로그 전량 수집: 어댑터가 순회, 워커가 버퍼링/증분 flush ──
      if (!adapter.scrapeCatalog) {
        await api.postResult(job.id, job.leaseToken, { ok: false, error: "이 캐피탈사 어댑터는 카탈로그 수집을 지원하지 않습니다." });
        return "failed";
      }
      if (!("mode" in params) || params.mode !== "catalog") {
        throw new Error("카탈로그 작업 파라미터 종류가 일치하지 않습니다.");
      }
      const cParams = params;
      // 재개 지원: 이번주 이미 수집된 외부 트림코드는 스킵
      const collected = new Set(await api.getCollectedMdelCds(
        job.id,
        job.leaseToken,
        job.financeCompanyId,
        cParams.productType,
        cParams.weekOf
      ));
      if (collected.size > 0) log(`이번주 기수집 ${collected.size}건 — 스킵하고 이어서 수집`);

      const resultBuffer = createCatalogResultBuffer<CatalogTrimEntry>(async (entries) => {
          const { ignored } = await api.postCatalogResults({
            jobId: job.id, leaseToken: job.leaseToken, financeCompanyId: job.financeCompanyId,
            productType: cParams.productType, weekOf: cParams.weekOf, entries,
          });
          // 취소된 잡의 마지막 flush 는 서버가 버린다 — "저장됨"으로 오인하지 않게 명시한다.
          if (ignored) log(`저장 무시됨(작업이 이미 종료 상태) — ${entries.length}건은 저장되지 않았습니다`);
      });
      const flush = async (required: boolean): Promise<void> => {
        const count = resultBuffer.size();
        const saved = await resultBuffer.flush({ required });
        if (saved && count > 0) log(`증분 저장 ${count}건`);
        if (!saved) log(`증분 저장 실패(${resultBuffer.size()}건 보류) — 다음 flush에서 재시도`);
      };

      // 완료 요약용: 이번 실행에서 실제 수집된 차량별 트림 수 (스킵분 제외).
      // 어댑터를 건드리지 않고 entry 스트림에서 집계한다 — entry 에 브랜드·모델명이 실려 온다.
      const modelCounts = new Map<string, { brandName: string; modelName: string; trims: number }>();

      pageBusy = true; // 어댑터가 세션을 계속 사용 — keepAlive 불필요(API 호출 자체가 세션 활동)
      let summary;
      try {
        summary = await adapter.scrapeCatalog(ctx, {
          brands: cParams.brands,
          isCollected: (mdelCd) => collected.has(mdelCd),
          onTrimResult: async (entry) => {
            const key = `${entry.brandName} ${entry.modelName}`;
            const m = modelCounts.get(key) ?? { brandName: entry.brandName, modelName: entry.modelName, trims: 0 };
            m.trims++;
            modelCounts.set(key, m);
            resultBuffer.add(entry);
            // 5건마다 저장 — 트림당 수 분 걸리는 날(느린 우리금융 등)엔 20건을 모으면
            // 중단 시 손실이 크고 화면에도 한참 아무것도 안 보인다.
            if (resultBuffer.size() >= 5) await flush(false);
          },
          onModelDone: async () => flush(false),
          onProgress: (p) => { currentProgress = p; },
        });
      } finally {
        pageBusy = false;
        await flush(true);
      }
      if (canceled) throw new CanceledError();
      await api.postResult(job.id, job.leaseToken, {
        ok: true,
        catalogSummary: {
          mode: "catalog",
          ...summary,
          models: [...modelCounts.values()],
          finishedAt: new Date().toISOString(),
        },
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
      await api.postResult(job.id, job.leaseToken, { ok: true, draft });
      log(`완료 — 트림 ${results.length}건, 경고 ${draft.warnings.length}건`);
    }
    return "completed";
  } catch (e) {
    if (e instanceof CanceledError) {
      log("취소됨");
      return "canceled";
    }
    const msg = (e as Error).message ?? String(e);
    const authFailed = e instanceof AuthError; // 자격증명 오류 → 차단기 작동(재시도 금지·자격증명 비활성화)
    log(authFailed ? `[차단기] 인증 실패 — 자격증명 비활성화 요청: ${msg}` : `실패: ${msg}`);
    try {
      await api.postResult(job.id, job.leaseToken, { ok: false, error: msg.slice(0, 500), ...(authFailed ? { authFailed: true } : {}) });
    } catch {
      /* 보고 실패는 무시 */
    }
    return "failed";
  } finally {
    clearInterval(heartbeatTimer);
    if (keepAliveTimer) clearInterval(keepAliveTimer);
    await browser.close().catch(() => null);
  }
}

async function main(): Promise<void> {
  requireEnv();

  // WORKER_API_BASE 는 쉼표로 여러 서버를 받을 수 있다(운영·테스트 동시 서빙).
  // preflight 실패한 서버는 경고 후 제외하고 나머지로 계속한다 — 전부 실패면 종료.
  const bases = parseApiBases(process.env.WORKER_API_BASE);
  const passed: string[] = [];
  for (const base of bases) {
    if (await preflight(base)) passed.push(base);
    else console.error(`[worker] ${base} 는 이번 실행에서 제외합니다.`);
  }
  if (passed.length === 0) {
    process.exitCode = 1;
    return;
  }

  // 서버별 클라이언트 + 상태. staleWarned 는 같은 안내를 매 폴링마다 도배하지 않기 위한 1회 플래그.
  const targets = passed.map((base) => ({ base, api: createApiClient(base), staleWarned: false }));

  const workerId = process.env.SCRAPER_WORKER_ID?.trim();
  console.log(
    `[worker] 시작 — API=${passed.join(", ")} poll=${POLL_MS}ms headful=${HEADFUL} pace=${SAFE_PACE ? "safe" : "fast"} v${WORKER_PROTOCOL_VERSION}`
  );
  console.log(
    workerId
      ? `[worker] 이 수집 PC 이름: ${workerId} — 수집 화면에 이 이름을 그대로 입력하세요.`
      : "[worker] 수집 PC 이름 없음 — 이름이 지정된 작업은 받지 않습니다. (.env 의 SCRAPER_WORKER_ID)"
  );

  // 시작 순번을 매 폴링 회전시켜 특정 서버가 항상 먼저 잡아가는 편향을 없앤다.
  // 잡은 한 번에 하나만 수행한다(전 서버 공통) — 캐피탈사 사이트 페이싱·IP 보호가 우선.
  let rotation = 0;
  for (;;) {
    for (let i = 0; i < targets.length; i++) {
      const target = targets[(rotation + i) % targets.length];
      try {
        const claimed = await target.api.claimJob();

        // 백엔드가 새 규약을 기대하는데 이 워커는 옛 zip 이라면, 작업을 가져가면 안 된다.
        // 옛 코드로 처리하면 엉뚱한 이유로 실패하고 원인 추적이 어려워진다.
        if (
          claimed.expectedWorkerVersion !== undefined &&
          claimed.expectedWorkerVersion !== WORKER_PROTOCOL_VERSION
        ) {
          if (!target.staleWarned) {
            console.error(
              "\n" +
                "=".repeat(62) +
                `\n 프로그램이 오래되어 수집을 시작할 수 없습니다. (${target.base})\n` +
                `   (이 프로그램 v${WORKER_PROTOCOL_VERSION} / 서버 요구 v${claimed.expectedWorkerVersion})\n\n` +
                " '수집 시작.bat' 을 다시 실행하면 자동으로 업데이트됩니다.\n" +
                " 접속 정보는 그대로 유지되니 다시 입력하지 않아도 됩니다.\n" +
                "=".repeat(62) +
                "\n"
            );
            target.staleWarned = true;
          }
          continue;
        }
        target.staleWarned = false;

        if (claimed.job && claimed.credential) {
          console.log(`[worker] 작업 클레임: ${claimed.job.id} (캐피탈사 ${claimed.job.financeCompanyId}, 서버 ${target.base})`);
          const outcome = await runJob(claimed.job, claimed.credential, target.api);
          // 정상 완료 후에만 버스트 완화 쿨다운(분산) — 사람처럼 간격을 둠.
          // 취소/실패는 실제 수집이 없었으므로 쿨다운을 건너뛰고 즉시 다음 작업(예: 재시작한 수집)을 잡는다.
          if (shouldApplyJobCooldown(outcome)) {
            await sleep(jitter(JOB_COOLDOWN_MS));
          }
          break; // 한 사이클에 잡 하나만 — 나머지 서버는 다음 폴링에서 (회전으로) 먼저 본다
        }
      } catch (e) {
        // 서버 하나가 죽어도 다른 서버 폴링은 계속한다.
        console.error(`[worker] 루프 오류 (${target.base}): ${(e as Error).message}`);
      }
    }
    rotation = (rotation + 1) % targets.length;
    await sleep(POLL_MS);
  }
}

main().catch((e) => {
  console.error("[worker] 치명적 오류:", e);
  process.exit(1);
});
