import { Group, Stack, Switch, Text } from "@mantine/core";
import { useMemo, useState } from "react";
import dayjs from "dayjs";
import { Eye, EyeOff } from "lucide-react";
import { ChartsSection } from "../components/dashboard/ChartsSection";
import { OverviewCards } from "../components/dashboard/OverviewCards";
import { AttentionStrip, type AttentionItem } from "../components/dashboard/AttentionStrip";
import { SoftCapAlerts } from "../components/dashboard/SoftCapAlerts";
import { RecentActivityTable } from "../components/dashboard/RecentActivityTable";
import { AccountBalances } from "../components/dashboard/AccountBalances";
import { CoverageCard } from "../components/dashboard/CoverageCard";
import { NetCashflowCard } from "../components/dashboard/NetCashflowCard";
import { ForecastCard } from "../components/dashboard/ForecastCard";
import { UpcomingSubscriptionsCard } from "../components/dashboard/UpcomingSubscriptionsCard";
import { useDashboardData } from "../hooks/useDashboardData";
import { useGetAccountsQuery, useGetSubscriptionsQuery } from "../features/api/apiSlice";
import { getUpcomingSubscriptions, isSubscriptionOverdue } from "../lib/subscriptions";

export const Dashboard = () => {
  const [rollupCategories, setRollupCategories] = useState(true);
  const [hideBalances, setHideBalances] = useState(true);
  const { data: accounts = [], isLoading: isAccountsLoading } =
    useGetAccountsQuery();
  const { data: subscriptions = [] } = useGetSubscriptionsQuery();
  const {
    monthLabel,
    transactions,
    isLoading,
    hasBudgets,
    categoryMap,
    pieData,
    dailyData,
    warnings,
    remaining,
    totalSpent,
    totalBudget,
    funds,
  } = useDashboardData({ rollupCategories });
  const previousMonth = dayjs().subtract(1, "month").format("YYYY-MM");
  const {
    transactions: previousTransactions,
    totalSpent: previousTotalSpent,
    totalBudget: previousTotalBudget,
    budgets: previousBudgets,
  } = useDashboardData({ selectedMonth: previousMonth });
  const hasPreviousMonthData =
    previousTransactions.length > 0 ||
    previousTotalSpent > 0 ||
    previousTotalBudget > 0 ||
    previousBudgets.length > 0;
  const cashOnHand = accounts.reduce(
    (sum, account) => sum + (account.current_balance ?? 0),
    0
  );
  const { incomeTotal, expenseTotal } = useMemo(() => {
    const income = transactions
      .filter((tx) => tx.type === "income" && !tx.is_transfer)
      .reduce((sum, tx) => sum + tx.amount, 0);
    const expense = transactions
      .filter((tx) => tx.type === "expense" && !tx.is_transfer)
      .reduce((sum, tx) => sum + tx.amount, 0);
    return { incomeTotal: income, expenseTotal: expense };
  }, [transactions]);
  const avgDailySpend = useMemo(() => {
    const days = Math.max(1, Math.min(30, dayjs().date()));
    return expenseTotal / days;
  }, [expenseTotal]);
  const { recurringIncome, recurringExpense } = useMemo(() => {
    const income = transactions
      .filter((tx) => tx.is_recurring && tx.type === "income" && !tx.is_transfer)
      .reduce((sum, tx) => sum + tx.amount, 0);
    const expense = transactions
      .filter((tx) => tx.is_recurring && tx.type === "expense" && !tx.is_transfer)
      .reduce((sum, tx) => sum + tx.amount, 0);
    return { recurringIncome: income, recurringExpense: expense };
  }, [transactions]);
  const dueSoonSubscriptions = useMemo(
    () =>
      getUpcomingSubscriptions(subscriptions, 7).filter(
        (sub) => sub.status === "active" && !isSubscriptionOverdue(sub)
      ),
    [subscriptions]
  );
  const overdueSubscriptions = useMemo(
    () =>
      subscriptions.filter(
        (sub) =>
          sub.status === "active" &&
          sub.next_due &&
          isSubscriptionOverdue(sub)
      ),
    [subscriptions]
  );
  const attentionItems = useMemo<AttentionItem[]>(() => {
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

    if (overdueSubscriptions.length > 0) {
      items.push({
        id: "overdue-subscriptions",
        title: "Overdue subscriptions",
        description: `${overdueSubscriptions.length} payments are past due.`,
        badge: `${overdueSubscriptions.length} overdue`,
        tone: "red",
        action: { label: "Review subscriptions", to: "/subscriptions" },
      });
    } else if (dueSoonSubscriptions.length > 0) {
      items.push({
        id: "due-soon-subscriptions",
        title: "Subscriptions due soon",
        description: `${dueSoonSubscriptions.length} payments due within 7 days.`,
        badge: `${dueSoonSubscriptions.length} due`,
        tone: "yellow",
        action: { label: "Review subscriptions", to: "/subscriptions" },
      });
    } else if (subscriptions.length === 0) {
      items.push({
        id: "no-subscriptions",
        title: "No subscriptions tracked",
        description: "Add recurring bills to forecast renewals.",
        badge: "Subscriptions",
        tone: "blue",
        action: { label: "Add subscriptions", to: "/subscriptions" },
      });
    }

    if (!isLoading && transactions.length === 0) {
      items.push({
        id: "no-transactions",
        title: "No transactions this month",
        description: "Log expenses or import data to populate your dashboard.",
        badge: "Transactions",
        tone: "blue",
        action: { label: "Add transactions", to: "/transactions" },
      });
    }

    if (accounts.length === 0) {
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
    accounts.length,
    dueSoonSubscriptions.length,
    hasBudgets,
    isLoading,
    overdueSubscriptions.length,
    subscriptions.length,
    transactions.length,
    warnings.length,
  ]);
  return (
    <Stack gap="lg">
      <OverviewCards
        monthLabel={monthLabel}
        transactionCount={transactions.length}
        totalSpent={totalSpent}
        totalBudget={totalBudget}
        remaining={remaining}
        previousTransactionCount={previousTransactions.length}
        previousTotalSpent={previousTotalSpent}
        previousTotalBudget={previousTotalBudget}
        hasPreviousMonthData={hasPreviousMonthData}
      />

      <AttentionStrip items={attentionItems} />

      <Group align="stretch" grow wrap="wrap" gap="md">
        <AccountBalances
          accounts={accounts}
          hidden={hideBalances}
          onToggle={() => setHideBalances((prev) => !prev)}
          loading={isAccountsLoading}
          icon={hideBalances ? <Eye size={16} /> : <EyeOff size={16} />}
          style={{ flex: "1 1 320px" }}
        />
        <SoftCapAlerts
          warnings={warnings}
          hasBudgets={hasBudgets}
          style={{ flex: "1 1 320px" }}
        />
      </Group>

      <Group align="stretch" grow wrap="wrap" gap="md">
        <CoverageCard
          cashOnHand={cashOnHand}
          funds={funds}
          style={{ flex: "1 1 320px" }}
        />
        <NetCashflowCard
          income={incomeTotal}
          expense={expenseTotal}
          style={{ flex: "1 1 320px" }}
        />
        <ForecastCard
          cashOnHand={cashOnHand}
          avgDailySpend={avgDailySpend}
          recurringIncome={recurringIncome}
          recurringExpense={recurringExpense}
          style={{ flex: "1 1 320px" }}
        />
        <UpcomingSubscriptionsCard
          subscriptions={subscriptions}
          style={{ flex: "1 1 320px" }}
        />
      </Group>
      <Group justify="space-between" align="center" wrap="wrap" gap="xs">
        <Text size="sm" c="dimmed" maw={{ base: "100%", sm: "70%" }}>
          Charts show subcategories rolled into their parent when enabled.
        </Text>
        <Switch
          label="Roll up subcategories in charts"
          checked={rollupCategories}
          onChange={(event) => setRollupCategories(event.currentTarget.checked)}
        />
      </Group>

      <ChartsSection pieData={pieData} dailyData={dailyData} />

      <RecentActivityTable
        transactions={transactions}
        categoryMap={categoryMap}
        isLoading={isLoading}
      />
    </Stack>
  );
};
