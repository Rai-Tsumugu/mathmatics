import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { RelationshipList } from "@/components/RelationshipList";
import { getUnitDocuments, type UnitDocumentKind } from "@/lib/content";
import { getUnit, resolveUnits, units } from "@/lib/tree";

type Props = {
  params: Promise<{ unitId: string }>;
};

const moduleCards: Array<{
  key: UnitDocumentKind;
  title: string;
  description: string;
}> = [
  { key: "lecture", title: "講義", description: "定義・定理・直観を順序立てて学ぶ" },
  {
    key: "interactive",
    title: "インタラクティブ",
    description: "入力や図を動かして性質を確かめる",
  },
  { key: "problems", title: "問題集", description: "理解度に応じた演習に取り組む" },
  {
    key: "solutions",
    title: "解答解説",
    description: "方針・計算・検算を段階的に確認する",
  },
];

// 本文セクションを描画する対象。interactive は実装前の仕様メモに留まるため
// カードの状態表示のみに使い、本文としては描画しない。
const bodySections: Array<{ key: "lecture" | "problems" | "solutions"; title: string }> = [
  { key: "lecture", title: "講義" },
  { key: "problems", title: "問題集" },
  { key: "solutions", title: "解答解説" },
];

function formatStatus(status: string, updated: string | null) {
  return updated ? `${status} ・ ${updated}` : status;
}

export function generateStaticParams() {
  return units.map((unit) => ({ unitId: unit.id }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { unitId } = await params;
  const unit = getUnit(unitId);
  return unit
    ? { title: unit.title, description: unit.summary }
    : { title: "単元が見つかりません" };
}

export default async function UnitPage({ params }: Props) {
  const { unitId } = await params;
  const unit = getUnit(unitId);
  if (!unit) notFound();

  const prerequisites = resolveUnits(unit.prerequisites);
  const nextUnits = resolveUnits(unit.nextUnits);
  const docs = await getUnitDocuments(unit);
  const hasAvailableDoc = moduleCards.some(({ key }) => docs[key].available);
  const availableBodySections = bodySections.filter(({ key }) => docs[key].available);

  return (
    <main className="unitPage">
      <nav className="breadcrumb" aria-label="パンくずリスト">
        <Link href="/">学習ツリー</Link>
        <span>/</span>
        <span>{unit.categoryLabel}</span>
        <span>/</span>
        <span>{unit.title}</span>
      </nav>

      <header className={`unitHero category-${unit.category}`}>
        <div>
          <p className="eyebrow">{unit.categoryLabel}</p>
          <h1>{unit.title}</h1>
          <p>{unit.summary}</p>
        </div>
        <dl>
          <div>
            <dt>推奨時期</dt>
            <dd>{unit.recommendedTerm || "未設定"}</dd>
          </div>
          <div>
            <dt>単元ID</dt>
            <dd>{unit.id}</dd>
          </div>
        </dl>
      </header>

      <section className="learningModules">
        <h2>学習コンテンツ</h2>
        <p>
          {hasAvailableDoc
            ? "準備が整った教材から、このページで読める。カードから該当セクションへ移動できる。"
            : "現在は構成のみ準備済みです。各教材は単元フォルダ内の独立ファイルとして追加します。"}
        </p>
        <div className="moduleGrid">
          {moduleCards.map(({ key, title, description }, index) => {
            const doc = docs[key];
            const inner = (
              <>
                <span>{String(index + 1).padStart(2, "0")}</span>
                <h3>{title}</h3>
                <p>{description}</p>
                <small>{formatStatus(doc.status, doc.updated)}</small>
              </>
            );
            return (
              <article
                key={key}
                className={doc.available ? "moduleCard moduleCardAvailable" : "moduleCard"}
              >
                {doc.available ? (
                  <a className="moduleCardLink" href={`#doc-${key}`}>
                    {inner}
                  </a>
                ) : (
                  <div className="moduleCardBody">{inner}</div>
                )}
              </article>
            );
          })}
        </div>
      </section>

      {availableBodySections.length > 0 ? (
        <>
          {availableBodySections.map(({ key, title }) => {
            const doc = docs[key];
            const head = (
              <div className="unitDocHead">
                <h2>{title}</h2>
                <span className="docStatus">{formatStatus(doc.status, doc.updated)}</span>
              </div>
            );
            const body = (
              <div
                className="unitDocBody"
                dangerouslySetInnerHTML={{ __html: doc.html }}
              />
            );
            return (
              <section className="unitDoc" id={`doc-${key}`} key={key}>
                {key === "solutions" ? (
                  <details className="solutionsToggle">
                    <summary>解答解説を表示</summary>
                    {head}
                    {body}
                  </details>
                ) : (
                  <>
                    {head}
                    {body}
                  </>
                )}
              </section>
            );
          })}
        </>
      ) : null}

      {unit.rationale ? (
        <section className="whySection">
          <p className="eyebrow">WHY THIS MATTERS</p>
          <h2>この単元を学ぶ理由</h2>
          <p>{unit.rationale}</p>
        </section>
      ) : null}

      {unit.topics.length ? (
        <section className="topicsSection">
          <h2>扱うトピック</h2>
          <ol>
            {unit.topics.map((topic) => (
              <li key={topic}>{topic}</li>
            ))}
          </ol>
        </section>
      ) : null}

      <div className="relationships">
        <RelationshipList
          title="先に学ぶ単元"
          emptyText="この単元は学習ツリーの入口です。"
          units={prerequisites}
        />
        <RelationshipList
          title="次に進める単元"
          emptyText="この単元は現在の学習ツリーの終点です。"
          units={nextUnits}
        />
      </div>
    </main>
  );
}

