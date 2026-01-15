import {
  Badge,
  Divider,
  Drawer,
  Group,
  Stack,
  Text,
} from "@mantine/core";
import dayjs from "dayjs";
import {
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useMemo } from "react";
import {
  useGetCategoriesQuery,
  useGetReconciliationsQuery,
  useGetTransactionsByRangeQuery,
} from "../../features/api/apiSlice";
import type { Account } from "../../types/finance";
import { formatINR } from "../../lib/format";

type AccountDetailsDrawerProps = {
  opened: boolean;
  onClose: () => void;
  account: Account | null;
};

export const AccountDetailsDrawer = ({
  opened,
  onClose,
  account,
}: AccountDetailsDrawerProps) => {
  const accountId = account?.id ?? null;
  const { data: categories = [] } = useGetCategoriesQuery(undefined, {
    skip: !opened,
  });
  const { data: reconciliations = [] } = useGetReconciliationsQuery(
    { accountId: accountId ?? undefined },
    { skip: !accountId }
  );
  const recentRange = useMemo(
    () => ({
      start: dayjs().subtract(90, "day").format("YYYY-MM-DD"),
      end: dayjs().format("YYYY-MM-DD"),
    }),
    []
  );
  const { data: recentTransactions = [] } = useGetTransactionsByRangeQuery(
    recentRange,
    { skip: !accountId }
  );

  const categoryMap = new Map(
    categories.map((category) => [category.id, category.name])
  );

  const latestReconciliation = reconciliations[0] ?? null;
  const balanceHistory = [...reconciliations]
    .sort((a, b) => dayjs(a.statement_date).diff(dayjs(b.statement_date)))
    .map((item) => ({
      date: dayjs(item.statement_date).format("DD MMM"),
      value: item.statement_balance,
    }));

  const recentAccountTransactions = accountId
    ? recentTransactions
        .filter((tx) => tx.account_id === accountId)
        .slice(0, 6)
    : [];

  return (
    <Drawer
      opened={opened}
      onClose={onClose}
      title="Account details"
      position="right"
      size="md"
    >
      {account ? (
        <Stack gap="md">
          <Group justify="space-between" align="flex-start">
            <Stack gap={2}>
              <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
                Account
              </Text>
              <Text fw={600}>{account.name}</Text>
            </Stack>
            <Badge variant="light" color="blue" radius="sm">
              {account.type === "card" ? "Credit card" : account.type}
            </Badge>
          </Group>

          <Divider />

          <Group justify="space-between" align="center">
            <Text size="sm" c="dimmed">
              Current balance
            </Text>
            <Text fw={600}>{formatINR(account.current_balance ?? 0)}</Text>
          </Group>

          <Divider />

          <Stack gap="xs">
            <Text size="sm" fw={600}>
              Last reconciliation
            </Text>
            {latestReconciliation ? (
              <Group justify="space-between" align="center">
                <Text size="sm">
                  {dayjs(latestReconciliation.statement_date).format(
                    "DD MMM YYYY"
                  )}
                </Text>
                <Group gap="xs">
                  <Text size="sm" fw={600}>
                    {formatINR(latestReconciliation.statement_balance)}
                  </Text>
                  {latestReconciliation.adjusted ? (
                    <Badge size="xs" variant="light" color="orange">
                      Adjusted
                    </Badge>
                  ) : null}
                </Group>
              </Group>
            ) : (
              <Text size="sm" c="dimmed">
                No reconciliations yet.
              </Text>
            )}
          </Stack>

          <Stack gap="xs">
            <Group justify="space-between" align="center">
              <Text size="sm" fw={600}>
                Balance history
              </Text>
              <Text size="xs" c="dimmed">
                From reconciliations
              </Text>
            </Group>
            {balanceHistory.length > 1 ? (
              <div style={{ width: "100%", height: 160 }}>
                <ResponsiveContainer>
                  <LineChart data={balanceHistory}>
                    <XAxis dataKey="date" tickMargin={8} />
                    <YAxis
                      tickFormatter={(value) => formatINR(Number(value))}
                      width={70}
                    />
                    <RechartsTooltip
                      formatter={(value) => formatINR(Number(value))}
                    />
                    <Line
                      type="monotone"
                      dataKey="value"
                      stroke="#2563eb"
                      strokeWidth={2}
                      dot={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <Text size="sm" c="dimmed">
                Add at least two reconciliations to see history.
              </Text>
            )}
          </Stack>

          <Stack gap="xs">
            <Group justify="space-between" align="center">
              <Text size="sm" fw={600}>
                Recent transactions
              </Text>
              <Text size="xs" c="dimmed">
                Last 90 days
              </Text>
            </Group>
            {recentAccountTransactions.length > 0 ? (
              <Stack gap="sm">
                {recentAccountTransactions.map((tx) => {
                  const categoryLabel = tx.category_id
                    ? categoryMap.get(tx.category_id) ?? "Uncategorized"
                    : "Uncategorized";
                  const sign = tx.type === "expense" ? "-" : "+";
                  const amountLabel = tx.is_transfer
                    ? formatINR(tx.amount)
                    : `${sign}${formatINR(tx.amount)}`;
                  return (
                    <Group key={tx.id} justify="space-between" align="center">
                      <Stack gap={2}>
                        <Text size="sm" fw={600}>
                          {categoryLabel}
                        </Text>
                        <Text size="xs" c="dimmed">
                          {dayjs(tx.date).format("DD MMM")} ·{" "}
                          {tx.notes ?? "No notes"}
                        </Text>
                      </Stack>
                      <Stack gap={4} align="flex-end">
                        <Text size="sm" fw={600}>
                          {amountLabel}
                        </Text>
                        {tx.is_transfer ? (
                          <Badge size="xs" variant="light" color="gray">
                            Transfer
                          </Badge>
                        ) : (
                          <Badge
                            size="xs"
                            variant="light"
                            color={tx.type === "income" ? "teal" : "red"}
                          >
                            {tx.type === "income" ? "Income" : "Expense"}
                          </Badge>
                        )}
                      </Stack>
                    </Group>
                  );
                })}
              </Stack>
            ) : (
              <Text size="sm" c="dimmed">
                No recent transactions for this account.
              </Text>
            )}
          </Stack>
        </Stack>
      ) : (
        <Text size="sm" c="dimmed">
          Select an account to see details.
        </Text>
      )}
    </Drawer>
  );
};
