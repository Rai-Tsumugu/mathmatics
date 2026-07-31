import treeData from "@/content/tree.generated.json";

export type CategoryId = "calc" | "lin" | "disc" | "prob" | "bridge";

export type Unit = {
  id: string;
  title: string;
  summary: string;
  category: CategoryId;
  categorySlug: string;
  categoryLabel: string;
  categoryOrder: number;
  row: number;
  column: string | null;
  layoutX: number;
  layoutWidth: number;
  core: boolean;
  machineLearning: boolean;
  recommendedTerm: string;
  rationale: string;
  topics: string[];
  tip: string;
  machineLearningUse: string;
  prerequisites: string[];
  nextUnits: string[];
};

export type Category = {
  id: CategoryId;
  slug: string;
  label: string;
  order: number;
};

export type TreeEdge = {
  from: string;
  to: string;
  crossField: boolean;
};

export const units = treeData.units as Unit[];
export const categories = treeData.categories as Category[];
export const edges = treeData.edges as TreeEdge[];

export const unitById = new Map(units.map((unit) => [unit.id, unit]));

export function getUnit(id: string) {
  return unitById.get(id);
}

export function getUnitsByCategory(categoryId: CategoryId) {
  return units
    .filter((unit) => unit.category === categoryId)
    .sort((a, b) => a.row - b.row || a.title.localeCompare(b.title, "ja"));
}

export function resolveUnits(ids: string[]) {
  return ids.flatMap((id) => {
    const unit = getUnit(id);
    return unit ? [unit] : [];
  });
}
