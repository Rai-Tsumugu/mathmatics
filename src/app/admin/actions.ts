"use server";

import { revalidatePath } from "next/cache";
import type { AdminData } from "@/lib/admin-types";
import { writeAdminData } from "@/lib/admin-store";

export async function saveAdminDataAction(
  data: AdminData,
): Promise<
  { ok: true; data: AdminData } | { ok: false; error: string }
> {
  try {
    const saved = await writeAdminData(data);
    revalidatePath("/admin");
    return { ok: true, data: saved };
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof Error
          ? error.message
          : "管理データを保存できませんでした。",
    };
  }
}

