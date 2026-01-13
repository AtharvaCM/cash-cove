import { Group, Stack, Switch, Text } from "@mantine/core";
import { useMemo, useState } from "react";
import dayjs from "dayjs";
import { Eye, EyeOff } from "lucide-react";
import { ChartsSection } from "../components/dashboard/ChartsSection";
import { OverviewCards } from "../components/dashboard/OverviewCards";
import { WeeklyCheckInCard } from "../components/dashboard/WeeklyCheckInCard";
import { SetupChecklistCard } from "../components/dashboard/SetupChecklistCard";
import { AttentionStrip } from "../components/dashboard/AttentionStrip";
import { SoftCapAlerts } from "../components/dashboard/SoftCapAlerts";
import { RecentActivityTable } from "../components/dashboard/RecentActivityTable";
import { AccountBalances } from "../components/dashboard/AccountBalances";
import { CoverageCard } from "../components/dashboard/CoverageCard";
import { NetCashflowCard } from "../components/dashboard/NetCashflowCard";
import { ForecastCard } from "../components/dashboard/ForecastCard";
import { UpcomingSubscriptionsCard } from "../components/dashboard/UpcomingSubscriptionsCard";
import { useDashboardData } from "../hooks/useDashboardData";
import { useWeeklyCheckIn } from "../hooks/useWeeklyCheckIn";
import { useSetupChecklist } from "../hooks/useSetupChecklist";
import { useAttentionItems } from "../hooks/useAttentionItems";
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
    categories,
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
    categoryTotals,
    categoryBudgets,
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
  const dueSoonCount = useMemo(
    () =>
      getUpcomingSubscriptions(subscriptions, 7).filter(
        (sub) => sub.status === "active" && !isSubscriptionOverdue(sub)
      ).length,
    [subscriptions]
  );
  const overdueCount = useMemo(
    () =>
      subscriptions.filter(
        (sub) =>
          sub.status === "active" &&
          sub.next_due &&
          isSubscriptionOverdue(sub)
      ).length,
    [subscriptions]
  );
  const { insights: weeklyInsights, nudge: weeklyNudge } = useWeeklyCheckIn({
    transactionsCount: transactions.length,
    totalBudget,
    totalSpent,
    categoryTotals,
    categoryBudgets,
    categoryMap,
    avgDailySpend,
    incomeTotal,
    expenseTotal,
    hasBudgets,
    warnings,
    dueSoonSubscriptionsCount: dueSoonCount,
  });
  const { items: setupItems, showSetupChecklist } = useSetupChecklist({
    accountsCount: accounts.length,
    categoriesCount: categories.length,
    hasBudgets,
    subscriptionsCount: subscriptions.length,
  });
  const attentionItems = useAttentionItems({
    hasBudgets,
    warnings,
    overdueCount,
    dueSoonCount,
    subscriptionsCount: subscriptions.length,
    isLoading,
    transactionsCount: transactions.length,
    accountsCount: accounts.length,
  });
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

      <Group align="stretch" grow wrap="wrap" gap="md">
        {showSetupChecklist ? (
          <SetupChecklistCard
            items={setupItems}
            style={{ flex: "1 1 320px" }}
          />
        ) : null}
        <WeeklyCheckInCard
          insights={weeklyInsights}
          nudge={weeklyNudge}
          style={{ flex: "1 1 320px" }}
        />
      </Group>

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
