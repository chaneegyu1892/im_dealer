import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "마케팅 정보 수신 동의",
  description: "(주)모빌페이브 아임딜러(IM DEALER) 마케팅 정보 수신 동의 안내",
};

const TABLE = "w-full min-w-[640px] border-collapse text-xs sm:text-sm";
const TH =
  "border border-border-subtle bg-surface-soft px-3 py-2 text-left font-semibold text-text-strong whitespace-nowrap";
const TD = "border border-border-subtle px-3 py-2 align-top text-text-body";

export default function MarketingConsentPage() {
  return (
    <main className="public-app-page min-h-screen">
      <div className="page-container mx-auto max-w-3xl px-5 pt-12 pb-[calc(128px+env(safe-area-inset-bottom,0px))] md:py-16">
        <h1 className="mb-2 text-[26px] font-extrabold leading-tight text-text-strong md:text-[32px]">
          마케팅 정보 수신 동의
        </h1>
        <p className="mb-6 text-sm text-text-muted">시행일: 2026년 7월 20일</p>

        <p className="mb-10 text-sm leading-relaxed text-text-body">
          (주)모빌페이브(이하 &ldquo;회사&rdquo;라 함)는 아임딜러(IM DEALER) 서비스 이용자에게
          할인·프로모션 등 혜택 정보를 안내하기 위해 아래와 같이 마케팅 정보 수신 동의를 받습니다.
          본 동의는 <strong>선택 사항</strong>이며, 동의하지 않으셔도 서비스 이용에는 어떠한
          제한도 없습니다.
        </p>

        <section className="max-w-none space-y-8 text-[14px] leading-7 text-text-body">
          <div>
            <h2 className="text-base font-semibold text-text-strong mb-2">
              제1조 (수집·이용 목적)
            </h2>
            <p>
              회사는 다음의 목적으로 이용자의 개인정보를 마케팅 목적으로 이용합니다.
            </p>
            <ul className="list-disc pl-5 space-y-1 mt-2">
              <li>신규 차량·금융상품 출시 및 조건 변경 안내</li>
              <li>할인, 프로모션, 이벤트 및 제휴 혜택 정보 제공</li>
              <li>이용자 관심 차량·견적 이력에 기반한 맞춤형 상품 추천</li>
              <li>서비스 이용 통계 분석을 통한 혜택 설계 및 품질 개선</li>
            </ul>
          </div>

          <div>
            <h2 className="text-base font-semibold text-text-strong mb-2">
              제2조 (수집 항목 및 전송 수단)
            </h2>
            <div className="overflow-x-auto mt-3">
              <table className={TABLE}>
                <thead>
                  <tr>
                    <th className={TH}>구분</th>
                    <th className={TH}>내용</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className={TD}>수집 항목</td>
                    <td className={TD}>
                      성명, 휴대전화번호, 이메일 주소, 카카오계정 식별자, 서비스 이용 이력(관심
                      차량, 견적 조건)
                    </td>
                  </tr>
                  <tr>
                    <td className={TD}>전송 수단</td>
                    <td className={TD}>
                      카카오톡 알림톡·친구톡, 문자메시지(SMS/LMS), 이메일, 앱 푸시 알림
                    </td>
                  </tr>
                  <tr>
                    <td className={TD}>보유·이용 기간</td>
                    <td className={TD}>
                      동의일로부터 회원 탈퇴 또는 수신 동의 철회 시까지
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <div>
            <h2 className="text-base font-semibold text-text-strong mb-2">
              제3조 (동의 거부 권리 및 불이익)
            </h2>
            <p>
              이용자는 본 마케팅 정보 수신 동의를 거부할 권리가 있습니다. 동의를 거부하시더라도
              회원가입, 견적 조회, 상담 신청 등 아임딜러의 모든 기본 서비스를 제한 없이 이용하실
              수 있습니다. 다만 동의하지 않으신 경우 할인·프로모션 등 혜택 정보를 받지 못하실 수
              있습니다.
            </p>
          </div>

          <div>
            <h2 className="text-base font-semibold text-text-strong mb-2">
              제4조 (동의 철회 방법)
            </h2>
            <p>
              이용자는 동의 후에도 언제든지 수신을 철회할 수 있으며, 철회 시 즉시 마케팅 정보
              발송이 중단됩니다. 철회는 다음 방법으로 요청하실 수 있습니다.
            </p>
            <ul className="list-disc pl-5 space-y-1 mt-2">
              <li>서비스 내 고객센터 문의 또는 상담 채널을 통한 요청</li>
              <li>이메일(contact@metakium.co.kr)로 철회 의사 전달</li>
              <li>수신한 메시지 내 수신거부 안내에 따른 처리</li>
            </ul>
          </div>

          <div>
            <h2 className="text-base font-semibold text-text-strong mb-2">
              제5조 (야간 광고 전송 제한)
            </h2>
            <p>
              회사는 「정보통신망 이용촉진 및 정보보호 등에 관한 법률」 제50조에 따라 오후 9시부터
              다음 날 오전 8시까지는 별도의 사전 동의 없이 광고성 정보를 전송하지 않습니다.
            </p>
          </div>

          <div>
            <h2 className="text-base font-semibold text-text-strong mb-2">제6조 (기타)</h2>
            <p>
              본 동의서에 명시되지 않은 개인정보의 처리에 관한 사항은 회사의{" "}
              <a href="/privacy" className="font-semibold text-brand underline-offset-4 hover:underline">
                개인정보처리방침
              </a>
              을 따릅니다.
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}
