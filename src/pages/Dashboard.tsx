import { Group, Stack, Switch, Text } from "@mantine/core";
import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { ChartsSection } from "../components/dashboard/ChartsSection";
import { OverviewCards } from "../components/dashboard/OverviewCards";
import { SoftCapAlerts } from "../components/dashboard/SoftCapAlerts";
import { RecentActivityTable } from "../components/dashboard/RecentActivityTable";
import { AccountBalances } from "../components/dashboard/AccountBalances";
import { useDashboardData } from "../hooks/useDashboardData";
import { useGetAccountsQuery } from "../features/api/apiSlice";

export const Dashboard = () => {
  const [rollupCategories, setRollupCategories] = useState(true);
  const [hideBalances, setHideBalances] = useState(true);
  const { data: accounts = [], isLoading: isAccountsLoading } = useGetAccountsQuery();
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

      <AccountBalances
        accounts={accounts}
        hidden={hideBalances}
        onToggle={() => setHideBalances((prev) => !prev)}
        loading={isAccountsLoading}
        icon={hideBalances ? <Eye size={16} /> : <EyeOff size={16} />}
      />

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

      <SoftCapAlerts warnings={warnings} hasBudgets={hasBudgets} />

      <RecentActivityTable
        transactions={transactions}
        categoryMap={categoryMap}
        isLoading={isLoading}
      />
    </Stack>
  );
};
