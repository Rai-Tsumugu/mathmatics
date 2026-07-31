import fs from "node:fs/promises";
import path from "node:path";
import {
  contentStatuses,
  difficultyAxisKeys,
  problemTypes,
  publishStatuses,
  scoringStepRelations,
  type AdminData,
  type ContentKind,
  type ProblemDifficultyAxes,
  type ProblemType,
  type ScoringStep,
} from "@/lib/admin-types";
import { units } from "@/lib/tree";

const ADMIN_SCHEMA_VERSION_ERROR =
  "管理データには schemaVersion 2 が必要です。旧データは schemaVersion 2 への移行が必要です。";

const adminDataPath = path.join(
  process.cwd(),
  "src",
  "content",
  "admin-data.json",
);

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

// 6軸フィールドは任意項目。存在する場合のみ、6軸すべてのキーが揃い、
// 各値が1〜5の整数であることを検証する（project-management/difficulty-standard.md 2章）。
function isValidDifficultyAxes(value: unknown): value is ProblemDifficultyAxes {
  if (!value || typeof value !== "object") return false;
  if (Array.isArray(value)) return false;
  const axes = value as Record<string, unknown>;
  if (Object.keys(axes).length !== difficultyAxisKeys.length) return false;
  return difficultyAxisKeys.every((key) => {
    const score = axes[key];
    return Number.isInteger(score) && (score as number) >= 1 && (score as number) <= 5;
  });
}

// project-management/difficulty-standard.md 5-2・5-6 の採点ステップ規約。
// 配点は小数を許す（基準書5-2の均等配点例 12.5点）。
function isValidScoringSteps(
  value: unknown,
  problemType: ProblemType,
): value is ScoringStep[] {
  if (!Array.isArray(value) || value.length > 12) return false;
  if (
    value.length === 0 &&
    (problemType === "proof" || problemType === "application")
  ) {
    return false;
  }
  if (value.length === 0) return true;

  const subproblemCounts = new Map<string, number>();
  const seenSubproblems = new Set<string>();
  let totalPoints = 0;

  for (let index = 0; index < value.length; index += 1) {
    const step = value[index];
    if (!step || typeof step !== "object" || Array.isArray(step)) return false;

    const candidate = step as Partial<ScoringStep>;
    if (
      candidate.order !== index + 1 ||
      typeof candidate.subproblem !== "string" ||
      candidate.subproblem.trim() === "" ||
      !scoringStepRelations.includes(candidate.relation as ScoringStep["relation"]) ||
      typeof candidate.criterion !== "string" ||
      candidate.criterion.trim() === "" ||
      typeof candidate.points !== "number" ||
      !Number.isFinite(candidate.points) ||
      candidate.points <= 0 ||
      candidate.points > 40 ||
      (candidate.hint !== undefined && typeof candidate.hint !== "string")
    ) {
      return false;
    }

    if (
      !seenSubproblems.has(candidate.subproblem) &&
      candidate.relation !== "origin"
    ) {
      return false;
    }

    seenSubproblems.add(candidate.subproblem);
    subproblemCounts.set(
      candidate.subproblem,
      (subproblemCounts.get(candidate.subproblem) ?? 0) + 1,
    );
    totalPoints += candidate.points;
  }

  if (Math.abs(totalPoints - 100) > 1e-9) return false;

  // 基準書5-2の例外: 小問が3つ以上ある問題では、1〜2ステップの小問も認める。
  const allowsShortSubproblems = subproblemCounts.size >= 3;
  return [...subproblemCounts.values()].every(
    (count) => count <= 6 && (count >= 3 || allowsShortSubproblems),
  );
}

