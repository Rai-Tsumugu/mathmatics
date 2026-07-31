import fs from "node:fs/promises";
import path from "node:path";
import vm from "node:vm";

const root = process.cwd();
const sourcePath = path.join(root, "tree-map", "math-treemap-full.html");
const source = await fs.readFile(sourcePath, "utf8");

function extractAssignment(startMarker, endMarker, declaration) {
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start);
  if (start === -1 || end === -1) {
    throw new Error(`ツリーマップから ${declaration} を抽出できませんでした。`);
  }
  return source
    .slice(start, end)
    .replace(`const ${declaration}=`, `${declaration}=`);
}

const context = {};
vm.createContext(context);
vm.runInContext(
  extractAssignment("const N=", "/* ================= 依存関係", "N"),
  context,
);
vm.runInContext(
  extractAssignment("const E=", "/* ================= 描画", "E"),
  context,
);

const categoryMap = {
  calc: { slug: "calculus", label: "微分積分系", order: 1 },
  lin: { slug: "linear-algebra", label: "線形代数系", order: 2 },
  disc: { slug: "discrete-foundations", label: "離散・基礎", order: 3 },
  prob: { slug: "probability-statistics", label: "確率・統計", order: 4 },
  bridge: { slug: "applications", label: "応用・合流", order: 5 },
};
const layoutColumns = {
  A: 20,
  B: 214,
  C: 408,
  D: 626,
  E: 820,
  F: 1038,
  G: 1232,
};

const edges = context.E.map(([from, to, cross = 0]) => ({
  from,
  to,
  crossField: Boolean(cross),
}));

const units = Object.entries(context.N).map(([id, raw]) => {
  const category = categoryMap[raw.c];
  const prerequisites = edges
    .filter((edge) => edge.to === id)
    .map((edge) => edge.from);
  const nextUnits = edges
    .filter((edge) => edge.from === id)
    .map((edge) => edge.to);

  return {
    id,
    title: raw.t,
    summary: raw.s ?? "",
    category: raw.c,
    categorySlug: category.slug,
    categoryLabel: category.label,
    categoryOrder: category.order,
    row: raw.r ?? 0,
    column: raw.col ?? null,
    layoutX: raw.x ?? layoutColumns[raw.col] ?? 20,
    layoutWidth: raw.w ?? 186,
    core: Boolean(raw.core),
    machineLearning: Boolean(raw.ml),
    recommendedTerm: raw.term ?? "",
    rationale: raw.why ?? "",
    topics: raw.topics ?? [],
    tip: raw.tip ?? "",
    machineLearningUse: raw.mlUse ?? "",
    prerequisites,
    nextUnits,
  };
});

const payload = {
  generatedFrom: "tree-map/math-treemap-full.html",
  generatedAt: new Date().toISOString(),
  categories: Object.entries(categoryMap).map(([id, value]) => ({
    id,
    ...value,
  })),
  units,
  edges,
};

const generatedDir = path.join(root, "src", "content");
await fs.mkdir(generatedDir, { recursive: true });
await fs.writeFile(
  path.join(generatedDir, "tree.generated.json"),
  `${JSON.stringify(payload, null, 2)}\n`,
);

const lectureTemplate = (unit) => `# ${unit.title} — 講義

> 状態: 未着手

このファイルに講義本文を追加します。ページ構成は共通レイアウト側で管理します。
`;

const interactiveTemplate = (unit) => `# ${unit.title} — インタラクティブ教材

> 状態: 未着手

実装する操作、入力、可視化、完了条件をここに記録します。
`;

const problemsTemplate = (unit) => `# ${unit.title} — 問題集

> 状態: 未着手

基礎・標準・発展の順で問題を追加します。
`;

const solutionsTemplate = (unit) => `# ${unit.title} — 解答解説集

> 状態: 未着手

問題IDと対応させ、考え方・解法・検算を追加します。
`;

for (const unit of units) {
  const unitDir = path.join(
    generatedDir,
    "units",
    unit.categorySlug,
    unit.id,
  );
  const files = [
    [path.join("lecture", "README.md"), lectureTemplate(unit)],
    [path.join("interactive", "README.md"), interactiveTemplate(unit)],
    [path.join("workbook", "problems.md"), problemsTemplate(unit)],
    [path.join("workbook", "solutions.md"), solutionsTemplate(unit)],
  ];

  await fs.mkdir(unitDir, { recursive: true });
  await fs.writeFile(
    path.join(unitDir, "metadata.json"),
    `${JSON.stringify(unit, null, 2)}\n`,
  );

  for (const [relativePath, contents] of files) {
    const destination = path.join(unitDir, relativePath);
    await fs.mkdir(path.dirname(destination), { recursive: true });
    try {
      await fs.access(destination);
    } catch {
      await fs.writeFile(destination, contents);
    }
  }
}

