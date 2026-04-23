import { Suspense } from "react";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { BottomNav } from "@/components/layout/BottomNav";

export default function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-neutral flex flex-col">
      <Suspense fallback={<div className="h-[72px] bg-white border-b border-[#F0F0F0]" />}>
        <Header />
      </Suspense>
      <main className="flex-1 pb-[calc(62px+env(safe-area-inset-bottom,0px))] md:pb-0">
        {children}
      </main>
      <Footer />
      <BottomNav />
    </div>
  );
}
