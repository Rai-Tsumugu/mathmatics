"use client";

import { useMemo, useState } from "react";
import {
  contentStatusLabels,
  contentStatuses,
  publishStatusLabels,
  publishStatuses,
  type AdminUnitRecord,
  type ContentStatus,
  type ContentKind,
} from "@/lib/admin-types";
import { categories, unitById, units } from "@/lib/tree";

const contentLabels: Record<ContentKind, string> = {
  lecture: "講義",
  interactive: "インタラクティブ",
  problems: "問題集",
  solutions: "解答解説",
};

export function AdminUnits({
  records,
  onUpdate,
}: {
  records: Record<string, AdminUnitRecord>;
  onUpdate: (unitId: string, patch: Partial<AdminUnitRecord>) => void;
}) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("all");
  const [selectedId, setSelectedId] = useState(units[0].id);

  const filteredUnits = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return units.filter(
      (unit) =>
        (category === "all" || unit.category === category) &&
        (!normalized ||
          unit.title.toLowerCase().includes(normalized) ||
          unit.id.toLowerCase().includes(normalized)),
    );
  }, [category, query]);

  const selectedUnit = unitById.get(selectedId) ?? units[0];
  const record = records[selectedUnit.id];
  const completeCount = Object.values(record.contentStatus).filter(
    (status) => status === "complete",
  ).length;

  return (
    <div className="adminView">
      <div className="adminViewHeading">
        <div>
          <p className="eyebrow">UNIT MANAGEMENT</p>
          <h2>単元管理</h2>
        </div>
        <span>{filteredUnits.length}単元を表示</span>
      </div>

      <div className="adminFilters">
        <label>
          <span>検索</span>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="単元名またはID"
          />
        </label>
        <label>
          <span>分野</span>
          <select
            value={category}
            onChange={(event) => setCategory(event.target.value)}
          >
            <option value="all">すべて</option>
            {categories.map((item) => (
              <option value={item.id} key={item.id}>
                {item.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="adminSplit">
        <div className="adminUnitList">
          {filteredUnits.map((unit) => {
            const itemRecord = records[unit.id];
            const completed = Object.values(itemRecord.contentStatus).filter(
              (status) => status === "complete",
            ).length;
            return (
              <button
                className={selectedUnit.id === unit.id ? "isSelected" : ""}
                type="button"
                onClick={() => setSelectedId(unit.id)}
                key={unit.id}
              >
                <i className={`category-${unit.category}`} />
                <span>
                  <strong>{unit.title}</strong>
                  <small>
                    {unit.id} ・ {publishStatusLabels[itemRecord.publishStatus]}
                  </small>
                </span>
                <b>{completed * 25}%</b>
              </button>
            );
          })}
        </div>

        <section className="adminEditor">
          <div className="adminEditorHeading">
            <div>
              <span>{selectedUnit.categoryLabel}</span>
              <h3>{selectedUnit.title}</h3>
              <p>{selectedUnit.summary}</p>
            </div>
            <strong>{completeCount * 25}%</strong>
          </div>

          <div className="adminFieldGrid adminFieldGridFour">
            {(Object.keys(contentLabels) as ContentKind[]).map((kind) => (
              <label key={kind}>
                <span>{contentLabels[kind]}</span>
                <select
                  value={record.contentStatus[kind]}
                  onChange={(event) =>
                    onUpdate(selectedUnit.id, {
                      contentStatus: {
                        ...record.contentStatus,
                        [kind]: event.target.value as ContentStatus,
                      },
                    })
                  }
                >
                  {contentStatuses.map((status) => (
                    <option value={status} key={status}>
                      {contentStatusLabels[status]}
                    </option>
                  ))}
                </select>
              </label>
            ))}
          </div>

          <div className="adminFieldGrid">
            <label>
              <span>担当者</span>
              <input
                value={record.owner}
                onChange={(event) =>
                  onUpdate(selectedUnit.id, { owner: event.target.value })
                }
                placeholder="未設定"
              />
            </label>
            <label>
              <span>期限</span>
              <input
                type="date"
                value={record.dueDate}
                onChange={(event) =>
                  onUpdate(selectedUnit.id, { dueDate: event.target.value })
                }
              />
            </label>
            <label>
              <span>公開状態</span>
              <select
                value={record.publishStatus}
                onChange={(event) =>
                  onUpdate(selectedUnit.id, {
                    publishStatus:
                      event.target.value as AdminUnitRecord["publishStatus"],
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
            <span>制作メモ・課題</span>
            <textarea
              value={record.notes}
              onChange={(event) =>
                onUpdate(selectedUnit.id, { notes: event.target.value })
              }
              rows={5}
              placeholder="未解決事項、レビュー依頼、担当者への申し送り"
            />
          </label>
          <label className="adminFullField">
            <span>参考資料・ライセンス</span>
            <textarea
              value={record.sourceNotes}
              onChange={(event) =>
                onUpdate(selectedUnit.id, { sourceNotes: event.target.value })
              }
              rows={4}
              placeholder="URL、参照箇所、ライセンス、参照日"
            />
          </label>
        </section>
      </div>
    </div>
  );
}
