import fs from "node:fs/promises";
import path from "node:path";
import matter from "gray-matter";
import rehypeKatex from "rehype-katex";
import rehypeRaw from "rehype-raw";
import rehypeSlug from "rehype-slug";
import rehypeStringify from "rehype-stringify";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import remarkParse from "remark-parse";
import remarkRehype from "remark-rehype";
import { unified } from "unified";
import type { Unit } from "@/lib/tree";

// セキュリティ上の前提:
// ここで生成する HTML はリポジトリにコミットされた一次コンテンツ（教材執筆者が書いた
// Markdown）のみを対象とし、ユーザー投稿を扱わない。そのため rehype-sanitize による
// サニタイズは行っていない。将来ユーザー投稿（コメント・提出物など）を Markdown として
// 描画する場合は、このパイプラインを流用せず rehype-sanitize の導入が必須である。

export type UnitDocumentKind = "lecture" | "problems" | "solutions" | "interactive";
export type UnitContentStatus = "未着手" | "作業中" | "レビュー中" | "完了";

export type UnitDocument = {
  kind: UnitDocumentKind;
  /** frontmatter の title。無ければ既定の日本語ラベル */
  title: string;
  status: UnitContentStatus;
  /** frontmatter の updated（YYYY-MM-DD）。無ければ null */
  updated: string | null;
  /** レンダリング済み HTML。本文が実質空なら "" */
  html: string;
  /** status が "未着手" 以外かつ html が非空のときだけ true */
  available: boolean;
};

const defaultTitles: Record<UnitDocumentKind, string> = {
  lecture: "講義",
  interactive: "インタラクティブ",
  problems: "問題集",
  solutions: "解答解説",
};

const validStatuses: readonly UnitContentStatus[] = [
  "未着手",
  "作業中",
  "レビュー中",
  "完了",
];

function relativeDocPath(unit: Unit, kind: UnitDocumentKind): string {
  const base = ["src", "content", "units", unit.categorySlug, unit.id];
  switch (kind) {
    case "lecture":
      return path.join(...base, "lecture", "README.md");
    case "interactive":
      return path.join(...base, "interactive", "README.md");
    case "problems":
      return path.join(...base, "workbook", "problems.md");
    case "solutions":
      return path.join(...base, "workbook", "solutions.md");
  }
}

function isValidStatus(value: unknown): value is UnitContentStatus {
  return (
    typeof value === "string" &&
    (validStatuses as readonly string[]).includes(value)
  );
}

// YAML は `updated: 2026-07-20` のようにクォートなしで書かれた日付を、文字列ではなく
// Date として解釈する（gray-matter が使う js-yaml の既定挙動）。frontmatter の記述者が
// クォートを付け忘れることは十分あり得るため、Date と文字列の両方を受け付ける。
function normalizeUpdated(value: unknown): string | null {
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return value;
  }
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().slice(0, 10);
  }
  return null;
}

// unified パイプラインは使い回せるため、モジュールスコープで一度だけ構築する。
const processor = unified()
  .use(remarkParse)
  .use(remarkGfm)
  .use(remarkMath)
  .use(remarkRehype, { allowDangerousHtml: true })
  .use(rehypeRaw)
  .use(rehypeKatex, { throwOnError: false, strict: false })
  .use(rehypeSlug)
  .use(rehypeStringify, { allowDangerousHtml: true });

function emptyDocument(kind: UnitDocumentKind): UnitDocument {
  return {
    kind,
    title: defaultTitles[kind],
    status: "未着手",
    updated: null,
    html: "",
    available: false,
  };
}

// 57単元ぶんの教材ファイルは執筆途中のものが常に混在するため、1ファイルの不備で
// ビルド全体を落としてはいけない。ファイル不在・frontmatter 欠如・YAML 不正・
// パース失敗のいずれも、例外を投げず「未着手」の既定値へフォールバックする。
async function loadUnitDocument(
  unit: Unit,
  kind: UnitDocumentKind,
): Promise<UnitDocument> {
  const filePath = path.join(process.cwd(), relativeDocPath(unit, kind));

  let raw: string;
  try {
    raw = await fs.readFile(filePath, "utf8");
  } catch {
    return emptyDocument(kind);
  }

  let frontmatter: Record<string, unknown>;
  let body: string;
  try {
    const parsed = matter(raw);
    frontmatter = parsed.data;
    body = parsed.content;
  } catch {
    return emptyDocument(kind);
  }

  // frontmatter が存在しない旧雛形（`# タイトル` と `> 状態: 未着手` だけ）は
  // gray-matter が空オブジェクトを返すので、そのまま「未着手」として扱う。
  const hasFrontmatter =
    typeof frontmatter === "object" &&
    frontmatter !== null &&
    !Array.isArray(frontmatter) &&
    Object.keys(frontmatter).length > 0;
  if (!hasFrontmatter) {
    return emptyDocument(kind);
  }

  const title =
    typeof frontmatter.title === "string" && frontmatter.title.trim()
      ? frontmatter.title
      : defaultTitles[kind];
  const status = isValidStatus(frontmatter.status) ? frontmatter.status : "作業中";
  const updated = normalizeUpdated(frontmatter.updated);

  let html: string;
  try {
    const result = await processor.process(body);
    html = result.toString().trim();
  } catch {
    return emptyDocument(kind);
  }

  const available = status !== "未着手" && html !== "";

  return { kind, title, status, updated, html, available };
}

// 同一ビルド内で同じファイルを何度も読まないためのメモ化。key はファイルパス。
const documentCache = new Map<string, Promise<UnitDocument>>();

async function getCachedUnitDocument(
  unit: Unit,
  kind: UnitDocumentKind,
): Promise<UnitDocument> {
  const key = relativeDocPath(unit, kind);
  const cached = documentCache.get(key);
  if (cached) return cached;

  const promise = loadUnitDocument(unit, kind);
  documentCache.set(key, promise);
  return promise;
}

export async function getUnitDocuments(
  unit: Unit,
): Promise<Record<UnitDocumentKind, UnitDocument>> {
  const [lecture, interactive, problems, solutions] = await Promise.all([
    getCachedUnitDocument(unit, "lecture"),
    getCachedUnitDocument(unit, "interactive"),
    getCachedUnitDocument(unit, "problems"),
    getCachedUnitDocument(unit, "solutions"),
  ]);

  return { lecture, interactive, problems, solutions };
}
