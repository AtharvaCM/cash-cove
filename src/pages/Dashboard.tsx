import { Button, Group, Paper, Stack, Switch, Text } from "@mantine/core";
import type { CSSProperties } from "react";
import { useEffect, useMemo, useState } from "react";
import dayjs from "dayjs";
import { Eye, EyeOff, SlidersHorizontal } from "lucide-react";
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
import {
  DashboardPinsModal,
  type DashboardPinOption,
} from "../components/dashboard/DashboardPinsModal";
import { useDashboardData } from "../hooks/useDashboardData";
import { useWeeklyCheckIn } from "../hooks/useWeeklyCheckIn";
import { useSetupChecklist } from "../hooks/useSetupChecklist";
import { useAttentionItems } from "../hooks/useAttentionItems";
import { useDashboardPins } from "../hooks/useDashboardPins";
import { useGetAccountsQuery, useGetSubscriptionsQuery } from "../features/api/apiSlice";
import { getUpcomingSubscriptions, isSubscriptionOverdue } from "../lib/subscriptions";

const PIN_OPTIONS: DashboardPinOption[] = [
  {
    id: "setup-checklist",
    label: "Setup checklist",
    description: "Finish the basics to unlock smarter insights. Shows until complete.",
  },
  {
    id: "weekly-checkin",
    label: "Weekly check-in",
    description: "Top insights and one action to try this week.",
  },
  {
    id: "attention",
    label: "Attention strip",
    description: "Overdue bills, budget warnings, and missing data.",
  },
  {
    id: "accounts",
    label: "Account balances",
    description: "Balances across bank, credit card, cash, and wallet.",
  },
  {
    id: "soft-cap",
    label: "Budget alerts",
    description: "Categories nearing or over budget.",
  },
  {
    id: "coverage",
    label: "Coverage",
    description: "Cash vs allocated funds coverage.",
  },
  {
    id: "net-cashflow",
    label: "Net cashflow",
    description: "This month's inflow vs outflow.",
  },
  {
    id: "forecast",
    label: "Forecast",
    description: "Runway and recurring impact.",
  },
  {
    id: "upcoming-subscriptions",
    label: "Upcoming renewals",
    description: "Bills due in the next 30 days.",
  },
];

const PIN_IDS = PIN_OPTIONS.map((option) => option.id);

