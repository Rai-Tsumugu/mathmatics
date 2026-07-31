import Link from "next/link";
import type { Unit } from "@/lib/tree";

export function RelationshipList({
  title,
  emptyText,
  units,
}: {
  title: string;
  emptyText: string;
  units: Unit[];
}) {
  return (
    <section className="relationshipBlock">
      <h2>{title}</h2>
      {units.length ? (
        <div className="relationshipList">
          {units.map((unit) => (
            <Link href={`/learn/${unit.id}`} key={unit.id}>
              <span className={`relationDot category-${unit.category}`} />
              <span>
                <strong>{unit.title}</strong>
                <small>{unit.categoryLabel}</small>
              </span>
              <span aria-hidden="true">→</span>
            </Link>
          ))}
        </div>
      ) : (
        <p className="emptyState">{emptyText}</p>
      )}
    </section>
  );
}

