import type { Transaction, Category } from "../types/finance";

export const buildTopCategories = (
  transactions: Transaction[],
  categories: Category[],
  limit = 5
) => {
  const nameMap = new Map(categories.map((cat) => [cat.id, cat.name]));
  const totals = new Map<string, number>();

  transactions
    .filter((tx) => tx.type === "expense" && !tx.is_transfer)
    .forEach((tx) => {
      const key = tx.category_id ?? "Uncategorized";
      totals.set(key, (totals.get(key) ?? 0) + tx.amount);
    });

  return Array.from(totals.entries())
    .map(([id, amount]) => ({
      id,
      name: nameMap.get(id) ?? "Uncategorized",
      amount,
    }))
    .sort((a, b) => b.amount - a.amount)
    .slice(0, limit);
};
