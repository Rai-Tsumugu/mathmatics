"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { categories, edges, unitById, units, type Unit } from "@/lib/tree";

const CANVAS_WIDTH = 1444;
const CANVAS_HEIGHT = 1530;
const NODE_HEIGHT = 104;
const ROW_TOP = 38;
const ROW_GAP = 134;
const STORAGE_KEY = "math-learning-progress-v2";
const LEGACY_STORAGE_KEY = "mathfull";

const CONTENT_TYPES = [
  { id: "lecture", short: "講", label: "講義" },
  { id: "interactive", short: "体", label: "インタラクティブ" },
  { id: "problems", short: "問", label: "問題集" },
  { id: "solutions", short: "解", label: "解答解説" },
] as const;

type ContentType = (typeof CONTENT_TYPES)[number]["id"];
type UnitProgress = Record<ContentType, boolean>;
type ProgressStore = Record<string, UnitProgress>;

const emptyProgress = (): UnitProgress => ({
  lecture: false,
  interactive: false,
  problems: false,
  solutions: false,
});

function getCompletedCount(progress: UnitProgress | undefined) {
  return CONTENT_TYPES.filter(({ id }) => progress?.[id]).length;
}

function getNodeY(unit: Unit) {
  return ROW_TOP + unit.row * ROW_GAP;
}

function getEdgePath(from: Unit, to: Unit) {
  const x1 = from.layoutX + from.layoutWidth / 2;
  const y1 = getNodeY(from) + NODE_HEIGHT;
  const x2 = to.layoutX + to.layoutWidth / 2;
  const y2 = getNodeY(to);
  const curve = Math.max(26, (y2 - y1) * 0.42);
  return `M${x1},${y1} C${x1},${y1 + curve} ${x2},${y2 - curve} ${x2},${y2}`;
}

