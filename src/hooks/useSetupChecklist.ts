import { useMemo } from "react";
import type { SetupChecklistItem } from "../components/dashboard/SetupChecklistCard";

type UseSetupChecklistArgs = {
  accountsCount: number;
  categoriesCount: number;
  hasBudgets: boolean;
  subscriptionsCount: number;
};

export const useSetupChecklist = ({
  accountsCount,
  categoriesCount,
  hasBudgets,
  subscriptionsCount,
}: UseSetupChecklistArgs) => {
  const items = useMemo<SetupChecklistItem[]>(
    () => [
      {
        id: "accounts",
        label: "Add accounts",
        description: "Connect bank, card, or cash balances.",
        done: accountsCount > 0,
        action: { label: "Add accounts", to: "/settings" },
      },
      {
        id: "categories",
        label: "Create categories",
        description: "Organize spending with categories and parents.",
        done: categoriesCount > 0,
        action: { label: "Add categories", to: "/settings" },
      },
      {
        id: "budgets",
        label: "Set budgets",
        description: "Track progress with monthly caps.",
        done: hasBudgets,
        action: { label: "Set budgets", to: "/budgets" },
      },
      {
        id: "subscriptions",
        label: "Track subscriptions",
        description: "Keep renewals and recurring bills visible.",
        done: subscriptionsCount > 0,
        action: { label: "Add subscriptions", to: "/subscriptions" },
      },
    ],
    [accountsCount, categoriesCount, hasBudgets, subscriptionsCount]
  );

  const showSetupChecklist = items.some((item) => !item.done);

  return { items, showSetupChecklist };
};
