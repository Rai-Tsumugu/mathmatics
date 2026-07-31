"use client";

import { useMemo, useState } from "react";
import {
  problemTypeLabels,
  problemTypes,
  publishStatusLabels,
  publishStatuses,
  type ProblemRecord,
} from "@/lib/admin-types";
import { unitById, units } from "@/lib/tree";

function linesToArray(value: string) {
  return value
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

function listToArray(value: string) {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

export function AdminProblems({
  problems,
  onAdd,
  onUpdate,
  onDelete,
}: {
  problems: ProblemRecord[];
  onAdd: (problem: ProblemRecord) => void;
  onUpdate: (problemId: string, patch: Partial<ProblemRecord>) => void;
  onDelete: (problemId: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState(problems[0]?.id ?? "");

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return problems.filter(
      (problem) =>
        !normalized ||
        problem.title.toLowerCase().includes(normalized) ||
        problem.id.toLowerCase().includes(normalized),
    );
  }, [problems, query]);

  const selected =
    problems.find((problem) => problem.id === selectedId) ?? problems[0];

  function createProblem() {
    const timestamp = Date.now();
    const problem: ProblemRecord = {
      id: `problem-${timestamp}`,
      unitId: units[0].id,
      title: "新しい問題",
      statement: "",
      answer: "",
      solution: "",
      estimatedDifficulty: 1,
      measuredDifficulty: null,
      problemType: "calculation",
      skills: [],
      prerequisites: [],
      expectedMinutes: 5,
      hints: [],
      scoringSteps: [],
      commonErrors: [],
      status: "draft",
      reviewer: "",
      reviewNotes: "",
      version: 1,
      updatedAt: new Date().toISOString(),
    };
    onAdd(problem);
    setSelectedId(problem.id);
  }

  function removeProblem(problem: ProblemRecord) {
    if (!window.confirm(`「${problem.title}」を削除しますか？`)) return;
    onDelete(problem.id);
    setSelectedId(problems.find((item) => item.id !== problem.id)?.id ?? "");
  }

  return (
    <div className="adminView">
      <div className="adminViewHeading">
        <div>
          <p className="eyebrow">PROBLEM BANK</p>
          <h2>問題バンク</h2>
        </div>
        <button
          className="adminPrimaryButton"
          type="button"
          onClick={createProblem}
        >
          ＋ 問題を追加
        </button>
      </div>

      <div className="adminFilters">
        <label>
          <span>検索</span>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="問題名またはID"
          />
        </label>
      </div>

      <div className="adminSplit">
        <div className="adminProblemList">
          {filtered.map((problem) => (
            <button
              className={selected?.id === problem.id ? "isSelected" : ""}
              type="button"
              onClick={() => setSelectedId(problem.id)}
              key={problem.id}
            >
              <span className={`adminDifficulty adminDifficulty${problem.estimatedDifficulty}`}>
                Lv.{problem.estimatedDifficulty}
              </span>
              <span>
                <strong>{problem.title}</strong>
                <small>
                  {unitById.get(problem.unitId)?.title ?? problem.unitId}
                </small>
              </span>
              <em>{publishStatusLabels[problem.status]}</em>
            </button>
          ))}
          {!filtered.length ? (
            <p className="adminEmpty">該当する問題はありません。</p>
          ) : null}
        </div>

        {selected ? (
          <section className="adminEditor">
            <div className="adminEditorHeading">
              <div>
                <span>{selected.id}</span>
                <h3>{selected.title}</h3>
              </div>
              <button
                className="adminDangerButton"
                type="button"
                onClick={() => removeProblem(selected)}
              >
                削除
              </button>
            </div>

            <div className="adminFieldGrid">
              <label>
                <span>問題ID</span>
                <input
                  value={selected.id}
                  readOnly
                  aria-describedby="problem-id-help"
                />
                <small id="problem-id-help">作成後は変更できません</small>
              </label>
              <label>
                <span>単元</span>
                <select
                  value={selected.unitId}
                  onChange={(event) =>
                    onUpdate(selected.id, { unitId: event.target.value })
                  }
                >
                  {units.map((unit) => (
                    <option value={unit.id} key={unit.id}>
                      {unit.title}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span>公開状態</span>
                <select
                  value={selected.status}
                  onChange={(event) =>
                    onUpdate(selected.id, {
                      status: event.target.value as ProblemRecord["status"],
                    })
                  }
                >
                  {publishStatuses.map((status) => (
                    <option value={status} key={status}>
                      {publishStatusLabels[status]}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <label className="adminFullField">
              <span>問題名</span>
              <input
                value={selected.title}
                onChange={(event) =>
                  onUpdate(selected.id, { title: event.target.value })
                }
              />
            </label>
            <label className="adminFullField">
              <span>問題文</span>
              <textarea
                value={selected.statement}
                onChange={(event) =>
                  onUpdate(selected.id, { statement: event.target.value })
                }
                rows={4}
              />
            </label>
            <label className="adminFullField">
              <span>答え</span>
              <textarea
                value={selected.answer}
                onChange={(event) =>
                  onUpdate(selected.id, { answer: event.target.value })
                }
                rows={3}
              />
            </label>
            <label className="adminFullField">
              <span>完全解説</span>
              <textarea
                value={selected.solution}
                onChange={(event) =>
                  onUpdate(selected.id, { solution: event.target.value })
                }
                rows={6}
              />
            </label>

            <div className="adminFieldGrid adminFieldGridFour">
              <label>
                <span>推定難易度</span>
                <select
                  value={selected.estimatedDifficulty}
                  onChange={(event) =>
                    onUpdate(selected.id, {
                      estimatedDifficulty: Number(event.target.value),
                    })
                  }
                >
                  {[1, 2, 3, 4, 5].map((level) => (
                    <option value={level} key={level}>
                      Level {level}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span>実測難易度</span>
                <input
                  type="number"
                  min="1"
                  max="5"
                  step="0.1"
                  value={selected.measuredDifficulty ?? ""}
                  onChange={(event) =>
                    onUpdate(selected.id, {
                      measuredDifficulty: event.target.value
                        ? Number(event.target.value)
                        : null,
                    })
                  }
                  placeholder="回答データ取得後"
                />
              </label>
              <label>
                <span>問題形式</span>
                <select
                  value={selected.problemType}
                  onChange={(event) =>
                    onUpdate(selected.id, {
                      problemType:
                        event.target.value as ProblemRecord["problemType"],
                    })
                  }
                >
                  {problemTypes.map((type) => (
                    <option value={type} key={type}>
                      {problemTypeLabels[type]}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span>想定時間（分）</span>
                <input
                  type="number"
                  min="1"
                  value={selected.expectedMinutes}
                  onChange={(event) =>
                    onUpdate(selected.id, {
                      expectedMinutes: Number(event.target.value),
                    })
                  }
                />
              </label>
            </div>

            <div className="adminFieldGrid">
              <label>
                <span>スキル（カンマ区切り）</span>
                <input
                  value={selected.skills.join(", ")}
                  onChange={(event) =>
                    onUpdate(selected.id, {
                      skills: listToArray(event.target.value),
                    })
                  }
                />
              </label>
              <label>
                <span>前提単元（カンマ区切り）</span>
                <input
                  value={selected.prerequisites.join(", ")}
                  onChange={(event) =>
                    onUpdate(selected.id, {
                      prerequisites: listToArray(event.target.value),
                    })
                  }
                />
              </label>
            </div>

            <label className="adminFullField">
              <span>段階的ヒント（1行1段階）</span>
              <textarea
                value={selected.hints.join("\n")}
                onChange={(event) =>
                  onUpdate(selected.id, {
                    hints: linesToArray(event.target.value),
                  })
                }
                rows={4}
              />
            </label>
            <label className="adminFullField">
              <span>よくある誤答（1行1件）</span>
              <textarea
                value={selected.commonErrors.join("\n")}
                onChange={(event) =>
                  onUpdate(selected.id, {
                    commonErrors: linesToArray(event.target.value),
                  })
                }
                rows={4}
              />
            </label>
          </section>
        ) : (
          <section className="adminEditor adminEmpty">
            問題を追加すると、ここで編集できます。
          </section>
        )}
      </div>
    </div>
  );
}
