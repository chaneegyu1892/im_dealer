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
                이메일: contact@imdealers.com
              </li>
              <li className="text-[13px] text-white/60">
                영업시간: 평일 09:00 - 18:00
              </li>
            </ul>
          </div>
        </div>
      </div>

      {/* 약관·고지 아코디언 */}
      <div className="border-t border-white/10">
        <div className="max-w-content mx-auto px-6 lg:px-8 py-2">
          <Accordion>
            <AccordionItem title="금융사별 주요 약관">
              <p>
                ※ 본 약관은 추후 업데이트 예정입니다.
              </p>
              <p className="mt-1">
                금융사별 상세 약관은 계약 진행 시 별도 안내드립니다. 장기렌트·리스 상품은
                금융사에 따라 보증금·선납금·중도해지 조건이 상이할 수 있습니다.
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
            <AccordionItem title="중도해지 수수료 등 법적 고지">
              <p>
                장기렌트 및 리스 상품은 계약 기간 중 중도해지 시 위약금이 발생할 수 있습니다.
              </p>
              <p className="mt-1 text-white/40">
                ※ 자세한 법적 고지 및 위약금 산정 기준은 추후 업데이트 예정입니다. 계약 진행
                시 금융사별 상세 고지사항을 안내드립니다.
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
              상호: 아임딜러 | 대표: 홍길동 | 사업자등록번호: 000-00-00000
            </p>
            <p>
              주소: 서울특별시 강남구 테헤란로 000, 00층 | 통신판매업신고:
              제2026-서울강남-00000호
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