const trackerPath = path.join(root, "project-management", "progress.md");
try {
  await fs.access(trackerPath);
} catch {
  const phaseRows = [
    ["P01", "基盤", "Next.js / Vercel基盤", "完了", "100%", "本番ビルド可能な構成"],
    ["P02", "基盤", "ツリーデータ同期", "完了", "100%", "57単元・134依存関係"],
    ["P03", "UI", "共通レイアウト", "完了", "100%", "ヘッダー・一覧・単元ページ"],
    ["P04", "UI", "相互リンク", "完了", "100%", "前提・後続単元リンク"],
    ["P05", "教材", "講義コンテンツ制作", "未着手", "0%", "単元別に進行"],
    ["P06", "教材", "インタラクティブ教材制作", "未着手", "0%", "単元別に進行"],
    ["P07", "教材", "問題集・解答解説制作", "未着手", "0%", "単元別に進行"],
    ["P08", "品質", "アクセシビリティ・表示・リンク検証", "未着手", "0%", "教材追加後に継続実施"],
  ];
  const phases = phaseRows
    .map((row) => `| ${row.join(" | ")} |`)
    .join("\n");
  const unitRows = units
    .slice()
    .sort(
      (a, b) =>
        a.categoryOrder - b.categoryOrder ||
        a.row - b.row ||
        a.title.localeCompare(b.title, "ja"),
    )
    .map(
      (unit) =>
        `| ${unit.id} | ${unit.categoryLabel} | ${unit.title} | 未着手 | 未着手 | 未着手 | 未着手 | 0% |  |`,
    )
    .join("\n");
  const tracker = `# 開発工程・教材制作 進捗管理表

最終更新: ${new Date().toISOString().slice(0, 10)}

## 更新ルール

- ステータスは \`未着手\` / \`作業中\` / \`レビュー中\` / \`完了\` / \`保留\` を使用する。
- 単元の総合進捗は4教材の完了度を目安に、25%刻みで更新する。
- 担当者・期限・課題は「メモ」へ記載する。大きな課題はIssueへ分離する。
- このファイルは初回同期時のみ生成され、以後の \`npm run content:sync\` では上書きされない。

## 全体工程

| ID | 区分 | 工程 | ステータス | 進捗 | 完了条件 |
| --- | --- | --- | --- | ---: | --- |
${phases}

## 単元別コンテンツ

| 単元ID | 分野 | 単元名 | 講義 | インタラクティブ | 問題集 | 解答解説 | 総合進捗 | メモ |
| --- | --- | --- | --- | --- | --- | --- | ---: | --- |
${unitRows}

## リリース判定

| チェック項目 | ステータス | 確認内容 |
| --- | --- | --- |
| データ整合性 | 作業中 | 単元数・依存関係・リンク切れ |
| 本番ビルド | 作業中 | \`npm run build\` 成功 |
| レスポンシブ表示 | 作業中 | Desktop / Tablet / Mobile |
| アクセシビリティ | 未着手 | キーボード操作・見出し・コントラスト |
| 教材レビュー | 未着手 | 数学的正確性・表記統一 |
| Vercel公開 | 未着手 | Preview確認後にProductionへ反映 |
`;
  await fs.mkdir(path.dirname(trackerPath), { recursive: true });
  await fs.writeFile(trackerPath, tracker);
}

const adminDataPath = path.join(
  root,
  "src",
  "content",
  "admin-data.json",
);
try {
  await fs.access(adminDataPath);
} catch {
  const now = new Date().toISOString();
  const unitRecords = Object.fromEntries(
    units.map((unit) => [
      unit.id,
      {
        unitId: unit.id,
        owner: "",
        dueDate: "",
        notes: "",
        sourceNotes: "",
        publishStatus: "draft",
        contentStatus: {
          lecture: "not-started",
          interactive: "not-started",
          problems: "not-started",
          solutions: "not-started",
        },
        updatedAt: now,
      },
    ]),
  );
  const adminData = {
    schemaVersion: 2,
    updatedAt: now,
    units: unitRecords,
    problems: [],
  };
  await fs.writeFile(
    adminDataPath,
    `${JSON.stringify(adminData, null, 2)}\n`,
  );
}

console.log(
  `ツリーマップを同期しました: ${units.length}単元 / ${edges.length}依存関係`,
);
