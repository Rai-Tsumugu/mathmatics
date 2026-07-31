export const contentStatuses = [
  "not-started",
  "in-progress",
  "review",
  "complete",
  "hold",
] as const;

export const publishStatuses = [
  "draft",
  "ready",
  "math-review",
  "ui-review",
  "publishable",
  "published",
  "paused",
] as const;

export const problemTypes = [
  "calculation",
  "proof",
  "concept",
  "application",
  "diagnostic",
] as const;

export const scoringStepRelations = [
  "origin",
  "serial",
  "independent",
] as const;

export type ContentStatus = (typeof contentStatuses)[number];
export type PublishStatus = (typeof publishStatuses)[number];
export type ProblemType = (typeof problemTypes)[number];
export type ScoringStepRelation = (typeof scoringStepRelations)[number];
export type ContentKind =
  | "lecture"
  | "interactive"
  | "problems"
  | "solutions";

export type AdminUnitRecord = {
  unitId: string;
  owner: string;
  dueDate: string;
  notes: string;
  sourceNotes: string;
  publishStatus: PublishStatus;
  contentStatus: Record<ContentKind, ContentStatus>;
  updatedAt: string;
};

// project-management/difficulty-standard.md 2章「6つの評価軸」が定める素点。
// 各軸は 1〜5 の整数で、2点・4点は隣接する記述の中間として運用する（採点は基準書を参照）。
export type ProblemDifficultyAxes = {
  /** 軸P: 前提概念の数。模範解答が動員する定義・定理・公式の個数 */
  conceptCount: number;
  /** 軸F: 解法選択の自由度。解き始める前に学習者が下す分岐の数 */
  solutionFreedom: number;
  /** 軸L: 式変形の長さ。模範解答をA4に手書きしたときの行数 */
  transformationLength: number;
  /** 軸A: 抽象度。対象が具体的な数・式か、任意の対象・構造かの度合い */
  abstraction: number;
  /** 軸E: 誤答しやすさ。典型的な誤りの数と、その誤りに気づけるか */
  errorProneness: number;
  /** 軸T: 想定所要時間。`expectedMinutes` と対応する点数（基準書2章の対応表） */
  timeRequired: number;
};

// isValidDifficultyAxes（admin-store.ts）や difficulty.ts の重み定義など、
// 6軸を走査する箇所で共通して使うキー一覧。
export const difficultyAxisKeys = [
  "conceptCount",
  "solutionFreedom",
  "transformationLength",
  "abstraction",
  "errorProneness",
  "timeRequired",
] as const satisfies readonly (keyof ProblemDifficultyAxes)[];

export interface ScoringStep {
  order: number;
  subproblem: string;
  relation: ScoringStepRelation;
  criterion: string;
  points: number;
  hint?: string;
}

export type ProblemRecord = {
  id: string;
  unitId: string;
  title: string;
  statement: string;
  answer: string;
  solution: string;
  estimatedDifficulty: number;
  /**
   * 6軸の素点（任意）。難易度判定基準書3章の決定規則で `estimatedDifficulty` の
   * 根拠として使う。未設定の既存レコードは引き続き有効（後方互換）。
   */
  difficultyAxes?: ProblemDifficultyAxes;
  measuredDifficulty: number | null;
  problemType: ProblemType;
  skills: string[];
  prerequisites: string[];
  expectedMinutes: number;
  hints: string[];
  scoringSteps: ScoringStep[];
  commonErrors: string[];
  status: PublishStatus;
  reviewer: string;
  reviewNotes: string;
  version: number;
  updatedAt: string;
};

export type AdminData = {
  schemaVersion: 2;
  updatedAt: string;
  units: Record<string, AdminUnitRecord>;
  problems: ProblemRecord[];
};

export const contentStatusLabels: Record<ContentStatus, string> = {
  "not-started": "未着手",
  "in-progress": "作業中",
  review: "レビュー中",
  complete: "完了",
  hold: "保留",
};

export const publishStatusLabels: Record<PublishStatus, string> = {
  draft: "下書き",
  ready: "作問済み",
  "math-review": "数学レビュー",
  "ui-review": "UI確認",
  publishable: "公開可能",
  published: "公開中",
  paused: "公開停止",
};

export const problemTypeLabels: Record<ProblemType, string> = {
  calculation: "計算",
  proof: "証明",
  concept: "概念",
  application: "応用",
  diagnostic: "診断",
};

export const scoringStepRelationLabels: Record<ScoringStepRelation, string> = {
  origin: "起点",
  serial: "直列",
  independent: "独立",
};
