"use client";

import { motion } from "framer-motion";
import { Check, Users } from "lucide-react";

export interface DetailTag {
  icon: React.ReactNode;
  label: string;
}

export function CarDetailRecommendationSection({
  tags,
  highlights,
}: {
  tags: DetailTag[];
  highlights: string[];
}) {
  return (
    <motion.section
      initial={false}
      className="t-card overflow-hidden shadow-soft"
    >
      <div className="flex items-center gap-2.5 border-b border-line bg-surface-muted px-5 py-4 md:px-6">
        <span className="t-iconbtn h-8 w-8 bg-brand-soft text-brand">
          <Users size={15} />
        </span>
        <p className="text-[15px] font-extrabold text-ink">이런 분께 추천드려요</p>
      </div>

      <div className="px-5 py-5 md:px-6">
        <div className="mb-5 flex flex-wrap gap-2">
          {tags.map(({ icon, label }) => (
            <span key={label} className="t-tag gap-1.5">
              {icon}
              {label}
            </span>
          ))}
        </div>

        {highlights.length > 0 && (
          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
            {highlights.map((highlight) => (
              <div
                key={highlight}
                className="flex items-start gap-2.5 rounded-[16px] border border-line bg-surface-muted p-3.5"
              >
                <span className="mt-0.5 flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full bg-brand">
                  <Check size={9} strokeWidth={3} className="text-white" />
                </span>
                <p className="text-[12.5px] leading-snug text-ink-label">{highlight}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </motion.section>
  );
}
