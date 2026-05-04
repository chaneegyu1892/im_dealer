import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";
import type { AdminUser } from "@prisma/client";

export async function getAdminSession(): Promise<AdminUser | null> {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (user) {
      const admin = await prisma.adminUser.findUnique({
        where: { supabaseId: user.id },
      });
      if (admin && admin.isActive) return admin;
    }
  } catch (error) {
    console.error("[getAdminSession] Supabase session check failed:", error);
  }

  return null;
}
