import { redirect } from "next/navigation";
import { QuotationTable } from "@/components/admin/quotations/QuotationTable";
import { getAdminSession } from "@/lib/admin-auth";
import { getAdminQuotes } from "@/lib/admin-queries";

export default async function AdminQuotationsPage() {
  const session = await getAdminSession();
  if (!session) redirect("/admin/login");

  const { data, total } = await getAdminQuotes(1, 100);

  return <QuotationTable initialQuotes={data} total={total} />;
}
