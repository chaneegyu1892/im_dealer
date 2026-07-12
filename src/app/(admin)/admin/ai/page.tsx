import { getAiInsights, getVehicleAiConfigs } from "@/lib/admin-ai-queries";
import AiInsightDashboard from "@/components/admin/ai/AiInsightDashboard";
import VehicleAiSettings from "@/components/admin/ai/VehicleAiSettings";

export const metadata = { title: "AI 추천 관리 | 아임딜러 어드민" };

export default async function AiManagementPage() {
  const [insights, configs] = await Promise.all([
    getAiInsights(),
    getVehicleAiConfigs(),
  ]);

  return (
    <div className="flex flex-col h-full min-h-0 space-y-4 md:space-y-6">
      <div className="flex flex-col">
        <h1 className="text-xl md:text-2xl font-bold text-[#1A1A2E]">AI 추천 관리</h1>
        <p className="text-[12px] md:text-sm text-[#9BA4C0] mt-1 hidden sm:block">
          사용자 추천 로그를 분석하고 차량별 AI 가중치를 조정하여 추천 품질을 고도화합니다.
        </p>
      </div>

      <div className="flex-1 flex flex-col gap-6 md:gap-8 overflow-y-auto scrollbar-hide">
        {/* 섹션 1: 추천 인사이트 */}
        <section>
          <div className="flex items-center gap-2 mb-3">
            <div className="w-1.5 h-4 bg-[#6066EE] rounded-full shrink-0"></div>
            <h2 className="text-base md:text-lg font-bold text-[#1A1A2E]">추천 성과 인사이트</h2>
          </div>
          <AiInsightDashboard data={insights} />
        </section>

        {/* 섹션 2: 차량별 설정 */}
        <section className="flex-1 min-h-0">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-1.5 h-4 bg-[#6066EE] rounded-full shrink-0"></div>
            <h2 className="text-base md:text-lg font-bold text-[#1A1A2E]">
              <span className="hidden sm:inline">차량별 AI 가산점 및 하이라이트 설정</span>
              <span className="sm:hidden">차량별 AI 설정</span>
            </h2>
          </div>
          <VehicleAiSettings initialConfigs={configs.flatMap((row) => row.config ? [{
            id: row.config.id,
            highlights: [...row.config.highlights],
            aiCaption: row.config.aiCaption,
            scoreMatrix: row.config.profile,
            vehicle: {
              name: row.vehicle.name,
              brand: row.vehicle.brand,
              category: row.vehicle.category,
            },
          }] : [])} />
        </section>
      </div>
    </div>
  );
}
