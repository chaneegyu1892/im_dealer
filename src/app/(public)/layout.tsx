import { Header } from "@/components/layout/Header";

export default function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-neutral">
      <Header />
      <main>{children}</main>
    </div>
  );
}
