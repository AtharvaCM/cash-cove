import { Group, Stack, Switch, Text } from "@mantine/core";
import { useState } from "react";
import { ChartsSection } from "../components/dashboard/ChartsSection";
import { OverviewCards } from "../components/dashboard/OverviewCards";
import { SoftCapAlerts } from "../components/dashboard/SoftCapAlerts";
import { RecentActivityTable } from "../components/dashboard/RecentActivityTable";
import { useDashboardData } from "../hooks/useDashboardData";

export const Dashboard = () => {
  const [rollupCategories, setRollupCategories] = useState(true);
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
  } = useDashboardData({ rollupCategories });
  return (
    <Stack gap="lg">
      <OverviewCards
        monthLabel={monthLabel}
        transactionCount={transactions.length}
        totalSpent={totalSpent}
        totalBudget={totalBudget}
        remaining={remaining}
      />

      <Group justify="space-between" align="center">
        <Text size="sm" c="dimmed">
          Charts show subcategories rolled into their parent when enabled.
        </Text>
        <Switch
          label="Roll up subcategories in charts"
          checked={rollupCategories}
          onChange={(event) => setRollupCategories(event.currentTarget.checked)}
        />
      </Group>

      <ChartsSection pieData={pieData} dailyData={dailyData} />

      <SoftCapAlerts warnings={warnings} hasBudgets={hasBudgets} />

      <RecentActivityTable
        transactions={transactions}
        categoryMap={categoryMap}
        isLoading={isLoading}
      />
    </Stack>
  );
};
