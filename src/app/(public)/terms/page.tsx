import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "이용약관 | 아임딜러",
  description: "아임딜러 서비스 이용약관",
};

export default function TermsPage() {
  return (
    <main className="max-w-3xl mx-auto px-6 py-16">
      <h1 className="text-2xl font-bold text-[#1A1A2E] mb-2">이용약관</h1>
      <p className="text-sm text-[#9BA4C0] mb-10">시행일: 2026년 1월 1일</p>

      <section className="prose prose-sm max-w-none text-[#1A1A2E]/80 space-y-8">
        <div>
          <h2 className="text-base font-semibold text-[#1A1A2E] mb-2">제1조 (목적)</h2>
          <p>
            이 약관은 아임딜러(이하 &ldquo;회사&rdquo;)가 제공하는 장기렌트·리스 견적 서비스(이하 &ldquo;서비스&rdquo;)의
            이용 조건 및 절차, 회사와 이용자의 권리·의무 및 책임사항을 규정함을 목적으로 합니다.
          </p>
        </div>

        <div>
          <h2 className="text-base font-semibold text-[#1A1A2E] mb-2">제2조 (정의)</h2>
          <ul className="list-disc pl-5 space-y-1">
            <li>&ldquo;서비스&rdquo;란 회사가 운영하는 웹사이트 및 관련 서비스 일체를 의미합니다.</li>
            <li>&ldquo;이용자&rdquo;란 이 약관에 동의하고 서비스를 이용하는 개인 또는 법인을 의미합니다.</li>
            <li>&ldquo;회원&rdquo;이란 회사에 개인정보를 제공하여 회원 등록을 한 이용자를 의미합니다.</li>
            <li>&ldquo;견적&rdquo;이란 이용자가 서비스를 통해 산출하는 장기렌트·리스 월 납입금 예상 금액을 의미합니다.</li>
          </ul>
        </div>

        <div>
          <h2 className="text-base font-semibold text-[#1A1A2E] mb-2">제3조 (약관의 효력 및 변경)</h2>
          <p>
            이 약관은 서비스 화면에 게시하거나 기타 방법으로 이용자에게 공지함으로써 효력이 발생합니다.
            회사는 필요한 경우 관련 법령을 위반하지 않는 범위에서 이 약관을 변경할 수 있으며,
            변경된 약관은 공지일로부터 7일 이후 효력이 발생합니다.
          </p>
        </div>

        <div>
          <h2 className="text-base font-semibold text-[#1A1A2E] mb-2">제4조 (서비스의 내용)</h2>
          <p>회사는 다음과 같은 서비스를 제공합니다.</p>
          <ul className="list-disc pl-5 space-y-1">
            <li>AI 기반 차량 추천 및 장기렌트·리스 견적 산출</li>
            <li>견적서 PDF 다운로드 (회원 전용)</li>
            <li>차량 정보 조회 및 비교</li>
            <li>금융 상담 연결 서비스</li>
          </ul>
        </div>

        <div>
          <h2 className="text-base font-semibold text-[#1A1A2E] mb-2">제5조 (면책사항)</h2>
          <p>
            서비스를 통해 제공되는 견적은 참고용 예상치로, 실제 계약 조건은 금융사 심사 결과 및
            차량 재고 상황에 따라 달라질 수 있습니다. 회사는 견적과 실제 계약 금액의 차이에 대해
            법령에 특별한 규정이 없는 한 책임을 지지 않습니다.
          </p>
        </div>

        <div>
          <h2 className="text-base font-semibold text-[#1A1A2E] mb-2">제6조 (개인정보 보호)</h2>
          <p>
            회사는 이용자의 개인정보를 보호하기 위해 개인정보처리방침을 수립하고 준수합니다.
            자세한 내용은{" "}
            <a href="/privacy" className="text-[#6066EE] underline">
              개인정보처리방침
            </a>
            을 확인하시기 바랍니다.
          </p>
        </div>

        <div>
          <h2 className="text-base font-semibold text-[#1A1A2E] mb-2">제7조 (준거법 및 관할)</h2>
          <p>
            이 약관의 해석 및 분쟁에 관하여는 대한민국 법률을 준거법으로 하며,
            분쟁 발생 시 회사 소재지 관할 법원을 전속 관할법원으로 합니다.
          </p>
        </div>

        <div className="pt-4 border-t border-[#E8EAF2]">
          <p className="text-xs text-[#9BA4C0]">
            사업자등록번호: 000-00-00000 | 통신판매업신고: 제2026-서울강남-00000호
            <br />
            대표: 홍길동 | 주소: 서울특별시 강남구 테헤란로 000, 00층
            <br />
            문의: contact@imdealers.com
          </p>
        </div>
      </section>
    </main>
  );
}
