import { useMemo } from "react";
import type { BudgetWarning } from "../lib/dashboard";
import type { AttentionItem } from "../components/dashboard/AttentionStrip";

type UseAttentionItemsArgs = {
  hasBudgets: boolean;
  warnings: BudgetWarning[];
  overdueCount: number;
  dueSoonCount: number;
  subscriptionsCount: number;
  isLoading: boolean;
  transactionsCount: number;
  accountsCount: number;
  reconciliationMismatchCount: number;
};

export const useAttentionItems = ({
  hasBudgets,
  warnings,
  overdueCount,
  dueSoonCount,
  subscriptionsCount,
  isLoading,
  transactionsCount,
  accountsCount,
  reconciliationMismatchCount,
}: UseAttentionItemsArgs) =>
  useMemo<AttentionItem[]>(() => {
    const items: AttentionItem[] = [];

    if (!hasBudgets) {
      items.push({
        id: "no-budgets",
        title: "No budgets yet",
        description: "Set monthly budgets to unlock soft-cap alerts.",
        badge: "Budgets",
        tone: "blue",
        action: { label: "Set budgets", to: "/budgets" },
      });
    } else if (warnings.length > 0) {
      items.push({
        id: "budget-warnings",
        title: "Spending near budget caps",
        description: `${warnings.length} categories are at 80% or higher.`,
        badge: `${warnings.length} caps`,
        tone: "orange",
        action: { label: "Review budgets", to: "/budgets" },
      });
    }

    if (overdueCount > 0) {
      items.push({
        id: "overdue-subscriptions",
        title: "Overdue subscriptions",
        description: `${overdueCount} payments are past due.`,
        badge: `${overdueCount} overdue`,
        tone: "red",
        action: { label: "Review subscriptions", to: "/subscriptions" },
      });
    } else if (dueSoonCount > 0) {
      items.push({
        id: "due-soon-subscriptions",
        title: "Subscriptions due soon",
        description: `${dueSoonCount} payments due within 7 days.`,
        badge: `${dueSoonCount} due`,
        tone: "yellow",
        action: { label: "Review subscriptions", to: "/subscriptions" },
      });
    } else if (subscriptionsCount === 0) {
      items.push({
        id: "no-subscriptions",
        title: "No subscriptions tracked",
        description: "Add recurring bills to forecast renewals.",
        badge: "Subscriptions",
        tone: "blue",
        action: { label: "Add subscriptions", to: "/subscriptions" },
      });
    }

    if (!isLoading && transactionsCount === 0) {
      items.push({
        id: "no-transactions",
        title: "No transactions this month",
        description: "Log expenses or import data to populate your dashboard.",
        badge: "Transactions",
        tone: "blue",
        action: { label: "Add transactions", to: "/transactions" },
      });
    }

    if (reconciliationMismatchCount > 0) {
      items.push({
        id: "reconciliation-mismatch",
        title: "Reconciliation mismatch",
        description: `${reconciliationMismatchCount} account${
          reconciliationMismatchCount === 1 ? "" : "s"
        } differ from last statement.`,
        badge: `${reconciliationMismatchCount} mismatch${
          reconciliationMismatchCount === 1 ? "" : "es"
        }`,
        tone: "orange",
        action: { label: "Reconcile accounts", to: "/settings" },
      });
    }

    if (accountsCount === 0) {
      items.push({
        id: "no-accounts",
        title: "No accounts connected",
        description: "Add bank, card, or cash balances to see coverage.",
        badge: "Accounts",
        tone: "blue",
        action: { label: "Add accounts", to: "/settings" },
      });
    }

    return items;
  }, [
    accountsCount,
    dueSoonCount,
    hasBudgets,
    isLoading,
    overdueCount,
    reconciliationMismatchCount,
    subscriptionsCount,
    transactionsCount,
    warnings.length,
  ]);
