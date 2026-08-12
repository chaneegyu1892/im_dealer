"use client";

import { createContext, useContext } from "react";

export interface AdminSessionUser {
  id: string;
  name: string;
  email: string;
  role: string;
}

const AdminSessionContext = createContext<AdminSessionUser | null>(null);

export function AdminSessionProvider({
  admin,
  children,
}: {
  admin: AdminSessionUser;
  children: React.ReactNode;
}) {
  return (
    <AdminSessionContext.Provider value={admin}>
      {children}
    </AdminSessionContext.Provider>
  );
}

export function useAdminSession(): AdminSessionUser {
  const admin = useContext(AdminSessionContext);
  if (!admin) {
    throw new Error("useAdminSession must be used within AdminSessionProvider");
  }
  return admin;
}
