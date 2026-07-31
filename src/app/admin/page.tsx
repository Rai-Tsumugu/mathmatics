import type { Metadata } from "next";
import { AdminShell } from "@/components/admin/AdminShell";
import { readAdminData } from "@/lib/admin-store";

export const metadata: Metadata = {
  title: "管理画面",
  description: "教材制作・問題バンク・レビュー工程を管理します。",
};

export default async function AdminPage() {
  const data = await readAdminData();
  return (
    <AdminShell
      initialData={data}
      writable={process.env.NODE_ENV !== "production"}
    />
  );
}

