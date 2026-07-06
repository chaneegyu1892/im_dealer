import type { Metadata } from "next";
import { ChevronRight, ClipboardList, Info, ShieldAlert } from "lucide-react";
import {
  FINANCE_PRODUCTS,
  type FinanceProduct,
  type FinanceTable,
} from "./finance-products";

export const metadata: Metadata = {
  title: "서비스 법적 고지 및 금융상품 안내 | 아임딜러",
  description:
    "(주)모빌페이브 아임딜러(IM DEALER) 서비스 법적 고지 및 제휴 금융사별 상품 안내",
};

const TABLE = "w-full min-w-[640px] border-collapse text-xs sm:text-sm";
const TH =
  "border border-border-subtle bg-surface-soft px-3 py-2 text-left font-semibold text-text-strong whitespace-nowrap";
const TD = "border border-border-subtle px-3 py-2 align-top text-text-body";
const TD_HEAD =
  "border border-border-subtle bg-surface-soft px-3 py-2 align-top font-medium text-text-strong whitespace-nowrap";

function DataTable({ caption, headers, rows }: FinanceTable) {
  return (
    <div className="mt-3">
      {caption && (
        <p className="mb-2 text-[13px] font-medium text-text-strong">{caption}</p>
      )}
      <div className="overflow-x-auto rounded-[14px] border border-border-subtle bg-surface">
        <table className={TABLE}>
          <thead>
            <tr>
              {headers.map((h, i) => (
                <th key={i} className={TH}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, ri) => (
              <tr key={ri}>
                {row.map((cell, ci) => (
                  <td key={ci} className={ci === 0 ? TD_HEAD : TD}>
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ProductCard({ product }: { product: FinanceProduct }) {
  return (
    <div className="pt-2">
      <h3 className="mb-1 flex items-center gap-1.5 text-[15px] font-semibold text-brand">
        <ChevronRight size={16} aria-hidden="true" />
        {product.title}
      </h3>
      <DataTable {...product.table} />

      {product.formulas && product.formulas.length > 0 && (
        <div className="mt-3 space-y-1">
          {product.formulas.map((formula, i) => (
            <p
              key={i}
              className="rounded-[12px] border border-border-subtle bg-surface-soft px-3 py-2 text-[13px] text-text-body"
            >
              {formula}
            </p>
          ))}
        </div>
      )}

      {product.subTable && <DataTable {...product.subTable} />}

      {product.notes && product.notes.length > 0 && (
        <ul className="list-disc pl-5 space-y-1 mt-3 text-[13px] text-text-body">
          {product.notes.map((note, i) => (
            <li key={i}>{note}</li>
          ))}
        </ul>
      )}

      {product.approvals && product.approvals.length > 0 && (
        <div className="mt-3 space-y-0.5">
          {product.approvals.map((approval, i) => (
            <p key={i} className="text-[11px] text-text-muted">
              {approval}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}

const COMMON_NOTICES: string[] = [
  "위 견적의 월 납입금 등은 예시로, 실제 월 납입금 산정 시 차이가 발생될 수 있습니다. 5일 도착 기준은 공휴일을 제외한 영업일 기준입니다.",
  "(주)모빌페이브(아임딜러)는 BNK캐피탈, 하나캐피탈, 롯데캐피탈, NH농협캐피탈, JB우리캐피탈, 우리금융캐피탈, 신한카드, 메리츠캐피탈, 오릭스캐피탈코리아, iM캐피탈, 우리카드, 산은캐피탈, KB캐피탈의 자동차 리스·렌트 등의 상품 판매업무를 대리·중개합니다.",
  "(주)모빌페이브(아임딜러)는 제휴 금융회사의 자동차 리스·렌트 상품에 대한 계약 체결 권한이 없습니다.",
  "(주)모빌페이브(아임딜러)는 「금융소비자 보호에 관한 법률」에 따라 등록된 금융상품판매대리·중개업자입니다. (등록번호: 기재 예정)",
  "(주)모빌페이브(아임딜러)는 서비스 이용과 관련하여 이용자에게 어떠한 금전적 대가도 받지 않으며, 금융회사를 대신하여 보증금, 월 납부금 등 각종 금전을 받지 않습니다.",
  "(주)모빌페이브(아임딜러)와 제휴한 각 금융회사가 여신 심사 등을 거쳐 이용자와 직접 계약을 체결하며, 본 서비스를 통해 상품 계약을 체결하는 경우 계약의 주체는 해당 금융회사가 됩니다.",
  "본 계약을 위하여 금융소비자인 고객이 제공한 개인(신용)정보 등은 계약 당사자인 금융기관이 직접 보유·관리합니다.",
  "금융회사의 승인 조건을 충족하지 않는 경우 승인이 거절될 수 있으며, 이 경우 상품 이용이 어렵습니다.",
  "계약을 체결하기 전에 반드시 상품설명서 및 약관을 확인하시기 바랍니다.",
  "(주)모빌페이브(아임딜러)가 고의 또는 과실로 「금융소비자 보호에 관한 법률」을 위반하여 고객에게 손해를 발생시킨 경우, (주)모빌페이브는 그 손해를 배상할 책임이 있습니다. 다만, 고의 및 과실이 없음을 입증할 경우 그러하지 아니합니다.",
];

const COMMON_CAUTIONS: string[] = [
  "금융소비자는 「금융소비자 보호에 관한 법률」 제19조 제1항에 따라 해당 상품 또는 서비스에 대하여 설명을 받을 권리가 있으며, 충분히 이해한 후 거래하시기 바랍니다.",
  "상환능력에 비해 대출금이 과도할 경우 귀하의 개인신용평점이 하락할 수 있습니다.",
  "개인신용평점 하락 시 금융거래와 관련된 불이익이 발생할 수 있습니다.",
  "일정기간 원리금을 연체할 경우 모든 원리금을 변제할 의무가 발생할 수 있습니다.",
  "대출취급이 부적정한 경우(연체금 보유, 신용점수 낮음 등) 대출이 제한될 수 있습니다.",
  "계약 체결 전 반드시 상품설명서와 약관을 확인하시기 바랍니다.",
  "(주)모빌페이브(아임딜러)는 고객에게 별도의 수수료를 요구하거나 수취하지 않습니다.",
];

export default function FinanceTermsPage() {
  return (
    <main className="public-app-page min-h-screen">
      <div className="page-container mx-auto max-w-3xl px-5 pt-12 pb-[calc(128px+env(safe-area-inset-bottom,0px))] md:py-16">
        <h1 className="mb-2 text-[26px] font-extrabold leading-tight text-text-strong md:text-[32px]">
          아임딜러 서비스 법적 고지 및 금융상품 안내
        </h1>
        <p className="mb-10 text-sm text-text-muted">
          (주)모빌페이브 | 아임딜러(IM DEALER)
        </p>

        <section className="space-y-10">
          <div>
            <h2 className="mb-3 flex items-center gap-2 text-base font-semibold text-text-strong">
              <Info size={18} className="text-brand" aria-hidden="true" />
              서비스 공통 안내사항
            </h2>
            <ul className="list-disc pl-5 space-y-2 text-[13px] leading-relaxed text-text-body">
              {COMMON_NOTICES.map((notice, i) => (
                <li key={i}>{notice}</li>
              ))}
              <li>
                대출모집법인 조회(
                <a
                  href="https://www.loanconsultant.or.kr"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-brand underline"
                >
                  www.loanconsultant.or.kr
                </a>
                ) 및 대출성 상품 금융상품 판매대리·중개업 등록증표를 통해 신원 확인이 가능합니다.
              </li>
            </ul>
          </div>

        <div>
          <h2 className="mb-3 flex items-center gap-2 text-base font-semibold text-text-strong">
            <ClipboardList size={18} className="text-brand" aria-hidden="true" />
            제휴 금융사별 상품 안내
          </h2>
          <div className="space-y-6 divide-y divide-border-subtle">
            {FINANCE_PRODUCTS.map((product, i) => (
              <ProductCard key={i} product={product} />
            ))}
          </div>
        </div>

        <div>
          <h2 className="mb-3 flex items-center gap-2 text-base font-semibold text-text-strong">
            <ShieldAlert size={18} className="text-status-warning" aria-hidden="true" />
            공통 유의사항
          </h2>
          <p className="text-[13px] text-text-body mb-2">
            모든 금융상품에 공통으로 적용되는 사항입니다.
          </p>
          <ul className="list-disc pl-5 space-y-2 text-[13px] text-text-body leading-relaxed">
            {COMMON_CAUTIONS.map((caution, i) => (
              <li key={i}>{caution}</li>
            ))}
          </ul>
        </div>

          <div className="border-t border-border-subtle pt-4">
            <p className="text-xs text-text-muted">시행일: 2026년 6월 17일</p>
          </div>
        </section>
      </div>
    </main>
  );
}
