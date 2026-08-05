import type { Metadata } from "next";

export const SITE_NAME = "아임딜러";
export const SITE_ALTERNATE_NAME = "IM DEALER";
export const SITE_LEGAL_NAME = "주식회사 모빌페이브";
export const CANONICAL_SITE_URL = "https://imdealer.co.kr";
export const HOME_TITLE = "아임딜러 | 장기렌트·운용리스 견적 비교";
export const SITE_DESCRIPTION =
  "장기렌트·운용리스 차량의 월 납입금과 초기 비용을 비교하고, AI 맞춤 차량 추천부터 견적 상담까지 확인하세요.";

const DEFAULT_SOCIAL_IMAGE_PATH = "/images/hero-bg-v3.png";

/**
 * 검색엔진에 전달할 사이트 origin을 정규화한다.
 * 운영 도메인은 http/www 환경값이 들어와도 하나의 https apex 주소로 통일한다.
 */
export function normalizeSiteUrl(configuredUrl?: string): string {
  if (!configuredUrl?.trim()) return CANONICAL_SITE_URL;

  try {
    const url = new URL(configuredUrl.trim());
    const hostname = url.hostname.toLowerCase();

    if (hostname === "imdealer.co.kr" || hostname === "www.imdealer.co.kr") {
      return CANONICAL_SITE_URL;
    }

    return url.origin;
  } catch {
    return CANONICAL_SITE_URL;
  }
}

export const SITE_URL = normalizeSiteUrl(process.env.NEXT_PUBLIC_APP_URL);

export function absoluteSiteUrl(pathname = "/"): string {
  return new URL(pathname, `${SITE_URL}/`).toString();
}

export function summarizeMetaDescription(
  value: string,
  maxLength = 80,
): string {
  const normalized = value.replace(/\s+/g, " ").trim();
  if (normalized.length <= maxLength) return normalized;
  return `${normalized.slice(0, Math.max(1, maxLength - 1)).trimEnd()}…`;
}

function resolveImageUrl(image?: string): string {
  return new URL(image ?? DEFAULT_SOCIAL_IMAGE_PATH, `${SITE_URL}/`).toString();
}

type PageMetadataInput = {
  readonly title: string;
  readonly description: string;
  readonly path: string;
  readonly absoluteTitle?: boolean;
  readonly image?: string;
  readonly imageAlt?: string;
};

/**
 * 정적 공개 페이지의 title/description/canonical/OG를 같은 기준으로 생성한다.
 * title에는 루트 layout의 템플릿이 적용되므로 페이지명만 전달한다.
 */
export function createPageMetadata({
  title,
  description,
  path,
  absoluteTitle = false,
  image,
  imageAlt,
}: PageMetadataInput): Metadata {
  const canonical = absoluteSiteUrl(path);
  const fullTitle = absoluteTitle ? title : `${title} | ${SITE_NAME}`;
  const socialImage = resolveImageUrl(image);

  return {
    title: absoluteTitle ? { absolute: title } : title,
    description,
    alternates: { canonical },
    openGraph: {
      title: fullTitle,
      description,
      url: canonical,
      type: "website",
      locale: "ko_KR",
      siteName: SITE_NAME,
      images: [
        {
          url: socialImage,
          alt: imageAlt ?? `${fullTitle} 대표 이미지`,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: fullTitle,
      description,
      images: [socialImage],
    },
  };
}
