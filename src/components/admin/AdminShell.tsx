"use client";

import { useState, useTransition } from "react";
import { saveAdminDataAction } from "@/app/admin/actions";
import type {
  AdminData,
  AdminUnitRecord,
  ProblemRecord,
} from "@/lib/admin-types";
import { AdminOverview } from "@/components/admin/AdminOverview";
import { AdminProblems } from "@/components/admin/AdminProblems";
import { AdminReviews } from "@/components/admin/AdminReviews";
import { AdminUnits } from "@/components/admin/AdminUnits";

type AdminView = "overview" | "units" | "problems" | "reviews";

const views: Array<{ id: AdminView; label: string; description: string }> = [
  { id: "overview", label: "概要", description: "制作状況と課題" },
  { id: "units", label: "単元管理", description: "教材と公開状態" },
  { id: "problems", label: "問題バンク", description: "作問と難易度" },
  { id: "reviews", label: "レビュー", description: "品質確認と承認" },
];

export function AdminShell({
  initialData,
  writable,
}: {
  initialData: AdminData;
  writable: boolean;
}) {
  const [data, setData] = useState(initialData);
  const [activeView, setActiveView] = useState<AdminView>("overview");
  const [dirty, setDirty] = useState(false);
  const [message, setMessage] = useState("");
  const [isPending, startTransition] = useTransition();

  function updateUnit(unitId: string, patch: Partial<AdminUnitRecord>) {
    setData((current) => ({
      ...current,
      units: {
        ...current.units,
        [unitId]: {
          ...current.units[unitId],
          ...patch,
          updatedAt: new Date().toISOString(),
        },
      },
    }));
    setDirty(true);
    setMessage("");
  }

  function addProblem(problem: ProblemRecord) {
    setData((current) => ({
      ...current,
      problems: [...current.problems, problem],
    }));
    setDirty(true);
    setMessage("");
  }

  function updateProblem(problemId: string, patch: Partial<ProblemRecord>) {
    setData((current) => ({
      ...current,
      problems: current.problems.map((problem) =>
        problem.id === problemId
          ? {
              ...problem,
              ...patch,
              updatedAt: new Date().toISOString(),
            }
          : problem,
      ),
    }));
    setDirty(true);
    setMessage("");
  }

  function deleteProblem(problemId: string) {
    setData((current) => ({
      ...current,
      problems: current.problems.filter((problem) => problem.id !== problemId),
    }));
    setDirty(true);
    setMessage("");
  }

  function save() {
    if (!writable || !dirty) return;
    setMessage("");
    startTransition(async () => {
      const result = await saveAdminDataAction(data);
      if (result.ok) {
        setData(result.data);
        setDirty(false);
        setMessage("ローカルJSONへ保存しました。");
      } else {
        setMessage(result.error);
      }
    });
  }

  return (
    <main className="adminPage">
      <header className="adminHero">
        <div>
          <p className="eyebrow">CONTENT OPERATIONS</p>
          <h1>数学教材 管理画面</h1>
          <p>
            進捗、問題難易度、数学レビュー、公開工程を一つの画面で管理します。
          </p>
        </div>
        <div className="adminSaveArea">
          <span className={writable ? "adminModeLocal" : "adminModeReadOnly"}>
            {writable ? "LOCAL EDIT MODE" : "PRODUCTION READ ONLY"}
          </span>
          <button
            className="adminPrimaryButton"
            type="button"
            disabled={!writable || !dirty || isPending}
            onClick={save}
          >
            {isPending ? "保存中…" : dirty ? "変更を保存" : "保存済み"}
          </button>
          {message ? <p role="status">{message}</p> : null}
        </div>
      </header>

      <div className="adminLayout">
        <aside className="adminSidebar">
          <p>WORKSPACE</p>
          <nav aria-label="管理画面メニュー">
            {views.map((view) => (
              <button
                className={activeView === view.id ? "isActive" : ""}
                type="button"
                aria-pressed={activeView === view.id}
                onClick={() => setActiveView(view.id)}
                key={view.id}
              >
                <strong>{view.label}</strong>
                <small>{view.description}</small>
              </button>
            ))}
          </nav>
          <div className="adminSidebarNote">
            <strong>保存先</strong>
            <code>src/content/admin-data.json</code>
            <p>本番共有には認証とデータベースへの移行が必要です。</p>
          </div>
        </aside>

        <section className="adminWorkspace">
          {activeView === "overview" ? (
            <AdminOverview data={data} />
          ) : null}
          {activeView === "units" ? (
            <AdminUnits records={data.units} onUpdate={updateUnit} />
          ) : null}
          {activeView === "problems" ? (
            <AdminProblems
              problems={data.problems}
              onAdd={addProblem}
              onUpdate={updateProblem}
              onDelete={deleteProblem}
            />
          ) : null}
          {activeView === "reviews" ? (
            <AdminReviews
              problems={data.problems}
              onUpdate={updateProblem}
            />
          ) : null}
        </section>
      </div>
    </main>
  );
}

