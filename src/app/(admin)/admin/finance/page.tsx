import { getAdminFinanceCompanies, getAdminVehicles } from "@/lib/admin-queries";
import { getAdminSession } from "@/lib/admin-auth";
import { redirect } from "next/navigation";
import FinanceTabContainer from "@/components/admin/finance/FinanceTabContainer";

export const metadata = { title: "견적 산출 로직 관리 | 아임딜러 어드민" };

export default async function FinancePage() {
  const session = await getAdminSession();
  if (!session) redirect("/admin/login");

  const [financeCompanies, vehicles] = await Promise.all([
    getAdminFinanceCompanies(),
    getAdminVehicles(),
  ]);

  return (
    <div className="flex flex-col h-full space-y-6">
      <div className="flex flex-col">
        <h1 className="text-2xl font-bold text-[#1A1A2E]">견적 산출 로직 관리</h1>
        <p className="text-sm text-[#9BA4C0] mt-1">이미지의 가산 단계별 로직을 검증하고 정책을 결정합니다.</p>
      </div>

      <FinanceTabContainer 
        financeCompanies={financeCompanies} 
        vehicles={vehicles} 
      />
    </div>
  );
}
