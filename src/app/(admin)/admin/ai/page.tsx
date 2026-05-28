import { getAiInsights, getVehicleAiConfigs } from "@/lib/admin-ai-queries";
import AiInsightDashboard from "@/components/admin/ai/AiInsightDashboard";
import VehicleAiSettings from "@/components/admin/ai/VehicleAiSettings";
import FlowConfigEditor from "@/components/admin/ai/FlowConfigEditor";
import { DEFAULT_FLOW_CONFIG } from "@/lib/recommend-config";
import { prisma } from "@/lib/prisma";

export const metadata = { title: "AI 추천 관리 | 아임딜러 어드민" };

async function getFlowConfig() {
  try {
    const row = await (prisma as any).recommendFlowConfig.findUnique({
      where: { id: "singleton" },
    });
    if (row) return { questions: row.questions, scoring: row.scoring };
  } catch {
    // 테이블 미생성 시 기본값
  }
  return DEFAULT_FLOW_CONFIG;
}

export default async function AiManagementPage() {
  const [insights, configs, flowConfig] = await Promise.all([
    getAiInsights(),
    getVehicleAiConfigs(),
    getFlowConfig(),
  ]);

  return (
    <div className="flex flex-col h-full min-h-0 space-y-4 md:space-y-6">
      <div className="flex flex-col">
        <h1 className="text-xl md:text-2xl font-bold text-[#1A1A2E]">AI 추천 관리</h1>
        <p className="text-[12px] md:text-sm text-[#9BA4C0] mt-1 hidden sm:block">
          추천 플로우 설정, 점수 규칙, 차량별 가중치를 통합 관리합니다.
        </p>
      </div>

      <div className="flex-1 flex flex-col gap-6 md:gap-8 overflow-y-auto scrollbar-hide">

        {/* 섹션 1: 플로우 설정 (신규) */}
        <section>
          <div className="flex items-center gap-2 mb-3">
            <div className="w-1.5 h-4 bg-[#6066EE] rounded-full shrink-0" />
            <h2 className="text-base md:text-lg font-bold text-[#1A1A2E]">추천 플로우 설정</h2>
          </div>
          <FlowConfigEditor initialConfig={flowConfig} />
        </section>

        {/* 섹션 2: 추천 인사이트 */}
        <section>
          <div className="flex items-center gap-2 mb-3">
            <div className="w-1.5 h-4 bg-[#6066EE] rounded-full shrink-0" />
            <h2 className="text-base md:text-lg font-bold text-[#1A1A2E]">추천 성과 인사이트</h2>
          </div>
          <AiInsightDashboard data={insights} />
        </section>

        {/* 섹션 3: 차량별 설정 */}
        <section className="flex-1 min-h-0">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-1.5 h-4 bg-[#6066EE] rounded-full shrink-0" />
            <h2 className="text-base md:text-lg font-bold text-[#1A1A2E]">
              <span className="hidden sm:inline">차량별 AI 가산점 및 하이라이트 설정</span>
              <span className="sm:hidden">차량별 AI 설정</span>
            </h2>
          </div>
          <VehicleAiSettings initialConfigs={configs} />
        </section>
      </div>
    </div>
  );
}
