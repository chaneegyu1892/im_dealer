import { Suspense } from "react";
import { getAdminUsers } from "@/lib/admin-queries";
import UsersClient from "@/components/admin/users/UsersClient";

export default async function UsersPage() {
  const { users, stats } = await getAdminUsers();

  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center h-full bg-[#F8F9FC]">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#000666]" />
        </div>
      }
    >
      <UsersClient users={users} stats={stats} />
    </Suspense>
  );
}
