import { Suspense } from "react";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { BottomNav } from "@/components/layout/BottomNav";
import { ChannelTalk } from "@/components/layout/ChannelTalk";

export default function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="home-showroom-scope flex min-h-[100dvh] flex-col bg-app-bg text-text-body">
      <ChannelTalk />
      <Suspense
        fallback={
          <div className="h-[56px] border-b border-border-subtle bg-surface/95 backdrop-blur-xl lg:h-[72px]" />
        }
      >
        <Header />
      </Suspense>
      <main className="flex-1">
        {children}
      </main>
      <Footer />
      <BottomNav />
    </div>
  );
}
