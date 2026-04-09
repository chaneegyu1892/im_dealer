import { Suspense } from "react";
import { Header } from "@/components/layout/Header";

export default function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-neutral">
      <Suspense fallback={<div className="h-[72px] bg-white border-b border-[#F0F0F0]" />}>
        <Header />
      </Suspense>
      <main>{children}</main>
    </div>
  );
}
