import { Badge, Paper, Stack, Text, Title } from "@mantine/core";
import { useMemo } from "react";
import dayjs from "dayjs";
import type { ColDef } from "ag-grid-community";
import { DatatrixTable } from "../DatatrixTable";
import { formatINR } from "../../lib/format";
import type { Transaction } from "../../types/finance";
import { getDisplayCategoryId } from "../../lib/transactions";

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
  isTransfer: boolean;
  isReimbursement: boolean;
};

const RecentTypeCell = (params: { data?: RecentRow }) => {
  const isTransfer = params.data?.isTransfer;
  const isReimbursement = params.data?.isReimbursement;
  const type = params.data?.type ?? "expense";
  if (isTransfer) {
    return (
      <Badge variant="light" color="gray" radius="sm">
        Transfer
      </Badge>
    );
  }
  if (isReimbursement) {
    return (
      <Badge variant="light" color="blue" radius="sm">
        Reimbursement
      </Badge>
    );
  }
  return (
    <Badge variant="light" color={type === "income" ? "teal" : "red"} radius="sm">
      {type === "income" ? "Income" : "Expense"}
    </Badge>
  );
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
        category: (() => {
          const displayCategoryId = getDisplayCategoryId(tx);
          if (!displayCategoryId) {
            return "-";
          }
          return categoryMap.get(displayCategoryId) ?? "-";
        })(),
        notes: tx.notes ?? "-",
        amount: tx.amount,
        type: tx.type,
        isTransfer: Boolean(tx.is_transfer),
        isReimbursement: Boolean(tx.is_reimbursement),
      })),
    [transactions, categoryMap]
  );

  const recentColumns = useMemo<ColDef<RecentRow>[]>(
    () => [
      { headerName: "Date", field: "date", maxWidth: 120 },
      { headerName: "Category", field: "category", flex: 1.2 },
      {
        headerName: "Type",
        field: "type",
        maxWidth: 140,
        cellRenderer: RecentTypeCell,
      },
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
