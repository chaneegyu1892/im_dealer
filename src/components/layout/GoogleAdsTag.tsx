import Script from "next/script";
import { googleAdsConversionId } from "@/lib/google-ads";

/**
 * Google Ads 전체 사이트 태그(gtag.js).
 *
 * 광고 클릭 시 URL 에 붙는 gclid 를 퍼스트파티 쿠키(_gcl_*)로 저장해,
 * 이후 발생한 전환을 어떤 광고·키워드가 만들었는지 잇는 역할만 한다.
 * 전환 발사 자체는 감사 페이지가 없는 SPA 흐름이라 trackQuoteRequestConversion() 이 담당한다.
 *
 * 어드민((admin) 그룹)에는 싣지 않는다 — 내부 운영 트래픽을 광고 계정에 보낼 이유가 없다.
 */
export function GoogleAdsTag() {
  const conversionId = googleAdsConversionId();
  if (!conversionId) return null;

  return (
    <>
      <Script
        id="google-ads-gtag-src"
        src={`https://www.googletagmanager.com/gtag/js?id=${conversionId}`}
        strategy="afterInteractive"
      />
      <Script id="google-ads-gtag-config" strategy="afterInteractive">
        {`window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
gtag('js', new Date());
gtag('config', '${conversionId}');`}
      </Script>
    </>
  );
}
