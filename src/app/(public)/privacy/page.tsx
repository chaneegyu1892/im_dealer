import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "개인정보처리방침 | 아임딜러",
  description: "아임딜러 개인정보처리방침",
};

export default function PrivacyPage() {
  return (
    <main className="max-w-3xl mx-auto px-6 py-16">
      <h1 className="text-2xl font-bold text-[#1A1A2E] mb-2">개인정보처리방침</h1>
      <p className="text-sm text-[#9BA4C0] mb-10">시행일: 2026년 1월 1일</p>

      <section className="prose prose-sm max-w-none text-[#1A1A2E]/80 space-y-8">
        <div>
          <h2 className="text-base font-semibold text-[#1A1A2E] mb-2">
            제1조 (개인정보의 처리 목적)
          </h2>
          <p>아임딜러는 다음의 목적을 위해 개인정보를 처리합니다.</p>
          <ul className="list-disc pl-5 space-y-1">
            <li>회원 가입 및 관리 (본인 확인, 서비스 제공)</li>
            <li>장기렌트·리스 견적 산출 및 저장</li>
            <li>서류 확인 서비스 (운전면허, 보험, 사업자 등록 여부 확인)</li>
            <li>고객 상담 및 불만 처리</li>
          </ul>
        </div>

        <div>
          <h2 className="text-base font-semibold text-[#1A1A2E] mb-2">
            제2조 (처리하는 개인정보 항목)
          </h2>
          <ul className="list-disc pl-5 space-y-1">
            <li>필수: 이메일 주소, 서비스 이용 기록, IP 주소</li>
            <li>서류 확인 시 추가 수집: 성명, 생년월일, 휴대폰 번호, 운전면허번호</li>
            <li>카카오 소셜 로그인 시: 카카오 계정 이메일, 프로필 닉네임</li>
          </ul>
        </div>

        <div>
          <h2 className="text-base font-semibold text-[#1A1A2E] mb-2">
            제3조 (개인정보의 처리 및 보유 기간)
          </h2>
          <ul className="list-disc pl-5 space-y-1">
            <li>회원 정보: 회원 탈퇴 시까지</li>
            <li>견적 데이터: 마지막 이용일로부터 1년</li>
            <li>서류 확인 기록: 처리 완료 후 즉시 파기 (본인 확인 목적 완료 시)</li>
            <li>관련 법령에 따른 보존이 필요한 경우 해당 기간까지</li>
          </ul>
        </div>

        <div>
          <h2 className="text-base font-semibold text-[#1A1A2E] mb-2">
            제4조 (개인정보의 제3자 제공)
          </h2>
          <p>
            아임딜러는 원칙적으로 이용자의 개인정보를 제3자에게 제공하지 않습니다.
            다만, 이용자의 동의가 있거나 법령에 의거한 경우에는 예외로 합니다.
            서류 확인 서비스의 경우 Codef API를 통해 금융결제원에 조회 요청이 이루어지며,
            조회 완료 후 원문 데이터는 서버에 보관하지 않습니다.
          </p>
        </div>

        <div>
          <h2 className="text-base font-semibold text-[#1A1A2E] mb-2">
            제5조 (개인정보처리의 위탁)
          </h2>
          <ul className="list-disc pl-5 space-y-1">
            <li>Supabase Inc.: 회원 인증 및 데이터 저장 (미국)</li>
            <li>Google LLC: AI 추천 이유 생성 (Gemini API) (미국)</li>
          </ul>
        </div>

        <div>
          <h2 className="text-base font-semibold text-[#1A1A2E] mb-2">
            제6조 (이용자의 권리·의무)
          </h2>
          <p>
            이용자는 언제든지 자신의 개인정보 조회·수정·삭제·처리정지를 요청할 수 있습니다.
            요청은 이메일(contact@imdealers.com)을 통해 하실 수 있으며,
            회사는 지체 없이(최대 10일 이내) 처리합니다.
          </p>
        </div>

        <div>
          <h2 className="text-base font-semibold text-[#1A1A2E] mb-2">
            제7조 (개인정보 보호책임자)
          </h2>
          <p>
            성명: 홍길동
            <br />
            직위: 대표
            <br />
            이메일: contact@imdealers.com
          </p>
        </div>

        <div>
          <h2 className="text-base font-semibold text-[#1A1A2E] mb-2">
            제8조 (쿠키 사용)
          </h2>
          <p>
            회사는 세션 관리 및 서비스 이용 편의를 위해 쿠키를 사용합니다.
            브라우저 설정에서 쿠키 허용 여부를 변경할 수 있으나,
            일부 서비스 이용이 제한될 수 있습니다.
          </p>
        </div>

        <div className="pt-4 border-t border-[#E8EAF2]">
          <p className="text-xs text-[#9BA4C0]">
            개인정보보호 문의: contact@imdealers.com
            <br />
            개인정보보호위원회 (privacy.go.kr / 국번 없이 182)
          </p>
        </div>
      </section>
    </main>
  );
}
