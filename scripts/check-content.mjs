// 教材 Markdown の構造検査スクリプト。
//
// 目的: GFM 表のセル内に生の `|` を書いてしまい表が列崩れする、数式デリミタが
// 閉じ忘れられる、<details> の前後に空行がなく生テキストのまま表示される、
// といった「ビルドは通るが描画が壊れる」不備を機械的に検出する。
//
// 検査対象は src/lib/content.ts の relativeDocPath と同じパス解決規則に従う。
// 57単元ぶんの教材ファイルは執筆途中のものが常に混在するため、frontmatter を
// 持たない旧雛形は「未着手」として扱いエラーにしない（content.ts と同じ方針）。
//
// 使い方: node scripts/check-content.mjs

import fs from "node:fs/promises";
import path from "node:path";
import matter from "gray-matter";

const root = process.cwd();
const unitsRoot = path.join(root, "src", "content", "units");

// src/lib/content.ts の relativeDocPath と同一のパス規則。
// ここに載っていないファイル（例: 「solutions 2.md」のような iCloud 残骸）は
// ローダーが読まないので検査対象にも含めない。
const DOC_KINDS = [
  { kind: "lecture", relPath: path.join("lecture", "README.md") },
  { kind: "interactive", relPath: path.join("interactive", "README.md") },
  { kind: "problems", relPath: path.join("workbook", "problems.md") },
  { kind: "solutions", relPath: path.join("workbook", "solutions.md") },
];

const VALID_STATUSES = ["未着手", "作業中", "レビュー中", "完了"];

/** @type {{file: string, line: number | null, level: "error" | "warning", message: string}[]} */
const results = [];

function addError(file, line, message) {
  results.push({ file, line, level: "error", message });
}
function addWarning(file, line, message) {
  results.push({ file, line, level: "warning", message });
}

// ── 単元一覧の収集 ──────────────────────────────────────────
// tree.generated.json には依存せず、実際のディレクトリ構成
// (src/content/units/<categorySlug>/<unitId>/) をそのまま走査する。
async function collectUnitDirs() {
  const dirs = [];
  const categoryEntries = await fs.readdir(unitsRoot, { withFileTypes: true });
  for (const category of categoryEntries) {
    if (!category.isDirectory()) continue;
    const categoryDir = path.join(unitsRoot, category.name);
    const unitEntries = await fs.readdir(categoryDir, { withFileTypes: true });
    for (const unit of unitEntries) {
      if (!unit.isDirectory()) continue;
      dirs.push({
        categorySlug: category.name,
        unitId: unit.name,
        dir: path.join(categoryDir, unit.name),
      });
    }
  }
  return dirs;
}

function relDisplay(filePath) {
  return path.relative(root, filePath);
}

// ── コードフェンス（```）の行を検出 ─────────────────────────
// フェンス内はサンプルコードであり、表・見出し・数式デリミタの対象外とする。
function computeFenceMask(lines) {
  const inFence = new Array(lines.length).fill(false);
  let fenced = false;
  for (let i = 0; i < lines.length; i++) {
    const isFenceLine = /^\s*```/.test(lines[i]);
    if (isFenceLine) {
      inFence[i] = true;
      fenced = !fenced;
      continue;
    }
    inFence[i] = fenced;
  }
  return inFence;
}

// ── GFM 表のセル分割 ────────────────────────────────────────
// バッククォートのコードスパン内、および `\|` のようにエスケープされた
// パイプは区切りとして扱わない（GFM の表パース規則に合わせる）。
// $...$ 数式の内側の生パイプはあえて区切りとして扱う ── それこそが
// 「数式内の | でセル数がずれる」というこのスクリプトが検出したい不具合そのもの。
function splitTableRow(rawLine) {
  let line = rawLine.trim();
  if (line.startsWith("|")) line = line.slice(1);
  if (line.endsWith("|") && !line.endsWith("\\|")) line = line.slice(0, -1);

  const cells = [];
  let current = "";
  let backtickRun = 0;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === "\\" && i + 1 < line.length) {
      current += ch + line[i + 1];
      i += 1;
      continue;
    }
    if (ch === "`") {
      let j = i;
      while (line[j] === "`") j += 1;
      const runLen = j - i;
      if (backtickRun === 0) backtickRun = runLen;
      else if (runLen === backtickRun) backtickRun = 0;
      current += line.slice(i, j);
      i = j - 1;
      continue;
    }
    if (ch === "|" && backtickRun === 0) {
      cells.push(current);
      current = "";
      continue;
    }
    current += ch;
  }
  cells.push(current);
  return cells;
}