export const Dashboard = () => {
  const [rollupCategories, setRollupCategories] = useState(() => {
    if (typeof window === "undefined") {
      return true;
    }
    try {
      const saved = window.localStorage.getItem(
        "cashcove:dashboard:rollupCategories"
      );
      if (saved === null) {
        return true;
      }
      return saved === "true";
    } catch {
      return true;
    }
  });
  const [pinsModalOpen, setPinsModalOpen] = useState(false);
  const [hideBalances, setHideBalances] = useState(() => {
    if (typeof window === "undefined") {
      return true;
    }
    try {
      const saved = window.localStorage.getItem(
        "cashcove:dashboard:hideBalances"
      );
      if (saved === null) {
        return true;
      }
      return saved === "true";
    } catch {
      return true;
    }
  });
  const { pinned, isPinned, togglePin, resetPins } = useDashboardPins({
    availableIds: PIN_IDS,
    defaultPins: PIN_IDS,
  });
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
  const showSetupChecklistCard =
    showSetupChecklist && isPinned("setup-checklist");
  const showWeeklyCheckInCard = isPinned("weekly-checkin");
  const showAttentionStrip = isPinned("attention");
  const showAccountBalances = isPinned("accounts");
  const showSoftCapAlerts = isPinned("soft-cap");
  const showCoverageCard = isPinned("coverage");
  const showNetCashflowCard = isPinned("net-cashflow");
  const showForecastCard = isPinned("forecast");
  const showUpcomingSubscriptionsCard = isPinned("upcoming-subscriptions");
  const showPriorityGroup = showSetupChecklistCard || showWeeklyCheckInCard;
  const showBalanceGroup = showAccountBalances || showSoftCapAlerts;
  const showPlanningGroup =
    showCoverageCard ||
    showNetCashflowCard ||
    showForecastCard ||
    showUpcomingSubscriptionsCard;
  const visiblePinnedCount = [
    showSetupChecklistCard,
    showWeeklyCheckInCard,
    showAttentionStrip,
    showAccountBalances,
    showSoftCapAlerts,
    showCoverageCard,
    showNetCashflowCard,
    showForecastCard,
    showUpcomingSubscriptionsCard,
  ].filter(Boolean).length;
  const hasPinnedSelections = pinned.length > 0;
  const sectionStyle = (delayMs: number): CSSProperties => ({
    "--dash-delay": `${delayMs}ms`,
  } as CSSProperties);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    try {
      window.localStorage.setItem(
        "cashcove:dashboard:rollupCategories",
        String(rollupCategories)
      );
    } catch {
      // Ignore storage errors (e.g., storage disabled).
    }
  }, [rollupCategories]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    try {
      window.localStorage.setItem(
        "cashcove:dashboard:hideBalances",
        String(hideBalances)
      );
    } catch {
      // Ignore storage errors (e.g., storage disabled).
    }
  }, [hideBalances]);
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

      <Group
        justify="space-between"
        align="center"
        wrap="wrap"
        gap="xs"
        className="dashboard-section"
        style={sectionStyle(20)}
      >
        <Stack gap={2}>
          <Text fw={600}>Pinned cards</Text>
          <Text size="sm" c="dimmed">
            Pick the cards you want to see first.
          </Text>
        </Stack>
        <Group gap="xs" align="center" wrap="wrap">
          <Text size="xs" c="dimmed">
            {pinned.length} of {PIN_OPTIONS.length} pinned
          </Text>
          <Button
            variant="light"
            size="xs"
            leftSection={<SlidersHorizontal size={14} />}
            onClick={() => setPinsModalOpen(true)}
          >
            Customize
          </Button>
        </Group>
      </Group>

      {visiblePinnedCount === 0 ? (
        <Paper
          withBorder
          shadow="sm"
          radius="lg"
          p="md"
          className="dashboard-section"
          style={sectionStyle(60)}
        >
          <Stack gap="xs">
            <Text fw={600}>
              {hasPinnedSelections ? "No pinned cards to show" : "No pinned cards yet"}
            </Text>
            <Text size="sm" c="dimmed">
              {hasPinnedSelections
                ? "Adjust your pins to bring a card back to the top of the dashboard."
                : "Choose the cards you want to see at the top of your dashboard."}
            </Text>
            <Button variant="light" size="xs" onClick={() => setPinsModalOpen(true)}>
              {hasPinnedSelections ? "Adjust pins" : "Choose cards"}
            </Button>
          </Stack>
        </Paper>
      ) : (
        <>
          {showPriorityGroup ? (
            <Group
              align="stretch"
              grow
              wrap="wrap"
              gap="md"
              className="dashboard-section"
              style={sectionStyle(40)}
            >
              {showSetupChecklistCard ? (
                <SetupChecklistCard
                  items={setupItems}
                  style={{ ...sectionStyle(80), flex: "1 1 320px" }}
                />
              ) : null}
              {showWeeklyCheckInCard ? (
                <WeeklyCheckInCard
                  insights={weeklyInsights}
                  nudge={weeklyNudge}
                  style={{ ...sectionStyle(120), flex: "1 1 320px" }}
                />
              ) : null}
            </Group>
          ) : null}

          {showAttentionStrip ? (
            <AttentionStrip items={attentionItems} style={sectionStyle(160)} />
          ) : null}

          {showBalanceGroup ? (
            <Group align="stretch" grow wrap="wrap" gap="md">
              {showAccountBalances ? (
                <AccountBalances
                  accounts={accounts}
                  hidden={hideBalances}
                  onToggle={() => setHideBalances((prev) => !prev)}
                  loading={isAccountsLoading}
                  icon={hideBalances ? <Eye size={16} /> : <EyeOff size={16} />}
                  style={{ flex: "1 1 320px" }}
                />
              ) : null}
              {showSoftCapAlerts ? (
                <SoftCapAlerts
                  warnings={warnings}
                  hasBudgets={hasBudgets}
                  style={{ flex: "1 1 320px" }}
                />
              ) : null}
            </Group>
          ) : null}

          {showPlanningGroup ? (
            <Group align="stretch" grow wrap="wrap" gap="md">
              {showCoverageCard ? (
                <CoverageCard
                  cashOnHand={cashOnHand}
                  funds={funds}
                  style={{ flex: "1 1 320px" }}
                />
              ) : null}
              {showNetCashflowCard ? (
                <NetCashflowCard
                  income={incomeTotal}
                  expense={expenseTotal}
                  style={{ flex: "1 1 320px" }}
                />
              ) : null}
              {showForecastCard ? (
                <ForecastCard
                  cashOnHand={cashOnHand}
                  avgDailySpend={avgDailySpend}
                  recurringIncome={recurringIncome}
                  recurringExpense={recurringExpense}
                  style={{ flex: "1 1 320px" }}
                />
              ) : null}
              {showUpcomingSubscriptionsCard ? (
                <UpcomingSubscriptionsCard
                  subscriptions={subscriptions}
                  style={{ flex: "1 1 320px" }}
                />
              ) : null}
            </Group>
          ) : null}
        </>
      )}
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
      <DashboardPinsModal
        opened={pinsModalOpen}
        onClose={() => setPinsModalOpen(false)}
        options={PIN_OPTIONS}
        pinnedIds={pinned}
        onToggle={togglePin}
        onReset={resetPins}
      />
    </Stack>
  );
};
