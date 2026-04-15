import { getAdminQuotes } from "@/lib/admin-queries";
import { QuotationTable } from "@/components/admin/quotations/QuotationTable";

export default async function AdminQuotationsPage() {
  const { data, total } = await getAdminQuotes(1, 100);
  return <QuotationTable initialQuotes={data} total={total} />;
}
