import type { AdminData, ContentStatus } from "@/lib/admin-types";
import { categories, units } from "@/lib/tree";

function contentCompletion(status: ContentStatus) {
  if (status === "complete") return 1;
  if (status === "review") return 0.75;
  if (status === "in-progress") return 0.4;
  return 0;
}

export function AdminOverview({ data }: { data: AdminData }) {
  const records = Object.values(data.units);
  const contentValues = records.flatMap((record) =>
    Object.values(record.contentStatus),
  );
  const completed = contentValues.filter(
    (status) => status === "complete",
  ).length;
  const inReview = data.problems.filter((problem) =>
    ["ready", "math-review", "ui-review"].includes(problem.status),
  ).length;
  const published = data.problems.filter(
    (problem) => problem.status === "published",
  ).length;
  const holds = records.filter((record) =>
    Object.values(record.contentStatus).includes("hold"),
  );

  return (
    <div className="adminView">
      <div className="adminViewHeading">
        <div>
          <p className="eyebrow">OVERVIEW</p>
          <h2>制作状況</h2>
        </div>
        <span>
          最終更新 {new Date(data.updatedAt).toLocaleString("ja-JP")}
        </span>
      </div>

      <div className="adminKpiGrid">
        <article>
          <small>教材完成</small>
          <strong>
            {completed}
            <span> / {contentValues.length}</span>
          </strong>
          <p>講義・体験・問題・解説</p>
        </article>
        <article>
          <small>問題バンク</small>
          <strong>{data.problems.length}</strong>
          <p>登録済み問題</p>
        </article>
        <article>
          <small>レビュー待ち</small>
          <strong>{inReview}</strong>
          <p>数学・UI確認対象</p>
        </article>
        <article>
          <small>公開中</small>
          <strong>{published}</strong>
          <p>公開済み問題</p>
        </article>
      </div>

      <div className="adminOverviewGrid">
        <section className="adminPanel">
          <div className="adminPanelHeading">
            <h3>分野別の教材進捗</h3>
            <span>レビュー中を75%として集計</span>
          </div>
          <div className="adminCategoryProgress">
            {categories
              .slice()
              .sort((a, b) => a.order - b.order)
              .map((category) => {
                const categoryUnits = units.filter(
                  (unit) => unit.category === category.id,
                );
                const values = categoryUnits.flatMap((unit) =>
                  Object.values(data.units[unit.id].contentStatus),
                );
                const percentage = values.length
                  ? Math.round(
                      (values.reduce(
                        (sum, status) =>
                          sum + contentCompletion(status as ContentStatus),
                        0,
                      ) /
                        values.length) *
                        100,
                    )
                  : 0;
                return (
                  <div key={category.id}>
                    <div>
                      <strong>{category.label}</strong>
                      <span>{percentage}%</span>
                    </div>
                    <i>
                      <b
                        className={`category-${category.id}`}
                        style={{ width: `${percentage}%` }}
                      />
                    </i>
                  </div>
                );
              })}
          </div>
        </section>

        <section className="adminPanel">
          <div className="adminPanelHeading">
            <h3>難易度分布</h3>
            <span>作問時の推定値</span>
          </div>
          <div className="adminDifficultyChart">
            {[1, 2, 3, 4, 5].map((level) => {
              const count = data.problems.filter(
                (problem) => problem.estimatedDifficulty === level,
              ).length;
              const max = Math.max(1, data.problems.length);
              return (
                <div key={level}>
                  <span>Lv.{level}</span>
                  <i>
                    <b style={{ width: `${(count / max) * 100}%` }} />
                  </i>
                  <strong>{count}</strong>
                </div>
              );
            })}
          </div>
        </section>
      </div>

      <section className="adminPanel">
        <div className="adminPanelHeading">
          <h3>確認が必要な項目</h3>
          <span>{holds.length + inReview}件</span>
        </div>
        <div className="adminAttentionList">
          {holds.map((record) => {
            const unit = units.find((item) => item.id === record.unitId);
            return (
              <div key={record.unitId}>
                <span className="adminStatus adminStatusHold">保留</span>
                <strong>{unit?.title ?? record.unitId}</strong>
                <p>{record.notes || "保留理由が未記入です。"}</p>
              </div>
            );
          })}
          {data.problems
            .filter((problem) =>
              ["ready", "math-review", "ui-review"].includes(problem.status),
            )
            .map((problem) => (
              <div key={problem.id}>
                <span className="adminStatus adminStatusReview">レビュー</span>
                <strong>{problem.title}</strong>
                <p>{problem.reviewNotes || "レビューコメントは未記入です。"}</p>
              </div>
            ))}
          {!holds.length && !inReview ? (
            <p className="adminEmpty">現在、確認待ちの項目はありません。</p>
          ) : null}
        </div>
      </section>
    </div>
  );
}

