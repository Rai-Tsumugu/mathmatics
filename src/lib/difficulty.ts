import { difficultyAxisKeys, type ProblemDifficultyAxes } from "@/lib/admin-types";

// このファイルは project-management/difficulty-standard.md 3章
// 「総合Levelの決定規則」の計算部分だけを担う。型定義（admin-types.ts）と
// ロジック（本ファイル）を分けているのは、admin-types.ts が型とラベル定義に
// 専念する既存の構成（src/lib/tree.ts がデータ、admin-store.ts がロジックという
// 分離）に合わせるため。

// 3-1. 加重平均の重み。「手を動かせば終わる負荷は軽く、方針が立たない負荷は重い」。
// L・E は演習量で改善するため 0.8、F・A は前提単元の理解そのものを要求するため 1.2。
const AXIS_WEIGHTS: Record<keyof ProblemDifficultyAxes, number> = {
  conceptCount: 1.0, // 軸P
  solutionFreedom: 1.2, // 軸F
  transformationLength: 0.8, // 軸L
  abstraction: 1.2, // 軸A
  errorProneness: 0.8, // 軸E
  timeRequired: 1.0, // 軸T
};
const WEIGHT_DENOMINATOR = 6.0; // 3-1

// 3-2. 基本の対応表。S が各エントリの min 以上であるものの中で、
// 最もレベルの高いものを採用する（= 各範囲の下限を含む右方向へのステップ関数）。
const BASE_LEVEL_TABLE: ReadonlyArray<{ level: number; min: number }> = [
  { level: 1, min: -Infinity }, // S < 1.50
  { level: 2, min: 1.5 }, // 1.50 <= S < 2.40
  { level: 3, min: 2.4 }, // 2.40 <= S < 3.30
  { level: 4, min: 3.3 }, // 3.30 <= S < 4.20
  { level: 5, min: 4.2 }, // 4.20 <= S
];

// 3-3. 下限・上限規則（加重平均より優先する）
const AXIS_MAX_SCORE = 5;
const SINGLE_FIVE_MIN_LEVEL = 4; // 3-3-1 単独5点規則
const MULTIPLE_FIVE_THRESHOLD_COUNT = 2; // 3-3-2 複数5点規則の発動条件（5点の軸が2つ以上）
const MULTIPLE_FIVE_LEVEL = 5; // 3-3-2 複数5点規則
const ABSTRACTION_OVERRIDE_MIN_SCORE = 4; // 3-3-3 抽象度規則の発動条件（s_A >= 4）
const ABSTRACTION_OVERRIDE_MIN_LEVEL = 3; // 3-3-3 抽象度規則
const CEILING_MAX_AXIS_SCORE = 2; // 3-3-4 上限規則の発動条件（全6軸が2点以下）
const CEILING_MAX_LEVEL = 2; // 3-3-4 上限規則
const TIME_OVERRIDE_THRESHOLD_MINUTES = 30; // 3-3-5 時間規則の発動条件（expectedMinutesが30を超える）
const TIME_OVERRIDE_MIN_LEVEL = 4; // 3-3-5 時間規則

/**
 * 3-1. 6軸の素点から加重平均 S を算出する。小数第2位まで丸める。
 */
export function calculateWeightedScore(axes: ProblemDifficultyAxes): number {
  const weightedSum = difficultyAxisKeys.reduce(
    (sum, key) => sum + AXIS_WEIGHTS[key] * axes[key],
    0,
  );
  const score = weightedSum / WEIGHT_DENOMINATOR;
  return Math.round(score * 100) / 100;
}

function baseLevelFromScore(score: number): number {
  let level = BASE_LEVEL_TABLE[0].level;
  for (const entry of BASE_LEVEL_TABLE) {
    if (score >= entry.min) level = entry.level;
  }
  return level;
}

/**
 * project-management/difficulty-standard.md 3章に従って、6軸の素点と
 * 想定所要時間から総合 Level（1〜5）を算出する。
 *
 * 手順: 3-1 加重平均 S → 3-2 基本の対応表で仮のLevelを決定 →
 * 3-3 下限・上限規則を加重平均より優先して適用する。
 *
 * この関数が担うのは決定的な計算部分のみである。3-4「境界例の扱い」が定める
 * ±0.10 のグレーゾーン判定（s_E や hints 本数を踏まえた繰り上げ/据え置き）は
 * 人間の判断を要し、判定根拠を `reviewNotes` に記録する運用のため、
 * この関数では実装しない。S が基本対応表の境界 ±0.10 以内にある場合は、
 * 呼び出し側で3-4の手続きに従って別途判定すること。
 */
export function calculateDifficultyLevel(
  axes: ProblemDifficultyAxes,
  expectedMinutes: number,
): number {
  const score = calculateWeightedScore(axes);
  let level = baseLevelFromScore(score);

  const axisScores = difficultyAxisKeys.map((key) => axes[key]);
  const fiveCount = axisScores.filter((value) => value === AXIS_MAX_SCORE).length;

  // 3-3-1 単独5点規則: いずれかの軸が5点なら、Levelは最低4とする。
  if (fiveCount >= 1) {
    level = Math.max(level, SINGLE_FIVE_MIN_LEVEL);
  }
  // 3-3-2 複数5点規則: 5点の軸が2つ以上なら、Levelは5とする。
  if (fiveCount >= MULTIPLE_FIVE_THRESHOLD_COUNT) {
    level = MULTIPLE_FIVE_LEVEL;
  }
  // 3-3-3 抽象度規則: s_A >= 4 なら、Levelは最低3とする。
  if (axes.abstraction >= ABSTRACTION_OVERRIDE_MIN_SCORE) {
    level = Math.max(level, ABSTRACTION_OVERRIDE_MIN_LEVEL);
  }
  // 3-3-4 上限規則: 全6軸が2点以下なら、Levelは2を超えない。
  if (axisScores.every((value) => value <= CEILING_MAX_AXIS_SCORE)) {
    level = Math.min(level, CEILING_MAX_LEVEL);
  }
  // 3-3-5 時間規則: expectedMinutesが30を超えるなら、Levelは最低4とする。
  if (expectedMinutes > TIME_OVERRIDE_THRESHOLD_MINUTES) {
    level = Math.max(level, TIME_OVERRIDE_MIN_LEVEL);
  }

  return level;
}