export function validateAdminData(value: unknown): value is AdminData {
  if (!value || typeof value !== "object") return false;
  const data = value as Partial<AdminData>;
  if (data.schemaVersion !== 2 || typeof data.updatedAt !== "string") {
    return false;
  }
  if (!data.units || typeof data.units !== "object") return false;
  if (!Array.isArray(data.problems)) return false;

  const unitIds = new Set(units.map((unit) => unit.id));
  if (Object.keys(data.units).length !== unitIds.size) return false;

  for (const [unitId, record] of Object.entries(data.units)) {
    if (!unitIds.has(unitId) || !record || typeof record !== "object") {
      return false;
    }
    if (
      record.unitId !== unitId ||
      typeof record.owner !== "string" ||
      typeof record.dueDate !== "string" ||
      typeof record.notes !== "string" ||
      typeof record.sourceNotes !== "string" ||
      typeof record.updatedAt !== "string" ||
      !publishStatuses.includes(record.publishStatus)
    ) {
      return false;
    }

    const contentKinds: ContentKind[] = [
      "lecture",
      "interactive",
      "problems",
      "solutions",
    ];
    if (
      !record.contentStatus ||
      Object.keys(record.contentStatus).length !== contentKinds.length
    ) {
      return false;
    }
    for (const kind of contentKinds) {
      if (!contentStatuses.includes(record.contentStatus[kind])) return false;
    }
  }

  const problemIds = new Set<string>();
  for (const problem of data.problems) {
    if (
      !problem ||
      typeof problem !== "object" ||
      typeof problem.id !== "string" ||
      !unitIds.has(problem.unitId) ||
      typeof problem.title !== "string" ||
      typeof problem.statement !== "string" ||
      typeof problem.answer !== "string" ||
      typeof problem.solution !== "string" ||
      !Number.isInteger(problem.estimatedDifficulty) ||
      problem.estimatedDifficulty < 1 ||
      problem.estimatedDifficulty > 5 ||
      (problem.difficultyAxes !== undefined &&
        !isValidDifficultyAxes(problem.difficultyAxes)) ||
      (problem.measuredDifficulty !== null &&
        (typeof problem.measuredDifficulty !== "number" ||
          problem.measuredDifficulty < 1 ||
          problem.measuredDifficulty > 5)) ||
      !problemTypes.includes(problem.problemType) ||
      !publishStatuses.includes(problem.status) ||
      !Number.isFinite(problem.expectedMinutes) ||
      problem.expectedMinutes < 1 ||
      typeof problem.reviewer !== "string" ||
      typeof problem.reviewNotes !== "string" ||
      !Number.isInteger(problem.version) ||
      problem.version < 1 ||
      typeof problem.updatedAt !== "string" ||
      !isStringArray(problem.skills) ||
      !isStringArray(problem.prerequisites) ||
      !isStringArray(problem.hints) ||
      !isValidScoringSteps(problem.scoringSteps, problem.problemType) ||
      !isStringArray(problem.commonErrors)
    ) {
      return false;
    }
    if (!problem.id.trim() || problemIds.has(problem.id)) return false;
    problemIds.add(problem.id);
  }
  return true;
}

export async function readAdminData(): Promise<AdminData> {
  const data = JSON.parse(await fs.readFile(adminDataPath, "utf8")) as unknown;
  if (
    !data ||
    typeof data !== "object" ||
    (data as { schemaVersion?: unknown }).schemaVersion !== 2
  ) {
    throw new Error(ADMIN_SCHEMA_VERSION_ERROR);
  }
  if (!validateAdminData(data)) {
    throw new Error("管理データの形式が不正です。");
  }
  return data;
}

export async function writeAdminData(data: AdminData) {
  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "本番環境ではローカルJSONへ保存できません。共有データベース導入後に有効化してください。",
    );
  }
  if (data.schemaVersion !== 2) {
    throw new Error(ADMIN_SCHEMA_VERSION_ERROR);
  }
  if (!validateAdminData(data)) {
    throw new Error("保存データの形式が不正です。");
  }
  const nextData = {
    ...data,
    updatedAt: new Date().toISOString(),
  } satisfies AdminData;
  await fs.writeFile(adminDataPath, `${JSON.stringify(nextData, null, 2)}\n`);
  return nextData;
}
