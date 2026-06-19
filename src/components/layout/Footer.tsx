import Link from "next/link";
import { Accordion, AccordionItem } from "@/components/ui/Accordion";

export function Footer() {
  return (
    <footer className="bg-[#1A1A2E] text-white/70">
      {/* 상단 — 네비게이션 + 브랜드 */}
      <div className="max-w-content mx-auto px-6 lg:px-8 py-10 md:py-12">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
          {/* 브랜드 */}
          <div className="col-span-2 md:col-span-1">
            <p className="text-[20px] font-bold text-white tracking-tight mb-3">
              아임딜러
            </p>
            <p className="text-[13px] leading-relaxed text-white/50">
              허위견적 없는 AI 기반
              <br />
              장기렌트·리스 견적 서비스
            </p>
          </div>

          {/* 서비스 */}
          <div>
            <h3 className="text-[12px] font-semibold text-white/40 uppercase tracking-wider mb-4">
              서비스
            </h3>
            <ul className="space-y-2.5">
              <li>
                <Link
                  href="/recommend"
                  className="text-[13px] text-white/60 hover:text-white transition-colors"
                >
                  AI 추천
                </Link>
              </li>
              <li>
                <Link
                  href="/cars"
                  className="text-[13px] text-white/60 hover:text-white transition-colors"
                >
                  차량 탐색
                </Link>
              </li>
              <li>
                <Link
                  href="/about"
                  className="text-[13px] text-white/60 hover:text-white transition-colors"
                >
                  아임딜러 소개
                </Link>
              </li>
            </ul>
          </div>

          {/* 고객 지원 */}
          <div>
            <h3 className="text-[12px] font-semibold text-white/40 uppercase tracking-wider mb-4">
              고객 지원
            </h3>
            <ul className="space-y-2.5">
              <li>
                <Link
                  href="/terms"
                  className="text-[13px] text-white/60 hover:text-white transition-colors"
                >
                  이용약관
                </Link>
              </li>
              <li>
                <Link
                  href="/privacy"
                  className="text-[13px] text-white/60 hover:text-white transition-colors"
                >
                  개인정보처리방침
                </Link>
              </li>
            </ul>
          </div>

          {/* 연락처 */}
          <div>
            <h3 className="text-[12px] font-semibold text-white/40 uppercase tracking-wider mb-4">
              문의
            </h3>
            <ul className="space-y-2.5">
              <li className="text-[13px] text-white/60">
                이메일: contact@metakium.co.kr
              </li>
              <li className="text-[13px] text-white/60">
                영업시간: 평일 08:30 - 17:30
              </li>
            </ul>
          </div>
        </div>
      </div>

      {/* 약관·고지 아코디언 */}
      <div className="border-t border-white/10">
        <div className="max-w-content mx-auto px-6 lg:px-8 py-2">
          <Accordion>
            <AccordionItem title="금융사 주요 약관 및 법적 고지">
              <p>
                (주)메타키움은 「금융소비자 보호에 관한 법률」에 따라 등록된
                금융상품판매대리·중개업자입니다. 제휴 금융사별 상품 조건(중도해지·초과운행·연체이자
                등)과 법적 고지 전문은 아래에서 확인하실 수 있습니다.
              </p>
              <p className="mt-2">
                <Link
                  href="/finance-terms"
                  className="text-white underline underline-offset-2 hover:text-white/80"
                >
                  서비스 법적 고지 및 금융상품 안내 전문 보기 →
                </Link>
              </p>
            </AccordionItem>
            <AccordionItem title="모집인 정보">
              <p>영업 총괄: 오영택, 신준호</p>
              <p className="mt-1 text-white/40">
                (그 외 모집인 정보는 추후 업데이트 예정입니다.)
              </p>
              <p className="mt-2 text-white/40">
                ※ 모집인 등록번호 및 자세한 정보는 차후 명시됩니다.
              </p>
            </AccordionItem>
          </Accordion>
        </div>
      </div>

      {/* 하단 — 사업자 정보 (모바일 포함 항상 표시) */}
      <div className="border-t border-white/10">
        <div className="max-w-content mx-auto px-6 lg:px-8 py-6">
          <div className="text-[11px] text-white/30 leading-relaxed space-y-1">
            <p>
              상호: (주)메타키움 | 대표: 조수형 | 사업자등록번호: 781-87-01147
            </p>
            <p>
              주소: 서울시 금천구 디지털로 178 퍼블릭가산 B동 1322호 메타키움
            </p>
            <p className="mt-3">
              © {new Date().getFullYear()} 아임딜러. All rights reserved.
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
}
