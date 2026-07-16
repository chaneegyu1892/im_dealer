"use client";

import { useState } from "react";
import { Calculator, Settings2, Database, Landmark, type LucideIcon } from "lucide-react";
import CapitalRateManager from "./CapitalRateManager";
import CapitalCatalogManager from "./catalog/CapitalCatalogManager";
import QuoteLogicSimulator from "./QuoteLogicSimulator";
import SurchargePolicy from "./SurchargePolicy";

interface Props {
  financeCompanies: any[];
  vehicles: any[];
}

export default function FinanceTabContainer({ financeCompanies, vehicles }: Props) {
  type TabId = "simulator" | "policy" | "data" | "capital";
  const [activeTab, setActiveTab] = useState<TabId>("simulator");

  const tabs = [
    { id: "simulator", label: "견적 시뮬레이터", icon: Calculator },
    { id: "policy", label: "가산 정책 관리", icon: Settings2 },
    { id: "data", label: "회수율 데이터 관리", icon: Database },
    { id: "capital", label: "캐피탈사 데이터", icon: Landmark },
  ] satisfies ReadonlyArray<{ id: TabId; label: string; icon: LucideIcon }>;

  return (
    <div className="flex flex-col gap-6 h-full overflow-hidden">
      {/* 상단 탭 네비게이션 */}
      <div className="overflow-x-auto scrollbar-hide -mx-0.5">
        <div className="flex items-center gap-1.5 bg-white p-1 rounded-2xl border border-[#E8EAF0] shadow-sm w-max min-w-full">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1.5 px-3 sm:px-6 py-2 sm:py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all whitespace-nowrap ${
                activeTab === tab.id
                  ? "bg-[#6066EE] text-white shadow-md shadow-indigo-100"
                  : "text-[#9BA4C0] hover:bg-[#F8F9FC] hover:text-[#5A6080]"
              }`}
            >
              <tab.icon size={14} />
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* 컨텐츠 렌더링 */}
      <div className="flex-1 overflow-y-auto scrollbar-hide">
        {activeTab === "simulator" && (
          <div className="animate-in fade-in duration-300">
            <QuoteLogicSimulator />
          </div>
        )}
        
        {activeTab === "policy" && (
          <div className="animate-in fade-in duration-300">
            <SurchargePolicy />
          </div>
        )}

        {activeTab === "data" && (
          <div className="animate-in fade-in duration-300">
            <div className="bg-white rounded-2xl border border-[#E8EAF0] shadow-sm overflow-hidden">
              <CapitalRateManager
                financeCompanies={financeCompanies}
                vehicles={vehicles}
              />
            </div>
          </div>
        )}

        {activeTab === "capital" && (
          <div className="animate-in fade-in duration-300">
            <CapitalCatalogManager financeCompanies={financeCompanies} vehicles={vehicles} />
          </div>
        )}
      </div>
    </div>
  );
}
