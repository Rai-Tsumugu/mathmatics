"use client";

import {
  publishStatusLabels,
  type ProblemRecord,
  type PublishStatus,
} from "@/lib/admin-types";
import { unitById } from "@/lib/tree";

const reviewStatuses: PublishStatus[] = [
  "ready",
  "math-review",
  "ui-review",
  "publishable",
];

const nextStatus: Partial<Record<PublishStatus, PublishStatus>> = {
  ready: "math-review",
  "math-review": "ui-review",
  "ui-review": "publishable",
  publishable: "published",
};

export function AdminReviews({
  problems,
  onUpdate,
}: {
  problems: ProblemRecord[];
  onUpdate: (problemId: string, patch: Partial<ProblemRecord>) => void;
}) {
  const reviewQueue = problems.filter((problem) =>
    reviewStatuses.includes(problem.status),
  );

  return (
    <div className="adminView">
      <div className="adminViewHeading">
        <div>
          <p className="eyebrow">QUALITY GATE</p>
          <h2>レビューキュー</h2>
        </div>
        <span>{reviewQueue.length}件</span>
      </div>

      <div className="adminReviewFlow" aria-label="公開工程">
        {reviewStatuses.map((status, index) => (
          <div key={status}>
            <span>{String(index + 1).padStart(2, "0")}</span>
            <strong>{publishStatusLabels[status]}</strong>
            <small>
              {reviewQueue.filter((problem) => problem.status === status).length}件
            </small>
          </div>
        ))}
      </div>

      <div className="adminReviewList">
        {reviewQueue.map((problem) => {
          const next = nextStatus[problem.status];
          return (
            <article key={problem.id}>
              <div className="adminReviewHeading">
                <div>
                  <span className="adminStatus adminStatusReview">
                    {publishStatusLabels[problem.status]}
                  </span>
                  <h3>{problem.title}</h3>
                  <p>
                    {unitById.get(problem.unitId)?.title ?? problem.unitId} ・
                    推定難易度 Lv.{problem.estimatedDifficulty}
                  </p>
                </div>
                <strong>v{problem.version}</strong>
              </div>
              <div className="adminReviewContent">
                <section>
                  <h4>問題</h4>
                  <p>{problem.statement || "問題文が未入力です。"}</p>
                </section>
                <section>
                  <h4>解答・方針</h4>
                  <p>{problem.solution || "解説が未入力です。"}</p>
                </section>
              </div>
              <div className="adminFieldGrid">
                <label>
                  <span>レビュー担当</span>
                  <input
                    value={problem.reviewer}
                    onChange={(event) =>
                      onUpdate(problem.id, { reviewer: event.target.value })
                    }
                    placeholder="未設定"
                  />
                </label>
                <label>
                  <span>レビューコメント</span>
                  <input
                    value={problem.reviewNotes}
                    onChange={(event) =>
                      onUpdate(problem.id, {
                        reviewNotes: event.target.value,
                      })
                    }
                    placeholder="修正点または承認理由"
                  />
                </label>
              </div>
              <div className="adminReviewActions">
                <button
                  className="adminSecondaryButton"
                  type="button"
                  onClick={() =>
                    onUpdate(problem.id, {
                      status: "draft",
                      version: problem.version + 1,
                    })
                  }
                >
                  差し戻す
                </button>
                {next ? (
                  <button
                    className="adminPrimaryButton"
                    type="button"
                    onClick={() =>
                      onUpdate(problem.id, { status: next })
                    }
                  >
                    {next === "published"
                      ? "公開済みにする"
                      : `${publishStatusLabels[next]}へ進める`}
                  </button>
                ) : null}
              </div>
            </article>
          );
        })}
        {!reviewQueue.length ? (
          <div className="adminEmpty adminEmptyPanel">
            レビュー待ちの問題はありません。問題バンクで状態を「作問済み」にすると、
            ここへ追加されます。
          </div>
        ) : null}
      </div>
    </div>
  );
}

