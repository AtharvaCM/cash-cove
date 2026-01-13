import { Paper, Stack, Text, Title } from "@mantine/core";
import { useMemo } from "react";
import dayjs from "dayjs";
import type { ColDef } from "ag-grid-community";
import { DatatrixTable } from "../DatatrixTable";
import { formatINR } from "../../lib/format";
import type { Transaction } from "../../types/finance";

type RecentActivityTableProps = {
  transactions: Transaction[];
  categoryMap: Map<string, string>;
  isLoading: boolean;
};

type RecentRow = {
  id: string;
  date: string;
  category: string;
  notes: string;
  amount: number;
  type: "expense" | "income";
};

export const RecentActivityTable = ({
  transactions,
  categoryMap,
  isLoading,
}: RecentActivityTableProps) => {
  const recentRows = useMemo<RecentRow[]>(
    () =>
      transactions.slice(0, 6).map((tx) => ({
        id: tx.id,
        date: dayjs(tx.date).format("DD MMM"),
        category: categoryMap.get(tx.category_id ?? "") ?? "-",
        notes: tx.notes ?? "-",
        amount: tx.amount,
        type: tx.type,
      })),
    [transactions, categoryMap]
  );

  const recentColumns = useMemo<ColDef<RecentRow>[]>(
    () => [
      { headerName: "Date", field: "date", maxWidth: 120 },
      { headerName: "Category", field: "category", flex: 1.2 },
      { headerName: "Notes", field: "notes", flex: 1.4 },
      {
        headerName: "Amount",
        field: "amount",
        maxWidth: 160,
        valueFormatter: (params) => {
          const raw = Number(params.value ?? 0);
          const sign = params.data?.type === "expense" ? "-" : "+";
          return `${sign}${formatINR(raw)}`;
        },
        cellClass: (params) =>
          params.data?.type === "expense"
            ? "datatrix-cell-negative"
            : "datatrix-cell-positive",
      },
    ],
    []
  );

  return (
    <Paper withBorder shadow="sm" radius="lg" p="md">
      <Stack gap="xs" mb="sm">
        <Title order={4}>Recent activity</Title>
        <Text size="sm" c="dimmed">
          {isLoading ? "Loading" : "Latest transactions this month"}
        </Text>
      </Stack>
      <DatatrixTable
        rows={recentRows}
        columns={recentColumns}
        height={recentRows.length > 0 ? 320 : undefined}
        emptyLabel="No transactions yet. Add or import to get started."
        loading={isLoading}
      />
    </Paper>
  );
};