export function TreeFlowMap() {
  const viewportRef = useRef<HTMLDivElement>(null);
  const [progress, setProgress] = useState<ProgressStore>({});
  const [hydrated, setHydrated] = useState(false);
  const [zoom, setZoom] = useState(0.8);
  const [activeUnit, setActiveUnit] = useState<string | null>(null);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        setProgress(JSON.parse(stored) as ProgressStore);
      } else {
        const legacy = JSON.parse(
          localStorage.getItem(LEGACY_STORAGE_KEY) ?? "{}",
        ) as Record<string, number>;
        const migrated = Object.fromEntries(
          Object.keys(legacy).map((id) => [
            id,
            {
              lecture: true,
              interactive: true,
              problems: true,
              solutions: true,
            },
          ]),
        );
        if (Object.keys(migrated).length) setProgress(migrated);
      }
    } catch {
      setProgress({});
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
  }, [hydrated, progress]);

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const fit = () => {
      const availableWidth = viewport.clientWidth - 28;
      setZoom(Math.min(1, Math.max(0.42, availableWidth / CANVAS_WIDTH)));
    };
    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(viewport);
    return () => observer.disconnect();
  }, []);

  const progressSummary = useMemo(() => {
    const completedItems = units.reduce(
      (sum, unit) => sum + getCompletedCount(progress[unit.id]),
      0,
    );
    const completedUnits = units.filter(
      (unit) => getCompletedCount(progress[unit.id]) === CONTENT_TYPES.length,
    ).length;
    const totalItems = units.length * CONTENT_TYPES.length;
    return {
      completedItems,
      completedUnits,
      percent: totalItems
        ? Math.round((completedItems / totalItems) * 1000) / 10
        : 0,
    };
  }, [progress]);

  const relatedIds = useMemo(() => {
    if (!activeUnit) return new Set<string>();
    const related = new Set<string>([activeUnit]);
    edges.forEach((edge) => {
      if (edge.from === activeUnit) related.add(edge.to);
      if (edge.to === activeUnit) related.add(edge.from);
    });
    return related;
  }, [activeUnit]);

  function toggleProgress(unitId: string, contentType: ContentType) {
    setProgress((current) => {
      const unitProgress = current[unitId] ?? emptyProgress();
      return {
        ...current,
        [unitId]: {
          ...unitProgress,
          [contentType]: !unitProgress[contentType],
        },
      };
    });
  }

  function resetProgress() {
    if (window.confirm("すべての学習進捗をリセットしますか？")) {
      setProgress({});
    }
  }

  return (
    <main className="treePage">
      <section className="treeIntro">
        <div>
          <p className="eyebrow">INTERACTIVE LEARNING TREE</p>
          <h1>大学数学 学習ツリーフロー</h1>
          <p>
            線で結ばれた前提関係を辿りながら学習します。カード内の4つの進捗ボタンを押すと、
            このブラウザに達成状況が保存されます。
          </p>
        </div>
        <div className="treeProgressPanel">
          <div className="treeProgressValue">
            <strong>{progressSummary.percent}%</strong>
            <span>
              {progressSummary.completedUnits} / {units.length} 単元完了
            </span>
          </div>
          <div
            className="treeProgressTrack"
            role="progressbar"
            aria-label="全体の学習進捗"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={progressSummary.percent}
          >
            <i style={{ width: `${progressSummary.percent}%` }} />
          </div>
          <small>
            {progressSummary.completedItems} / {units.length * CONTENT_TYPES.length} 教材
          </small>
        </div>
      </section>

      <section className="treeToolbar" aria-label="ツリーフロー操作">
        <div className="treeLegend">
          {categories
            .slice()
            .sort((a, b) => a.order - b.order)
            .map((category) => (
              <span className={`category-${category.id}`} key={category.id}>
                <i />
                {category.label}
              </span>
            ))}
        </div>
        <div className="treeActions">
          <button
            type="button"
            onClick={() => setZoom((value) => Math.max(0.42, value - 0.1))}
            aria-label="縮小"
          >
            −
          </button>
          <button type="button" onClick={() => setZoom(1)}>
            100%
          </button>
          <button
            type="button"
            onClick={() => setZoom((value) => Math.min(1.35, value + 0.1))}
            aria-label="拡大"
          >
            ＋
          </button>
          <button className="treeReset" type="button" onClick={resetProgress}>
            進捗をリセット
          </button>
        </div>
      </section>

      <div className="treeViewport" ref={viewportRef}>
        <div
          className="treeCanvasSizer"
          style={{ height: CANVAS_HEIGHT * zoom }}
        >
          <div
            className="treeCanvas"
            style={{
              width: CANVAS_WIDTH,
              height: CANVAS_HEIGHT,
              transform: `scale(${zoom})`,
            }}
          >
            <div className="treeBand treeBandCalc">
              <span>解析 — 微分積分を主軸に</span>
            </div>
            <div className="treeBand treeBandLin">
              <span>代数 — 線形代数を主軸に</span>
            </div>
            <div className="treeBand treeBandDisc">
              <span>離散数学・数学の基礎</span>
            </div>
            <div className="treeBand treeBandProb">
              <span>確率・統計</span>
            </div>
            <div className="treeBand treeBandBridge">
              <span>合流点 — 応用数学 / 機械学習の数学</span>
            </div>

            <svg
              className="treeEdges"
              viewBox={`0 0 ${CANVAS_WIDTH} ${CANVAS_HEIGHT}`}
              aria-hidden="true"
            >
              {edges.map((edge) => {
                const from = unitById.get(edge.from);
                const to = unitById.get(edge.to);
                if (!from || !to) return null;
                const isActive =
                  activeUnit === edge.from || activeUnit === edge.to;
                return (
                  <g key={`${edge.from}-${edge.to}`}>
                    <path
                      className={[
                        "treeEdge",
                        edge.crossField ? "treeEdgeCross" : "",
                        activeUnit && !isActive ? "treeEdgeDim" : "",
                        isActive ? "treeEdgeActive" : "",
                      ]
                        .filter(Boolean)
                        .join(" ")}
                      d={getEdgePath(from, to)}
                    />
                    <circle
                      className={isActive ? "treeEdgePointActive" : ""}
                      cx={to.layoutX + to.layoutWidth / 2}
                      cy={getNodeY(to) - 1}
                      r="2.8"
                    />
                  </g>
                );
              })}
            </svg>

            {units.map((unit) => {
              const completed = getCompletedCount(progress[unit.id]);
              const percent = completed * 25;
              const dimmed = activeUnit !== null && !relatedIds.has(unit.id);
              return (
                <article
                  className={[
                    "treeNode",
                    `category-${unit.category}`,
                    completed === CONTENT_TYPES.length ? "treeNodeDone" : "",
                    dimmed ? "treeNodeDim" : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                  key={unit.id}
                  style={{
                    left: unit.layoutX,
                    top: getNodeY(unit),
                    width: unit.layoutWidth,
                    height: NODE_HEIGHT,
                  }}
                  onMouseEnter={() => setActiveUnit(unit.id)}
                  onMouseLeave={() => setActiveUnit(null)}
                  onFocus={() => setActiveUnit(unit.id)}
                  onBlur={(event) => {
                    if (!event.currentTarget.contains(event.relatedTarget)) {
                      setActiveUnit(null);
                    }
                  }}
                >
                  <div className="treeNodeHeading">
                    <Link href={`/learn/${unit.id}`}>{unit.title}</Link>
                    <span>{percent}%</span>
                  </div>
                  <p>{unit.summary}</p>
                  <div className="treeNodeFooter">
                    <div
                      className="treeNodeProgress"
                      role="group"
                      aria-label={`${unit.title}の進捗`}
                    >
                      {CONTENT_TYPES.map((contentType) => {
                        const checked = Boolean(
                          progress[unit.id]?.[contentType.id],
                        );
                        return (
                          <button
                            type="button"
                            className={checked ? "isComplete" : ""}
                            aria-pressed={checked}
                            aria-label={`${unit.title}「${contentType.label}」を${
                              checked ? "未完了に戻す" : "完了にする"
                            }`}
                            title={contentType.label}
                            key={contentType.id}
                            onClick={() =>
                              toggleProgress(unit.id, contentType.id)
                            }
                          >
                            {checked ? "✓" : contentType.short}
                          </button>
                        );
                      })}
                    </div>
                    <div className="treeNodeTrack" aria-hidden="true">
                      <i style={{ width: `${percent}%` }} />
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        </div>
      </div>

      <p className="treeHelp">
        カード名を選ぶと単元ページへ移動します。講＝講義、体＝インタラクティブ、問＝問題集、
        解＝解答解説。横スクロールと拡大・縮小に対応しています。
      </p>
    </main>
  );
}
