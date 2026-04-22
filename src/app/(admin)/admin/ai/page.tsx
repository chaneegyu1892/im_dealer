import { getAiInsights, getVehicleAiConfigs } from "@/lib/admin-ai-queries";
import { getAdminSession } from "@/lib/admin-auth";
import { redirect } from "next/navigation";
import AiInsightDashboard from "@/components/admin/ai/AiInsightDashboard";
import VehicleAiSettings from "@/components/admin/ai/VehicleAiSettings";

export const metadata = { title: "AI 추천 관리 | 아임딜러 어드민" };

export default async function AiManagementPage() {
  const session = await getAdminSession();
  if (!session) redirect("/admin/login");

  const [insights, configs] = await Promise.all([
    getAiInsights(),
    getVehicleAiConfigs(),
  ]);

  return (
    <div className="flex flex-col h-full min-h-0 space-y-6">
      <div className="flex flex-col">
        <h1 className="text-2xl font-bold text-[#1A1A2E]">AI 추천 관리</h1>
        <p className="text-sm text-[#9BA4C0] mt-1">
          사용자 추천 로그를 분석하고 차량별 AI 가중치를 조정하여 추천 품질을 고도화합니다.
        </p>
      </div>

      <div className="flex flex-col gap-8">
        {/* 섹션 1: 추천 인사이트 */}
        <section>
          <div className="flex items-center gap-2 mb-4">
            <div className="w-1.5 h-4 bg-[#6066EE] rounded-full"></div>
            <h2 className="text-lg font-bold text-[#1A1A2E]">추천 성과 인사이트</h2>
          </div>
          <AiInsightDashboard data={insights} />
        </section>

        {/* 섹션 2: 차량별 설정 */}
        <section className="flex-1 min-h-0">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-1.5 h-4 bg-[#6066EE] rounded-full"></div>
            <h2 className="text-lg font-bold text-[#1A1A2E]">차량별 AI 가산점 및 하이라이트 설정</h2>
          </div>
          <VehicleAiSettings initialConfigs={configs} />
        </section>
      </div>
    </div>
  );
}
