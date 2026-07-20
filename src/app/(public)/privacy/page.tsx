import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "개인정보처리방침 | 아임딜러",
  description: "(주)모빌페이브 아임딜러(IM DEALER) 개인정보처리방침",
};

const TABLE = "w-full min-w-[640px] border-collapse text-xs sm:text-sm";
const TH =
  "border border-border-subtle bg-surface-soft px-3 py-2 text-left font-semibold text-text-strong whitespace-nowrap";
const TD = "border border-border-subtle px-3 py-2 align-top text-text-body";

export default function PrivacyPage() {
  return (
    <main className="public-app-page min-h-screen">
      <div className="page-container mx-auto max-w-3xl px-5 pt-12 pb-[calc(128px+env(safe-area-inset-bottom,0px))] md:py-16">
        <h1 className="mb-2 text-[26px] font-extrabold leading-tight text-text-strong md:text-[32px]">
          (주)모빌페이브 개인정보처리방침
        </h1>
        <p className="mb-6 text-sm text-text-muted">시행일: 2026년 6월 17일</p>

        <p className="mb-10 text-sm leading-relaxed text-text-body">
          (주)모빌페이브(이하 &ldquo;회사&rdquo;라 함)는 이용자의 개인정보를 중요하게
          생각하며, 개인정보 보호법, 정보통신망 이용 촉진 및 정보보호 등에 관한 법률 등 관련
          법령을 성실히 준수합니다. 이에 개인정보 보호법 제30조에 따라 이용자가 개인정보 처리
          절차 및 기준을 명확히 이해하고, 관련 고충을 신속하게 처리받을 수 있도록 다음과 같이
          개인정보처리방침을 수립하여 공개합니다.
        </p>

        <section className="max-w-none space-y-8 text-[14px] leading-7 text-text-body">
          <div>
          <h2 className="text-base font-semibold text-text-strong mb-2">
            제1조 개인정보의 처리 목적
          </h2>
          <p>
            회사는 아래의 목적을 위하여 필요한 최소한의 개인정보만을 수집·처리합니다. 처리된
            개인정보는 명시된 목적 외의 용도로 사용되지 않으며, 처리 목적이 변경되는 경우
            이용자에게 별도의 동의를 받는 등 필요한 조치를 취합니다.
          </p>
          <div className="overflow-x-auto mt-3">
            <table className={TABLE}>
              <thead>
                <tr>
                  <th className={TH}>구분</th>
                  <th className={TH}>목적</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className={TD}>회원 가입 및 관리</td>
                  <td className={TD}>
                    본인 확인 및 인증, 서비스 이용 자격 관리, 고객 문의 및 민원 처리, 부정 이용
                    방지
                  </td>
                </tr>
                <tr>
                  <td className={TD}>서비스 제공 및 개선</td>
                  <td className={TD}>
                    장기렌트·리스 견적 비교 및 중개 서비스 제공, AI 기반 맞춤 금융 설계, 수수료
                    정산, 입력 편의 기능 제공, 서비스 품질 개선 및 고객 경험 향상
                  </td>
                </tr>
                <tr>
                  <td className={TD}>맞춤형 서비스 제공</td>
                  <td className={TD}>
                    이용자 유형(개인·법인·개인사업자)별 맞춤 견적 추천, 신규 기능 개발, 서비스
                    연구
                  </td>
                </tr>
                <tr>
                  <td className={TD}>홍보 및 마케팅</td>
                  <td className={TD}>
                    회사 및 제휴사 서비스 관련 카카오톡·문자메시지·이메일·앱 푸시 광고 발송,
                    이벤트 및 프로모션 안내
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <div>
          <h2 className="text-base font-semibold text-text-strong mb-2">
            제2조 개인정보의 수집 항목
          </h2>
          <p>
            ① 회사는 이용자의 사생활을 침해할 우려가 있는 민감정보는 원칙적으로 수집하지 않으며,
            불가피한 경우 별도의 동의를 받아 동의 목적 범위 내에서만 처리합니다.
          </p>

          <p className="mt-3 font-medium text-text-strong">〈필수 항목〉</p>
          <div className="overflow-x-auto mt-2">
            <table className={TABLE}>
              <thead>
                <tr>
                  <th className={TH}>구분</th>
                  <th className={TH}>수집 항목</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className={TD}>회원 가입(카카오 로그인)</td>
                  <td className={TD}>
                    이름, 이메일 주소, 휴대전화번호, 카카오계정 식별자, 프로필 정보(닉네임,
                    프로필 이미지)
                  </td>
                </tr>
                <tr>
                  <td className={TD}>본인 확인(간편인증)</td>
                  <td className={TD}>
                    이름, 생년월일, 휴대전화번호, 통신사 정보, 간편인증 수단
                  </td>
                </tr>
                <tr>
                  <td className={TD}>서류 발급</td>
                  <td className={TD}>
                    발급 서류 원본 파일 및 문서확인번호(소득금액증명원, 근로소득 원천징수영수증,
                    건강보험 자격득실확인서, 사업자등록증명 등) 및 해당 서류에 포함된 소득·재직·
                    사업자 정보, 운전면허 진위확인 결과
                  </td>
                </tr>
                <tr>
                  <td className={TD}>견적 이용</td>
                  <td className={TD}>
                    고객명, 연락처, 견적 조회 결과(차량명, 엔진/트림, 선납금, 이용 기간, 약정
                    주행거리, 월납금)
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <p className="mt-3 text-[13px] leading-6 text-text-muted">
            ※ 본인 확인 과정에서 입력하신 주민등록번호 뒤 7자리는 생년월일을 산출하기 위해
            이용자 기기 내에서만 처리되며, 회사 서버로 전송되거나 저장되지 않습니다.
          </p>

          <p className="mt-4 font-medium text-text-strong">〈선택 항목〉</p>
          <div className="overflow-x-auto mt-2">
            <table className={TABLE}>
              <thead>
                <tr>
                  <th className={TH}>구분</th>
                  <th className={TH}>수집 항목</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className={TD}>홍보 및 마케팅</td>
                  <td className={TD}>
                    성명, 휴대전화번호, 이메일 주소, 카카오계정 식별자, 서비스 이용 이력(관심
                    차량, 견적 조건)
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <p className="mt-4">② 회사는 다음의 방법으로 개인정보를 수집합니다.</p>
          <ul className="list-disc pl-5 space-y-1">
            <li>회원 가입 및 서비스 이용 과정에서 이용자가 직접 입력하는 방법</li>
            <li>이메일, 전화, 이벤트 응모, 고객센터 문의를 통한 수집</li>
            <li>제휴 금융기관 및 관련 행정기관 등 제3자로부터의 합법적 수집</li>
          </ul>
        </div>

        <div>
          <h2 className="text-base font-semibold text-text-strong mb-2">
            제3조 개인정보의 처리 및 보유 기간
          </h2>
          <p>
            ① 회사는 법령에서 정한 보유 기간 또는 이용자로부터 동의받은 보유 기간 내에서
            개인정보를 처리하며, 해당 기간이 종료되면 지체 없이 파기합니다.
          </p>

          <p className="mt-3 font-medium text-text-strong">〈서비스별 보유 기간〉</p>
          <div className="overflow-x-auto mt-2">
            <table className={TABLE}>
              <thead>
                <tr>
                  <th className={TH}>서비스명</th>
                  <th className={TH}>보유 기간</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className={TD}>회원 가입 및 관리</td>
                  <td className={TD}>회원 탈퇴 시까지</td>
                </tr>
                <tr>
                  <td className={TD}>서비스 이용</td>
                  <td className={TD}>회원 탈퇴 시까지</td>
                </tr>
                <tr>
                  <td className={TD}>광고 및 마케팅</td>
                  <td className={TD}>회원 탈퇴 또는 동의 철회 시까지</td>
                </tr>
              </tbody>
            </table>
          </div>

          <p className="mt-4 font-medium text-text-strong">〈관련 법령에 따른 보유 기간〉</p>
          <div className="overflow-x-auto mt-2">
            <table className={TABLE}>
              <thead>
                <tr>
                  <th className={TH}>관련 법령</th>
                  <th className={TH}>목적</th>
                  <th className={TH}>보관 기간</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className={TD}>전자상거래 등에서의 소비자보호에 관한 법률</td>
                  <td className={TD}>계약 또는 청약 철회에 관한 기록</td>
                  <td className={TD}>5년</td>
                </tr>
                <tr>
                  <td className={TD}>전자상거래 등에서의 소비자보호에 관한 법률</td>
                  <td className={TD}>소비자 불만 또는 분쟁 처리에 관한 기록</td>
                  <td className={TD}>3년</td>
                </tr>
                <tr>
                  <td className={TD}>전자상거래 등에서의 소비자보호에 관한 법률</td>
                  <td className={TD}>대금 결제 및 재화 공급에 관한 기록</td>
                  <td className={TD}>5년</td>
                </tr>
                <tr>
                  <td className={TD}>전자금융거래법</td>
                  <td className={TD}>전자금융 거래에 관한 기록</td>
                  <td className={TD}>5년</td>
                </tr>
                <tr>
                  <td className={TD}>통신비밀보호법</td>
                  <td className={TD}>로그인 기록(접속 로그, 접속자 추적 자료)</td>
                  <td className={TD}>3개월</td>
                </tr>
                <tr>
                  <td className={TD}>신용정보의 이용 및 보호에 관한 법률</td>
                  <td className={TD}>신용정보 업무 처리에 관한 기록</td>
                  <td className={TD}>3년</td>
                </tr>
              </tbody>
            </table>
          </div>

          <p className="mt-4">② 다른 법령에 별도 규정이 있는 경우에는 해당 법령에 따릅니다.</p>
        </div>

        <div>
          <h2 className="text-base font-semibold text-text-strong mb-2">
            제4조 개인정보의 제3자 제공
          </h2>
          <p>
            ① 회사는 이용자의 사전 동의 없이 개인정보를 외부에 제공하지 않습니다. 다만, 다음의
            경우는 예외로 합니다.
          </p>
          <ul className="list-disc pl-5 space-y-1">
            <li>
              법령의 규정에 의거하거나 수사 목적으로 수사기관이 법령에 정해진 절차 및 방법에 따라
              요청하는 경우
            </li>
            <li>이용자가 사전에 동의한 목적 범위 내에서 제휴 금융기관에 제공하는 경우</li>
          </ul>
          <p className="mt-2">
            ② 이용자의 사전 동의하에 제3자에게 제공된 개인정보는 동의받은 목적 외의 용도로
            이용되지 않으며, 이용 목적이 변경되는 경우 별도의 동의를 받는 등 필요한 조치를
            이행합니다.
          </p>
        </div>

        <div>
          <h2 className="text-base font-semibold text-text-strong mb-2">
            제5조 개인정보 처리 위탁
          </h2>
          <p>
            ① 회사는 원활한 서비스 제공을 위해 일부 업무를 외부 전문 업체에 위탁하고 있습니다.
            위탁받은 업체가 관련 법령에 따라 개인정보를 안전하게 처리하도록 위탁 계약 시 필요한
            사항을 명시하고, 이행 여부를 지속적으로 관리·감독합니다.
          </p>
          <p className="mt-2">
            ② 위탁 계약에 따라 처리되는 개인정보는 회원 탈퇴 또는 위탁 계약 종료 시까지
            보유·이용됩니다. 위탁 업체의 세부 내용은 아임딜러 서비스 내 별도 공지를 통해
            안내합니다.
          </p>
        </div>

        <div>
          <h2 className="text-base font-semibold text-text-strong mb-2">
            제6조 개인정보의 파기 절차 및 방법
          </h2>
          <p>
            ① 회사는 개인정보 보유 기간의 경과 또는 처리 목적의 달성 등으로 개인정보가 불필요하게
            된 경우에는 지체 없이 해당 정보를 파기합니다. 다만, 법령에 따라 보존이 필요한 경우
            별도의 데이터베이스 또는 서류함으로 분리하여 해당 기간 동안 보관한 후 파기합니다.
          </p>
          <p className="mt-2">② 파기 방법은 다음과 같습니다.</p>
          <ul className="list-disc pl-5 space-y-1">
            <li>종이 문서: 분쇄기를 이용하여 분쇄하거나 소각하여 파기</li>
            <li>
              전자적 파일: 복구 및 재생이 불가능한 기술적 방법(덮어쓰기, 초기화 등)을 적용하여
              완전 삭제
            </li>
          </ul>
        </div>

        <div>
          <h2 className="text-base font-semibold text-text-strong mb-2">
            제7조 개인정보의 안전성 확보 조치
          </h2>
          <p>
            회사는 이용자의 개인정보를 안전하게 보호하기 위하여 개인정보 보호법, 신용정보의 이용
            및 보호에 관한 법률, 정보통신망 이용 촉진 및 정보보호 등에 관한 법률 등 관련 법령에서
            요구하는 사항을 준수하며, 다음과 같은 보호 조치를 시행하고 있습니다.
          </p>
          <p className="mt-2">
            기술적 조치로는 외부 해킹 및 악성코드에 대비한 침입 차단 시스템과 백신 소프트웨어를
            운영하며, 시스템별 접근 권한을 세분화하여 관리합니다. 이용자의 비밀번호는 암호화하여
            저장되며, 금융 관련 핵심 데이터는 별도의 암호화 알고리즘을 적용하여 보호합니다.
          </p>
          <p className="mt-2">
            관리적 조치로는 개인정보 내부 관리 계획을 수립·시행하고, 개인정보에 접근할 수 있는
            담당 인원을 최소화하며, 접근용 비밀번호를 주기적으로 갱신합니다. 개인정보 관련
            담당자에 대한 정기 교육을 통해 보안 의식을 유지합니다.
          </p>
          <p className="mt-2">
            물리적 조치로는 전산실(IDC 포함) 및 자료 보관실에 대한 물리적 출입 통제를 실시하여
            비인가자의 접근을 차단합니다.
          </p>
        </div>

        <div>
          <h2 className="text-base font-semibold text-text-strong mb-2">
            제8조 개인정보 자동 수집 장치의 설치·운영 및 거부에 관한 사항
          </h2>
          <p>
            회사는 아임딜러 서비스 이용자에게 개인화된 맞춤 서비스를 제공하기 위해 쿠키(Cookie)
            및 세션(Session)을 사용합니다. 쿠키란 웹사이트 서버가 이용자의 브라우저로 전송하는
            소량의 정보로, 이용자의 단말 기기에 저장됩니다.
          </p>
          <p className="mt-2">
            회사는 이용자가 아임딜러 웹사이트(https://www.imdealer.co.kr)에 접속할 때 저장된
            쿠키 정보를 확인하여 이용 형태 및 보안 접속 여부 등을 파악하고, 이를 바탕으로 최적의
            서비스를 제공합니다.
          </p>
          <p className="mt-2">
            이용자는 아래의 방법으로 쿠키 설치·운영을 거부할 수 있습니다. 단, 쿠키 저장을
            제한하는 경우 일부 맞춤형 서비스 이용에 불편이 발생할 수 있습니다.
          </p>
          <ul className="list-disc pl-5 space-y-1">
            <li>크롬: 설정 → 개인 정보 보호 및 보안 → 서드 파티 쿠키 → 서드 파티 쿠키 차단</li>
            <li>사파리: 환경설정 → 고급 → 개인정보 보호 → 모든 쿠키 차단</li>
            <li>
              엣지: 설정 → 쿠키 및 사이트 권한 → 쿠키 및 사이트 데이터 관리 및 삭제 → 사이트에서
              쿠키 데이터를 저장하고 읽도록 허용 해제
            </li>
          </ul>
        </div>

        <div>
          <h2 className="text-base font-semibold text-text-strong mb-2">제9조 가명정보의 처리</h2>
          <p>
            ① 회사는 통계 작성, 과학적 연구, 공익적 기록 보전 등의 목적으로 가명정보를 처리할 수
            있으며, 가명 처리 계획 수립 시 정한 목적 달성 기간까지만 보유·이용합니다.
          </p>
          <p className="mt-2">② 회사는 가명정보를 안전하게 관리하기 위해 다음의 조치를 이행합니다.</p>
          <ul className="list-disc pl-5 space-y-1">
            <li>
              관리적 조치: 내부 관리 계획 수립 및 시행, 가명정보 취급 직원 대상 정기 교육,
              가명정보 재식별 행위에 대한 정기 점검
            </li>
            <li>기술적 조치: 접근 권한 관리 및 접근 통제 시스템 운영</li>
            <li>물리적 조치: 전산실(IDC 포함) 및 자료 보관실 등 물리적 출입 통제</li>
          </ul>
        </div>

        <div>
          <h2 className="text-base font-semibold text-text-strong mb-2">
            제10조 개인정보 보호책임자
          </h2>
          <p>
            회사는 이용자의 개인정보를 보호하고 개인정보 관련 고충을 처리하기 위하여 아래와 같이
            개인정보 보호책임자를 지정하고 있습니다.
          </p>
          <div className="overflow-x-auto mt-3">
            <table className={TABLE}>
              <thead>
                <tr>
                  <th className={TH}>항목</th>
                  <th className={TH}>내용</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className={TD}>성명</td>
                  <td className={TD}>조수형</td>
                </tr>
                <tr>
                  <td className={TD}>직책</td>
                  <td className={TD}>대표</td>
                </tr>
                <tr>
                  <td className={TD}>이메일</td>
                  <td className={TD}>contact@metakium.co.kr</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p className="mt-3">
            개인정보 보호 관련 문의, 불만 처리, 피해 구제 등에 관한 사항은 위 담당자에게
            문의하시기 바랍니다.
          </p>
        </div>

        <div>
          <h2 className="text-base font-semibold text-text-strong mb-2">
            제11조 권익침해 구제 방법
          </h2>
          <p>
            이용자는 아래 기관에 개인정보 침해에 대한 피해 구제 및 상담을 요청하실 수 있습니다.
          </p>
          <ul className="list-disc pl-5 space-y-1">
            <li>개인정보 분쟁조정위원회: ☎ 1833-6972 (국번 없이)</li>
            <li>개인정보 침해 신고센터: ☎ 118 (국번 없이)</li>
            <li>대검찰청 사이버범죄수사단: ☎ 1301 (국번 없이)</li>
            <li>경찰청 사이버범죄 신고: ☎ 182 (국번 없이)</li>
          </ul>
        </div>

        <div>
          <h2 className="text-base font-semibold text-text-strong mb-2">
            제12조 본 개인정보처리방침의 적용 범위
          </h2>
          <p>
            본 개인정보처리방침은 (주)모빌페이브가 운영하는 아임딜러
            웹사이트(https://www.imdealer.co.kr) 및 관련 서비스 전반에 적용됩니다. 회사의
            서비스와 연결된 제3자의 웹사이트 또는 서비스에서 수집되는 개인정보에 대해서는 본
            방침이 적용되지 않으므로, 해당 사이트의 개인정보처리방침을 별도로 확인하시기 바랍니다.
          </p>
        </div>

        <div>
          <h2 className="text-base font-semibold text-text-strong mb-2">
            제13조 개인정보처리방침의 변경에 관한 사항
          </h2>
          <p>
            본 개인정보처리방침은 법령 또는 서비스의 변경 사항을 반영하기 위해 수정될 수 있습니다.
            변경이 있는 경우 회사는 아임딜러 서비스 내 공지사항 또는 이메일 등을 통해 변경 내용과
            시행 일자를 사전에 안내합니다.
          </p>
        </div>

        <div className="pt-4 border-t border-border-subtle">
          <p className="text-xs text-text-muted">시행일: 2026년 6월 17일</p>
        </div>
        </section>
      </div>
    </main>
  );
}
