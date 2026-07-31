import Link from "next/link";
import type { Unit } from "@/lib/tree";

export function UnitCard({ unit }: { unit: Unit }) {
  return (
    <article className={`unitCard category-${unit.category}`}>
      <div className="unitCardTopline">
        <span className="unitId">{unit.id}</span>
        <span className="badges">
          {unit.core ? <span className="badge">主軸</span> : null}
          {unit.machineLearning ? <span className="badge badgeMl">ML</span> : null}
        </span>
      </div>
      <h3>
        <Link href={`/learn/${unit.id}`}>{unit.title}</Link>
      </h3>
      <p>{unit.summary}</p>
      <div className="unitMeta">
        <span>前提 {unit.prerequisites.length}</span>
        <span>次へ {unit.nextUnits.length}</span>
      </div>
    </article>
  );
}