function isDelimiterRow(line) {
  const trimmed = line.trim();
  if (trimmed === "" || !/^[-\s:|]+$/.test(trimmed)) return false;
  const cells = splitTableRow(trimmed);
  if (cells.length === 0) return false;
  return cells.every((cell) => /^:?-+:?$/.test(cell.trim()));
}

// 表の行の中で、$...$ の内側に生の `|` が現れていないかを調べる。
// エスケープされた `\|`（\left|\right| なども含め、直前がバックスラッシュのもの）
// とコードスパン内は対象外。
function scanRowForPipeInMath(rawLine, lineNumber, filePath) {
  let inMath = false;
  let inCode = 0;
  for (let i = 0; i < rawLine.length; i++) {
    const ch = rawLine[i];
    if (ch === "\\" && i + 1 < rawLine.length) {
      i += 1;
      continue;
    }
    if (ch === "`") {
      let j = i;
      while (rawLine[j] === "`") j += 1;
      const runLen = j - i;
      if (inCode === 0) inCode = runLen;
      else if (runLen === inCode) inCode = 0;
      i = j - 1;
      continue;
    }
    if (inCode !== 0) continue;
    if (ch === "$") {
      if (rawLine[i + 1] === "$") {
        // ブロック数式 $$ はテーブル行では通常出現しないが、念のため2文字読み飛ばす。
        i += 1;
        continue;
      }
      inMath = !inMath;
      continue;
    }
    if (ch === "|" && inMath) {
      addWarning(
        filePath,
        lineNumber,
        `表のセル内、インライン数式 $...$ の内側に生の "|" があります（列崩れの原因になります）。\\lvert / \\rvert または \\mid を使ってください。`,
      );
    }
  }
}

// ── 検査1: GFM 表の列崩れ ───────────────────────────────────
function checkTables(lines, fenceMask, filePath) {
  let i = 0;
  while (i < lines.length - 1) {
    if (
      !fenceMask[i] &&
      lines[i].includes("|") &&
      !fenceMask[i + 1] &&
      isDelimiterRow(lines[i + 1])
    ) {
      const headerLine = i;
      const headerCells = splitTableRow(lines[headerLine]);
      const delimiterCells = splitTableRow(lines[headerLine + 1]);

      if (headerCells.length !== delimiterCells.length) {
        addError(
          filePath,
          headerLine + 1,
          `表のヘッダー行とデリミタ行で列数が一致しません（ヘッダー: ${headerCells.length}列, デリミタ: ${delimiterCells.length}列）。`,
        );
      }

      scanRowForPipeInMath(lines[headerLine], headerLine + 1, filePath);

      let j = headerLine + 2;
      while (j < lines.length && lines[j].trim() !== "" && !fenceMask[j]) {
        const rowCells = splitTableRow(lines[j]);
        if (rowCells.length !== headerCells.length) {
          addError(
            filePath,
            j + 1,
            `表の列数が不一致です（ヘッダー: ${headerCells.length}列, この行: ${rowCells.length}列）。セル内の生の "|" や不足しているセル区切りを確認してください。`,
          );
        }
        scanRowForPipeInMath(lines[j], j + 1, filePath);
        j += 1;
      }
      i = j;
      continue;
    }
    i += 1;
  }
}

