import type { Metadata } from "next";
import { ChevronRight, ClipboardList, Info, ShieldAlert } from "lucide-react";
import {
  FINANCE_PRODUCTS,
  type FinanceProduct,
  type FinanceTable,
} from "./finance-products";
import { LegalText } from "./LegalText";

export const metadata: Metadata = {
  title: "서비스 법적 고지 및 금융상품 안내 | 아임딜러",
  description:
    "(주)모빌페이브 아임딜러(IM DEALER) 서비스 법적 고지 및 제휴 금융사별 상품 안내",
};

const TABLE = "w-full min-w-[640px] border-collapse text-xs sm:text-sm";
const TH =
  "border border-border-subtle bg-surface-soft px-3 py-2 text-left font-semibold text-text-strong whitespace-nowrap";
const TD =
  "break-keep border border-border-subtle px-3 py-2 align-top text-pretty text-text-body";
const TD_HEAD =
  "border border-border-subtle bg-surface-soft px-3 py-2 align-top font-medium text-text-strong whitespace-nowrap";

function DataTable({ caption, headers, rows }: FinanceTable) {
  return (
    <div className="mt-3">
      {caption && (
        <p className="mb-2 break-keep text-pretty text-[13px] font-medium text-text-strong">
          <LegalText text={caption} />
        </p>
      )}
      <div className="overflow-x-auto rounded-[14px] border border-border-subtle bg-surface">
        <table className={TABLE}>
          <thead>
            <tr>
              {headers.map((h, i) => (
                <th key={i} className={TH}>
                  <LegalText text={h} />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, ri) => (
              <tr key={ri}>
                {row.map((cell, ci) => (
                  <td key={ci} className={ci === 0 ? TD_HEAD : TD}>
                    <LegalText text={cell} />
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
      <h3 className="mb-1 flex break-keep items-center gap-1.5 text-pretty text-[15px] font-semibold text-brand">
        <ChevronRight size={16} aria-hidden="true" />
        <LegalText text={product.title} />
      </h3>
      <DataTable {...product.table} />

      {product.formulas && product.formulas.length > 0 && (
        <div className="mt-3 space-y-1">
          {product.formulas.map((formula, i) => (
            <p
              key={i}
              className="break-keep rounded-[12px] border border-border-subtle bg-surface-soft px-3 py-2 text-pretty text-[13px] text-text-body"
            >
              <LegalText text={formula} />
            </p>
          ))}
        </div>
      )}

      {product.subTable && <DataTable {...product.subTable} />}

      {product.notes && product.notes.length > 0 && (
        <ul className="mt-3 list-disc space-y-1 pl-5 text-[13px] text-text-body">
          {product.notes.map((note, i) => (
            <li key={i} className="break-keep text-pretty">
              <LegalText text={note} />
            </li>
          ))}
        </ul>
      )}

      {product.approvals && product.approvals.length > 0 && (
        <div className="mt-3 space-y-0.5">
          {product.approvals.map((approval, i) => (
            <p
              key={i}
              className="break-keep text-pretty text-[11px] text-text-muted"
            >
              <LegalText text={approval} />
            </p>
          ))}
        </div>
      )}
    </div>
  );
}

const COMMON_NOTICES_BEFORE_REGISTRY = [
  "위 견적의 월 납입금 등은 차량 탐색과 비교를 위한 예시이며, 실제 월 납입금과 계약 조건은 금융회사의 심사 결과, 계약 시점의 차량 가격, 계약기간, 보증금·선납금, 약정 주행거리 및 기타 선택 조건에 따라 달라질 수 있습니다.",
  "‘5일 도착’은 공휴일을 제외한 영업일 기준이며, 차량 재고, 출고 일정, 탁송 지역 및 제조사 사정에 따라 실제 인도 기간이 달라질 수 있습니다.",
  "아임딜러는 주식회사 모빌페이브가 운영하는 자동차 장기렌트·리스 차량 탐색 및 예상 견적 정보 제공 플랫폼입니다.",
  "주식회사 모빌페이브는 금융상품 계약을 직접 체결하거나 금융회사를 대신하여 금융상품을 승인·실행할 권한이 없습니다.",
  "금융상품에 관한 실제 상담, 상품 설명, 계약 조건 안내, 신청서 접수 및 금융회사 전달 등의 금융상품 판매대리·중개 업무는 금융회사와 위탁계약을 체결하고 관련 금융업협회에 등록된 금융상품판매대리·중개업자가 직접 수행합니다.",
  "아임딜러를 통해 금융상품 상담 및 중개 업무를 수행하는 등록 모집인은 다음과 같습니다.",
] as const;

const COMMON_NOTICES_AFTER_REGISTRY = [
  "등록 모집인은 각자 등록된 계약 금융회사와 취급상품의 범위 안에서만 금융상품 상담 및 중개 업무를 수행합니다. 등록되지 않은 금융회사의 상품을 상담하거나 중개하지 않습니다.",
  "금융상품의 여신 심사, 승인, 최종 계약 체결 및 실행은 해당 금융회사가 직접 수행합니다. 금융회사의 심사 기준을 충족하지 못하는 경우 신청이 거절되거나 상품 이용이 제한될 수 있습니다.",
  "본 서비스를 통해 금융상품 계약을 체결하는 경우 계약 당사자는 고객과 해당 금융회사이며, 주식회사 모빌페이브 및 등록 모집인은 금융상품 계약을 직접 체결할 권한이 없습니다.",
  "주식회사 모빌페이브와 등록 모집인은 서비스 이용 또는 금융상품 상담과 관련하여 고객에게 별도의 수수료나 금전적 대가를 요구하거나 수취하지 않습니다. 또한 금융회사를 대신하여 보증금, 선납금, 월 납입금 및 기타 계약 관련 금전을 직접 수취하지 않습니다.",
  "금융상품 신청을 위해 고객이 제공한 개인·신용정보와 신청서류는 담당 등록 모집인을 통해 해당 금융회사에 전달되며, 계약 당사자인 금융회사가 관련 법령과 개인정보처리방침에 따라 보유·관리합니다.",
  "금융소비자는 「금융소비자 보호에 관한 법률」에 따라 금융상품의 주요 내용, 계약 조건, 비용, 중도해지 조건 및 위험 등에 관하여 충분한 설명을 받을 권리가 있습니다.",
  "계약을 체결하기 전에 반드시 해당 금융회사가 제공하는 금융상품설명서, 약정서 및 약관을 확인하고 상품의 내용과 조건을 충분히 이해하시기 바랍니다.",
  "상환능력에 비해 금융부담이 과도할 경우 개인신용평점이 하락할 수 있으며, 개인신용평점 하락 시 금융거래와 관련된 불이익이 발생할 수 있습니다. 일정 기간 월 납입금 또는 원리금을 연체할 경우 차량 반환, 계약 해지, 연체이자 부과 또는 계약상 채무 전액의 변제 의무가 발생할 수 있습니다.",
] as const;

const COMMON_CAUTIONS = [
  "금융소비자는 「금융소비자 보호에 관한 법률」 제19조 제1항에 따라 해당 상품 또는 서비스에 대하여 설명을 받을 권리가 있으며, 충분히 이해한 후 거래하시기 바랍니다.",
  "상환능력에 비해 대출금이 과도할 경우 귀하의 개인신용평점이 하락할 수 있습니다.",
  "개인신용평점 하락 시 금융거래와 관련된 불이익이 발생할 수 있습니다.",
  "일정기간 원리금을 연체할 경우 모든 원리금을 변제할 의무가 발생할 수 있습니다.",
  "대출취급이 부적정한 경우(연체금 보유, 신용점수 낮음 등) 대출이 제한될 수 있습니다.",
  "계약 체결 전 반드시 상품설명서와 약관을 확인하시기 바랍니다.",
  "(주)모빌페이브(아임딜러)는 고객에게 별도의 수수료를 요구하거나 수취하지 않습니다.",
] as const;

export default function FinanceTermsPage() {
  return (
    <main className="public-app-page min-h-screen">
      <div className="page-container mx-auto max-w-3xl px-5 pt-12 pb-[calc(128px+env(safe-area-inset-bottom,0px))] md:py-16">
        <h1 className="mb-2 break-keep text-pretty text-[26px] font-extrabold leading-tight text-text-strong md:text-[32px]">
          아임딜러 서비스 법적 고지 및{" "}
          <span className="whitespace-nowrap">금융상품 안내</span>
        </h1>
        <p className="mb-10 break-keep text-pretty text-sm text-text-muted">
          (주)모빌페이브 | 아임딜러(IM DEALER)
        </p>

        <section className="space-y-10">
          <div>
            <h2 className="mb-3 flex break-keep items-center gap-2 text-pretty text-base font-semibold text-text-strong">
              <Info size={18} className="text-brand" aria-hidden="true" />
              서비스 공통 안내사항
            </h2>
            <ul className="list-disc space-y-2 pl-5 text-[13px] leading-relaxed text-text-body">
              {COMMON_NOTICES_BEFORE_REGISTRY.map((notice, i) => (
                <li key={i} className="break-keep text-pretty">
                  <LegalText text={notice} />
                </li>
              ))}
              <li className="break-keep text-pretty">
                <span className="whitespace-nowrap">성명: 오영택 /</span>{" "}
                <span className="whitespace-nowrap">등록번호: 10-00052163 /</span>{" "}
                <span className="whitespace-nowrap">취급상품: 리스·렌트</span>
              </li>
              <li className="break-keep text-pretty">
                대출모집인 조회(
                <a
                  href="https://www.loanconsultant.or.kr"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="break-words text-brand underline"
                >
                  www.loanconsultant.or.kr
                </a>
                ){" "}
                <LegalText text="및 대출성 상품 금융상품 판매대리·중개업 등록증표를 통해 신원 확인이 가능합니다." />
              </li>
              {COMMON_NOTICES_AFTER_REGISTRY.map((notice, i) => (
                <li key={i} className="break-keep text-pretty">
                  <LegalText text={notice} />
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h2 className="mb-3 flex break-keep items-center gap-2 text-pretty text-base font-semibold text-text-strong">
              <ClipboardList
                size={18}
                className="text-brand"
                aria-hidden="true"
              />
              제휴 금융사별 상품 안내
            </h2>
            <div className="space-y-6 divide-y divide-border-subtle">
              {FINANCE_PRODUCTS.map((product, i) => (
                <ProductCard key={i} product={product} />
              ))}
            </div>
          </div>

          <div>
            <h2 className="mb-3 flex break-keep items-center gap-2 text-pretty text-base font-semibold text-text-strong">
              <ShieldAlert
                size={18}
                className="text-status-warning"
                aria-hidden="true"
              />
              공통 유의사항
            </h2>
            <p className="mb-2 break-keep text-pretty text-[13px] text-text-body">
              모든 금융상품에 공통으로 적용되는 사항입니다.
            </p>
            <ul className="list-disc space-y-2 pl-5 text-[13px] leading-relaxed text-text-body">
              {COMMON_CAUTIONS.map((caution, i) => (
                <li key={i} className="break-keep text-pretty">
                  <LegalText text={caution} />
                </li>
              ))}
            </ul>
          </div>

          <div className="border-t border-border-subtle pt-4">
            <p className="break-keep text-pretty text-xs text-text-muted">
              시행일: 2026년 6월 17일
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}
