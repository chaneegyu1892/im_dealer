import type { AdapterContext, SiteAdapter } from "./types";
import type { TrimScrapeResult } from "../../../src/types/scraper";
import { RATE_KEYS } from "../mapping";
import { assertHttpUrl } from "../safe-url";

/**
 * 파일럿 캐피탈사 어댑터 (ID/PW 단순 로그인).
 *
 * 셀렉터·URL·트림매핑은 credential.config 로 주입한다(없으면 mock-site 기본값 사용).
 * 같은 어댑터로 mock-site 테스트와 실사이트(설정만 교체)를 모두 처리한다.
 *
 * config 형식:
 *   {
 *     usernameSelector, passwordSelector, loginButtonSelector, extendButtonSelector,
 *     twoFactorSelector?,            // 존재 시 로그인 후 사람 인증 단계로 간주
 *     quoteUrlTemplate,              // "{code}" 치환. 예: "http://host/quote?trim={code}"
 *     trimMap: { [ourTrimId]: "외부코드" },
 *     requestDelayMs?               // 트림 간 지연(기본 1500)
 *   }
 */

function cfg<T>(config: Record<string, unknown> | null, key: string, fallback: T): T {
  const v = config?.[key];
  return v === undefined || v === null ? fallback : (v as T);
}

function parseNumber(raw: string | null | undefined): number {
  if (!raw) return 0;
  const digits = raw.replace(/[^0-9]/g, "");
  return digits ? parseInt(digits, 10) : 0;
}

export const pilotCompanyAdapter: SiteAdapter = {
  code: "PILOT",

  async login(ctx: AdapterContext): Promise<void> {
    const { page, credentials, config, log } = ctx;
    const userSel = cfg(config, "usernameSelector", "#username");
    const passSel = cfg(config, "passwordSelector", "#password");
    const btnSel = cfg(config, "loginButtonSelector", "#login-btn");
    const twoFactorSel = cfg<string | null>(config, "twoFactorSelector", null);

    log(`로그인 페이지 이동: ${credentials.loginUrl}`);
    await page.goto(assertHttpUrl(credentials.loginUrl, "loginUrl"), { waitUntil: "networkidle2", timeout: 30000 });

    await page.waitForSelector(userSel, { timeout: 15000 });
    await page.type(userSel, credentials.username, { delay: 30 });
    await page.type(passSel, credentials.password, { delay: 30 });

    await Promise.all([
      page.click(btnSel),
      page.waitForNavigation({ waitUntil: "networkidle2", timeout: 30000 }).catch(() => null),
    ]);
    log("로그인 폼 제출 완료");

    // 2FA / 키보드보안 단계: 사람 개입으로 위임 (headful 브라우저에서 직접 처리)
    if (twoFactorSel) {
      const needs2fa = await page.$(twoFactorSel);
      if (needs2fa) {
        log("추가 인증 단계 감지 — 사람 개입 대기");
        await ctx.waitForHuman(
          "워커 PC 브라우저에서 휴대폰 인증/키보드보안 등 추가 인증을 완료한 뒤 [재개]를 누르세요."
        );
      }
    }
  },

  async keepAlive(ctx: AdapterContext): Promise<void> {
    const { page, config, log } = ctx;
    const extendSel = cfg<string | null>(config, "extendButtonSelector", "#extend-btn");
    if (!extendSel) return;
    const btn = await page.$(extendSel);
    if (btn) {
      await btn.click().catch(() => null);
      log("세션 연장 버튼 클릭");
    }
  },

  async scrapeTrim(ctx: AdapterContext, ourTrimId: string): Promise<TrimScrapeResult> {
    const { page, config, log } = ctx;
    const trimMap = cfg<Record<string, string>>(config, "trimMap", {});
    const urlTemplate = cfg<string>(config, "quoteUrlTemplate", "http://localhost:4599/quote?trim={code}");

    const externalCode = trimMap[ourTrimId];
    if (!externalCode) {
      return {
        trimId: ourTrimId,
        matchConfidence: "unmatched",
        externalTrimLabel: "(매핑 없음)",
        vehiclePrice: 0,
        baseRates: {},
        warnings: [`trimMap 에 ${ourTrimId} 에 대한 외부 코드가 없습니다.`],
      };
    }

    const url = assertHttpUrl(urlTemplate.replace("{code}", encodeURIComponent(externalCode)), "quoteUrl");
    log(`견적 페이지 수집: ${url}`);
    await page.goto(url, { waitUntil: "networkidle2", timeout: 30000 });

    // 세션 만료로 로그인 페이지로 튕겼는지 확인
    if (/login/i.test(page.url())) {
      throw new Error("세션 만료로 로그인 페이지로 리다이렉트됨 (연장 실패 가능성)");
    }

    // tsx/esbuild 는 evaluate 에 넘기는 함수에 `__name` 헬퍼를 주입한다. 브라우저 컨텍스트엔
    // 그 헬퍼가 없어 ReferenceError 가 나므로, 변환되지 않는 문자열 eval 로 미리 정의해 둔다.
    await page.evaluate("globalThis.__name = globalThis.__name || function (f) { return f; };");

    const keys = RATE_KEYS as readonly string[];
    const scraped = await page.evaluate((rateKeys: string[]) => {
      const text = (sel: string) => document.querySelector(sel)?.textContent?.trim() ?? null;
      const base: Record<string, string | null> = {};
      for (const k of rateKeys) {
        base[k] = text(`[data-rate="base"][data-key="${k}"]`);
      }
      return {
        label: text('[data-field="trimLabel"]'),
        price: text('[data-field="vehiclePrice"]'),
        base,
        deposit: text('[data-rate="deposit"][data-key="36_10000"]'),
        prepay: text('[data-rate="prepay"][data-key="36_10000"]'),
      };
    }, keys as string[]);

    const baseRates: Record<string, number> = {};
    const warnings: string[] = [];
    let found = 0;
    for (const k of keys) {
      const n = parseNumber(scraped.base[k]);
      if (n > 0) {
        baseRates[k] = n;
        found++;
      }
    }
    if (found === 0) warnings.push(`${externalCode}: 견적 셀을 찾지 못했습니다.`);

    const vehiclePrice = parseNumber(scraped.price);
    const deposit = parseNumber(scraped.deposit);
    const prepay = parseNumber(scraped.prepay);

    return {
      trimId: ourTrimId,
      matchConfidence: "exact",
      externalTrimLabel: scraped.label ?? externalCode,
      vehiclePrice,
      baseRates,
      depositRate36_10000: deposit > 0 ? deposit : undefined,
      prepayRate36_10000: prepay > 0 ? prepay : undefined,
      warnings,
    };
  },
};