// ── 検査2: 数式デリミタの整合 ────────────────────────────────
function checkMathDelimiters(rawContent, lines, fenceMask, filePath) {
  // コードフェンスとインラインコードスパンを空白に置換し、行数・列位置を保ったまま
  // $ や \left/\right の誤検出（サンプルコード内の文字列など）を避ける。
  const sanitizedLines = lines.map((line, idx) => {
    if (fenceMask[idx]) return "";
    return line.replace(/`[^`]*`/g, (m) => " ".repeat(m.length));
  });
  const sanitized = sanitizedLines.join("\n");

  // エスケープされた \$ は数式デリミタではないので除外する。
  const withoutEscapedDollar = sanitized.replace(/\\\$/g, "  ");

  const blockDollarCount = (withoutEscapedDollar.match(/\$\$/g) ?? []).length;
  if (blockDollarCount % 2 !== 0) {
    addError(
      filePath,
      null,
      `ブロック数式 $$ の数が奇数です（${blockDollarCount}個）。開閉が対応していません。`,
    );
  }

  // ブロック数式 $$...$$ の中身を取り除いてからインライン $ を数える
  // （$$ 自体は2文字消費するので誤ってインライン扱いされない）。
  const withoutBlockMath = withoutEscapedDollar.replace(/\$\$[\s\S]*?\$\$/g, "  ");
  const inlineDollarCount = (withoutBlockMath.match(/\$/g) ?? []).length;
  if (inlineDollarCount % 2 !== 0) {
    addError(
      filePath,
      null,
      `インライン数式 $ の数が奇数です（${inlineDollarCount}個）。閉じ忘れの可能性があります。`,
    );
  }

  const leftCount = (sanitized.match(/\\left(?![a-zA-Z])/g) ?? []).length;
  const rightCount = (sanitized.match(/\\right(?![a-zA-Z])/g) ?? []).length;
  if (leftCount !== rightCount) {
    addError(
      filePath,
      null,
      `\\left と \\right の個数が一致しません（\\left: ${leftCount}個, \\right: ${rightCount}個）。`,
    );
  }
}

// ── 検査3: frontmatter ──────────────────────────────────────
function findFrontmatterLine(lines, key) {
  // 2つ目の `---` までの範囲で `key:` から始まる行を探す。
  let closes = 0;
  for (let i = 0; i < lines.length; i++) {
    if (/^---\s*$/.test(lines[i])) {
      closes += 1;
      if (closes >= 2) break;
      continue;
    }
    if (new RegExp(`^${key}\\s*:`).test(lines[i])) return i + 1;
  }
  return 1;
}

function normalizeUpdated(value) {
  // src/lib/content.ts の normalizeUpdated と同じ規則。
  // YAML はクォートなしの日付をDateとして解釈するため、両方を受け付ける。
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return value;
  }
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().slice(0, 10);
  }
  return null;
}

function checkFrontmatter(rawContent, lines, filePath) {
  let parsed;
  try {
    parsed = matter(rawContent);
  } catch (err) {
    addError(filePath, 1, `frontmatter の YAML 解析に失敗しました: ${err.message}`);
    return;
  }

  const data = parsed.data;
  const hasFrontmatter =
    typeof data === "object" && data !== null && !Array.isArray(data) && Object.keys(data).length > 0;

  if (!hasFrontmatter) {
    // 旧雛形（sync-treemap.mjs が生成する「> 状態: 未着手」だけの本文）は
    // 「未着手」として扱い、エラー・警告のいずれも出さない。
    if (parsed.content.includes("状態: 未着手")) return;
    addWarning(
      filePath,
      1,
      `frontmatter がありません。本文があるファイルには title / status / updated を追加してください（雛形のままなら無視して構いません）。`,
    );
    return;
  }

  if (typeof data.title !== "string" || data.title.trim() === "") {
    addWarning(filePath, findFrontmatterLine(lines, "title"), `frontmatter に title がありません。`);
  }

  if (data.status === undefined) {
    addWarning(
      filePath,
      findFrontmatterLine(lines, "status"),
      `frontmatter に status がありません（既定で「作業中」として扱われます）。`,
    );
  } else if (!VALID_STATUSES.includes(data.status)) {
    addWarning(
      filePath,
      findFrontmatterLine(lines, "status"),
      `status の値 "${data.status}" が不正です（${VALID_STATUSES.join(" / ")} のいずれかを指定してください。既定で「作業中」として扱われます）。`,
    );
  }

  if (data.updated === undefined) {
    addWarning(filePath, findFrontmatterLine(lines, "updated"), `frontmatter に updated がありません。`);
  } else if (normalizeUpdated(data.updated) === null) {
    addWarning(
      filePath,
      findFrontmatterLine(lines, "updated"),
      `updated の値 "${data.updated}" を YYYY-MM-DD として解釈できません。`,
    );
  }
}

// ── 検査4: <details> の整合 ──────────────────────────────────
function checkDetailsTags(lines, fenceMask, filePath) {
  const openLines = [];
  const closeLines = [];
  for (let i = 0; i < lines.length; i++) {
    if (fenceMask[i]) continue;
    if (/<details\b/i.test(lines[i])) openLines.push(i);
    if (/<\/details>/i.test(lines[i])) closeLines.push(i);
  }

  if (openLines.length !== closeLines.length) {
    addError(
      filePath,
      null,
      `<details> と </details> の数が一致しません（<details>: ${openLines.length}個, </details>: ${closeLines.length}個）。`,
    );
  }

  for (const i of openLines) {
    const next = lines[i + 1];
    if (next === undefined || next.trim() !== "") {
      addWarning(
        filePath,
        i + 1,
        `<details> の直後に空行がありません。空行がないと中身が Markdown として解釈されず生テキストのまま表示されます。`,
      );
    }
  }
  for (const i of closeLines) {
    const prev = lines[i - 1];
    if (prev === undefined || prev.trim() !== "") {
      addWarning(
        filePath,
        i + 1,
        `</details> の直前に空行がありません。空行がないと直前の内容が Markdown として解釈されないことがあります。`,
      );
    }
  }
}

// ── 検査5: 見出しレベル ──────────────────────────────────────
function checkHeadingLevel(lines, fenceMask, filePath) {
  for (let i = 0; i < lines.length; i++) {
    if (fenceMask[i]) continue;
    if (/^#(?!#)\s+/.test(lines[i])) {
      addWarning(
        filePath,
        i + 1,
        `見出しレベル h1（#）が使われています。教材本文の見出しは ## から開始する規約です。`,
      );
    }
  }
}

// ── 検査6: 問題IDと problems.md ⇔ solutions.md の対応 ─────────
function extractProblemHeadings(lines, kind, unitId, filePath) {
  const headings = [];
  const seenIds = new Map();
  const fenceMask = computeFenceMask(lines);

  for (let i = 0; i < lines.length; i++) {
    if (fenceMask[i]) continue;

    const match = lines[i].match(/^##\s+問題\s*(\d+)(.*)$/);
    if (!match) continue;

    const number = Number(match[1]);
    const expectedSerial = String(number).padStart(3, "0");
    const expectedId = `${unitId}-${expectedSerial}`;
    const suffix = match[2];
    const idMatch = suffix.match(/^\s*（([^）]+)）/);
    const id = idMatch?.[1] ?? null;
    const line = i + 1;

    if (id === null) {
      addError(
        filePath,
        line,
        `問題 ${number} の見出しに問題ID「（${expectedId}）」がありません。全角括弧で指定してください。`,
      );
    } else {
      const parsedId = id.match(/^(.+)-(\d{3})$/);
      if (!parsedId) {
        addError(
          filePath,
          line,
          `問題ID「${id}」の形式が不正です。「<unitId>-<3桁連番>」にしてください。`,
        );
      } else {
        const [, idUnitId, serial] = parsedId;
        if (idUnitId !== unitId) {
          addError(
            filePath,
            line,
            `問題ID「${id}」の単元IDが教材の単元ID「${unitId}」と一致しません。`,
          );
        }
        if (serial !== expectedSerial) {
          addError(
            filePath,
            line,
            `問題ID「${id}」の3桁連番が問題番号 ${number}（${expectedSerial}）と一致しません。`,
          );
        }
      }

      const firstLine = seenIds.get(id);
      if (firstLine !== undefined) {
        addError(
          filePath,
          line,
          `問題ID「${id}」がファイル内で重複しています（最初の出現: ${firstLine}行目）。`,
        );
      } else {
        seenIds.set(id, line);
      }
    }

    const suffixAfterId = idMatch ? suffix.slice(idMatch[0].length) : suffix;
    // 既存どおり、solutions.md の対応対象は「の解答」見出しに限る。
    if (kind === "solutions" && !/^\s*の解答(?:\s|$)/.test(suffixAfterId)) {
      continue;
    }

    headings.push({ number, id, line });
  }
  return headings;
}

function problemHeadingKey(heading) {
  return `${heading.number}\0${heading.id ?? ""}`;
}

function checkProblemSolutionCorrespondence(
  problemHeadings,
  solutionHeadings,
  problemsPath,
  solutionsPath,
) {
  const problemKeys = new Set(problemHeadings.map(problemHeadingKey));
  const solutionKeys = new Set(solutionHeadings.map(problemHeadingKey));

  for (const heading of problemHeadings) {
    if (!solutionKeys.has(problemHeadingKey(heading))) {
      addWarning(
        problemsPath,
        heading.line,
        `問題 ${heading.number}（${heading.id ?? "IDなし"}）が problems.md にありますが、solutions.md に番号と問題IDが一致する解答見出しが見つかりません。`,
      );
    }
  }
  for (const heading of solutionHeadings) {
    if (!problemKeys.has(problemHeadingKey(heading))) {
      addWarning(
        solutionsPath,
        heading.line,
        `問題 ${heading.number}（${heading.id ?? "IDなし"}）の解答が solutions.md にありますが、problems.md に番号と問題IDが一致する問題見出しが見つかりません。`,
      );
    }
  }
}

// sync-treemap.mjs が生成する雛形（frontmatter なし・「状態: 未着手」の1文だけ）かどうか。
// 雛形自体が h1 見出しを使う設計になっているため、これを検査対象にすると
// 57単元の大半で同じ警告が機械的に出るだけになり、実質的な意味を持たない。
// そのため雛形は丸ごと検査対象から外す（content.ts が「未着手」として
// フォールバックするのと同じ意味論）。
function isStubTemplate(rawContent) {
  let parsed;
  try {
    parsed = matter(rawContent);
  } catch {
    return false;
  }
  const data = parsed.data;
  const hasFrontmatter =
    typeof data === "object" && data !== null && !Array.isArray(data) && Object.keys(data).length > 0;
  return !hasFrontmatter && parsed.content.includes("状態: 未着手");
}

// ── メイン処理 ────────────────────────────────────────────
async function checkFile(filePath) {
  let rawContent;
  try {
    rawContent = await fs.readFile(filePath, "utf8");
  } catch {
    return null; // ファイルが存在しない単元は未着手として無視する
  }

  if (isStubTemplate(rawContent)) {
    return null; // 未着手の雛形は検査対象外（問題番号対応チェックにも使わない）
  }

  const lines = rawContent.split(/\r\n|\n/);
  const fenceMask = computeFenceMask(lines);

  checkTables(lines, fenceMask, filePath);
  checkMathDelimiters(rawContent, lines, fenceMask, filePath);
  checkFrontmatter(rawContent, lines, filePath);
  checkDetailsTags(lines, fenceMask, filePath);
  checkHeadingLevel(lines, fenceMask, filePath);

  return lines;
}

async function main() {
  const unitDirs = await collectUnitDirs();
  let checkedFileCount = 0;

  for (const unit of unitDirs) {
    /** @type {Record<string, string[] | null>} */
    const linesByKind = {};

    for (const { kind, relPath } of DOC_KINDS) {
      const filePath = path.join(unit.dir, relPath);
      const lines = await checkFile(filePath);
      linesByKind[kind] = lines;
      if (lines !== null) checkedFileCount += 1;
    }

    const problemsPath = path.join(unit.dir, "workbook", "problems.md");
    const solutionsPath = path.join(unit.dir, "workbook", "solutions.md");
    const problemHeadings = linesByKind.problems
      ? extractProblemHeadings(
          linesByKind.problems,
          "problems",
          unit.unitId,
          problemsPath,
        )
      : null;
    const solutionHeadings = linesByKind.solutions
      ? extractProblemHeadings(
          linesByKind.solutions,
          "solutions",
          unit.unitId,
          solutionsPath,
        )
      : null;

    if (problemHeadings && solutionHeadings) {
      checkProblemSolutionCorrespondence(
        problemHeadings,
        solutionHeadings,
        problemsPath,
        solutionsPath,
      );
    }
  }

  results.sort((a, b) => {
    const fileCompare = a.file.localeCompare(b.file);
    if (fileCompare !== 0) return fileCompare;
    return (a.line ?? 0) - (b.line ?? 0);
  });

  for (const result of results) {
    const tag = result.level === "error" ? "エラー" : "警告";
    const location = result.line !== null ? `${relDisplay(result.file)}:${result.line}` : relDisplay(result.file);
    console.log(`[${tag}] ${location} ${result.message}`);
  }

  const errorCount = results.filter((r) => r.level === "error").length;
  const warningCount = results.filter((r) => r.level === "warning").length;

  console.log("");
  console.log(
    `検査対象: ${checkedFileCount}ファイル / エラー: ${errorCount}件 / 警告: ${warningCount}件`,
  );

  process.exit(errorCount > 0 ? 1 : 0);
}

await main();
