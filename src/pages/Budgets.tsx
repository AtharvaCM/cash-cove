import { Badge, Button, Group, Paper, Progress, SimpleGrid, Stack, Text, Title } from "@mantine/core";
import { Copy, Layers, Plus } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import dayjs from "dayjs";
import { useSearchParams } from "react-router-dom";
import {
  useGetBudgetsQuery,
  useGetCategoriesQuery,
  useUpsertBudgetsMutation,
  useGetTransactionsQuery,
} from "../features/api/apiSlice";
import { formatINR, formatMonthLabel } from "../lib/format";
import { DatatrixTable } from "../components/DatatrixTable";
import { BudgetDeleteModal } from "../components/budgets/BudgetDeleteModal";
import { BudgetFormModal } from "../components/budgets/BudgetFormModal";
import { BudgetBulkModal } from "../components/budgets/BudgetBulkModal";
import type { ColDef, ICellRendererParams } from "ag-grid-community";
import type { Budget } from "../types/finance";
import { useAppMonth } from "../context/AppMonthContext";

type BudgetRow = {
  id: string;
  category: string;
  amount: number;
  spend: number;
  remaining: number;
  ratio: number;
  status: "over" | "near" | "ok" | "none";
};

const BudgetAllocationCell = (params: ICellRendererParams<BudgetRow>) => {
  const spend = params.data?.spend ?? 0;
  const amount = params.data?.amount ?? 0;
  const remaining = params.data?.remaining ?? 0;
  const ratio = params.data?.ratio ?? 0;
  const status = params.data?.status ?? "ok";
  let color = "teal";
  let helper = "Within budget";
  if (amount === 0 && spend > 0) {
    color = "red";
    helper = "No budget set";
  } else if (status === "over") {
    color = "red";
    helper = "Over budget";
  } else if (status === "near") {
    color = "orange";
    helper = "Near limit";
  } else if (amount === 0) {
    color = "gray";
    helper = "No allocation";
  }

  const progressValue =
    amount > 0 ? Math.min(100, Math.round((ratio || 0) * 100)) : 0;
  return (
    <Stack gap="xs" style={{ width: "100%" }}>
      <SimpleGrid cols={3} spacing="lg">
        <Text size="xs" c="dimmed">
          Allocated
        </Text>
        <Text size="xs" c="dimmed">
          Spent
        </Text>
        <Text size="xs" c="dimmed" ta="right">
          Remaining
        </Text>
      </SimpleGrid>
      <SimpleGrid cols={3} spacing="lg">
        <Text size="sm" fw={600}>
          {formatINR(amount)}
        </Text>
        <Text size="sm" fw={600}>
          {formatINR(spend)}
        </Text>
        <Text size="sm" fw={600} c={remaining < 0 ? "red.6" : "dimmed"} ta="right">
          {formatINR(remaining)}
        </Text>
      </SimpleGrid>
      <Group justify="space-between" align="center" wrap="nowrap" gap="sm">
        <Progress
          value={progressValue}
          color={color}
          size="sm"
          radius="xl"
          style={{ flex: 1 }}
        />
      </Group>
      <Text size="xs" c="dimmed">
        {helper}
      </Text>
    </Stack>
  );
};

export const Budgets = () => {
  const { month } = useAppMonth();
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isBulkOpen, setIsBulkOpen] = useState(false);
  const [editingBudgetId, setEditingBudgetId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Budget | null>(null);
  const [copying, setCopying] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();

  const { data: categories = [] } = useGetCategoriesQuery();
  const { data: budgets = [], isLoading: isBudgetsLoading } =
    useGetBudgetsQuery(month);
  const { data: transactions = [] } = useGetTransactionsQuery({ month });
  const prevMonth = dayjs(month + "-01").subtract(1, "month").format("YYYY-MM");
  const { data: prevBudgets = [] } = useGetBudgetsQuery(prevMonth);
  const [upsertBudgets] = useUpsertBudgetsMutation();

  const categoryMap = useMemo(
    () => new Map(categories.map((category) => [category.id, category.name])),
    [categories]
  );
  const budgetMap = useMemo(
    () => new Map(budgets.map((budget) => [budget.id, budget])),
    [budgets]
  );
  const takenCategoryIds = useMemo(
    () =>
      new Set(
        budgets
          .filter((budget) => budget.category_id)
          .map((budget) => budget.category_id as string)
      ),
    [budgets]
  );
  const hasOverallBudget = useMemo(
    () => budgets.some((budget) => !budget.category_id),
    [budgets]
  );

  const total = useMemo(
    () => budgets.reduce((sum, budget) => sum + budget.amount, 0),
    [budgets]
  );
  const spendMap = useMemo(() => {
    const map = new Map<string, number>();
    let overall = 0;
    transactions
      .filter((tx) => tx.type === "expense" && !tx.is_transfer)
      .forEach((tx) => {
        const key = tx.category_id ?? "overall";
        map.set(key, (map.get(key) ?? 0) + tx.amount);
        overall += tx.amount;
      });
    map.set("overall", overall);
    return map;
  }, [transactions]);
  const rows = useMemo<BudgetRow[]>(
    () =>
      budgets.map((budget) => ({
        id: budget.id,
        category: categoryMap.get(budget.category_id ?? "") ?? "Overall",
        amount: budget.amount,
        spend:
          budget.category_id === null
            ? spendMap.get("overall") ?? 0
            : spendMap.get(budget.category_id) ?? 0,
        remaining:
          budget.amount -
          (budget.category_id === null
            ? spendMap.get("overall") ?? 0
            : spendMap.get(budget.category_id) ?? 0),
        ratio: (() => {
          const spend =
            budget.category_id === null
              ? spendMap.get("overall") ?? 0
              : spendMap.get(budget.category_id) ?? 0;
          if (budget.amount === 0) {
            return spend > 0 ? 1 : 0;
          }
          return spend / budget.amount;
        })(),
        status: (() => {
          const spend =
            budget.category_id === null
              ? spendMap.get("overall") ?? 0
              : spendMap.get(budget.category_id) ?? 0;
          if (budget.amount === 0) {
            return spend > 0 ? "over" : "ok";
          }
          const ratio = spend / budget.amount;
          if (ratio > 1) return "over";
          if (ratio >= 0.85) return "near";
          return "ok";
        })(),
      })),
    [budgets, categoryMap, spendMap]
  );

  const columns = useMemo<ColDef<BudgetRow>[]>(
    () => [
      { headerName: "Category", field: "category", flex: 1.2 },
      {
        headerName: "Allocation",
        field: "amount",
        flex: 2,
        cellRenderer: BudgetAllocationCell,
        cellClass: "datatrix-cell-top datatrix-cell-wrap",
      },
    ],
    []
  );

  const selectedBudget = editingBudgetId
    ? budgetMap.get(editingBudgetId) ?? null
    : null;

  useEffect(() => {
    const action = searchParams.get("action");
    if (!action) {
      return;
    }
    if (action === "new") {
      setEditingBudgetId(null);
      setIsFormOpen(true);
    } else if (action === "bulk") {
      setIsBulkOpen(true);
    }
    const next = new URLSearchParams(searchParams);
    next.delete("action");
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams]);

  const handleOpenCreate = () => {
    setEditingBudgetId(null);
    setIsFormOpen(true);
  };

  const handleCloseForm = () => {
    setIsFormOpen(false);
    setEditingBudgetId(null);
  };

  const handleEditBudget = (id: string) => {
    setEditingBudgetId(id);
    setIsFormOpen(true);
  };

  const handleRequestDelete = () => {
    if (!selectedBudget) {
      return;
    }
    setDeleteTarget(selectedBudget);
    setIsFormOpen(false);
    setEditingBudgetId(null);
  };

  const deleteCategoryName = deleteTarget?.category_id
    ? categoryMap.get(deleteTarget.category_id) ?? "this category"
    : "Overall";

  const handleCopyPrevMonth = async () => {
    if (copying) return;
    setCopying(true);
    try {
      const existingKeys = new Set(
        budgets.map((b) => `${b.category_id ?? "overall"}`)
      );
      const items = prevBudgets
        .filter((b) => !existingKeys.has(`${b.category_id ?? "overall"}`))
        .map((b) => ({
          category_id: b.category_id,
          amount: b.amount,
        }));
      if (items.length === 0) {
        setCopying(false);
        return;
      }
      await upsertBudgets({ month, items }).unwrap();
    } finally {
      setCopying(false);
    }
  };

  const formKey = `${selectedBudget?.id ?? "new"}-${
    isFormOpen ? "open" : "closed"
  }`;
  const deleteKey = `delete-${deleteTarget?.id ?? "none"}-${
    deleteTarget ? "open" : "closed"
  }`;

  return (
    <Stack gap="lg">
      <BudgetFormModal
        key={formKey}
        opened={isFormOpen}
        onClose={handleCloseForm}
        month={month}
        categories={categories}
        budget={selectedBudget}
        takenCategoryIds={takenCategoryIds}
        hasOverallBudget={hasOverallBudget}
        onRequestDelete={handleRequestDelete}
      />
      <BudgetDeleteModal
        key={deleteKey}
        opened={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        budget={deleteTarget}
        categoryName={deleteCategoryName}
      />
      <BudgetBulkModal
        opened={isBulkOpen}
        onClose={() => setIsBulkOpen(false)}
        month={month}
        categories={categories}
        budgets={budgets}
      />

      <Paper withBorder shadow="sm" radius="lg" p="md">
        <Group justify="space-between" align="center" mb="md" wrap="wrap">
          <Stack gap={2}>
            <Title order={4}>{formatMonthLabel(month)}</Title>
            <Text size="sm" c="dimmed">
              Total planned: {formatINR(total)}
            </Text>
            <Text size="xs" c="dimmed">
              Click a row to edit or delete.
            </Text>
          </Stack>
          <Group gap="sm" align="flex-end" wrap="wrap">
            <Badge variant="light" color="blue">
              Budget alerts (80%)
            </Badge>
            <Button
              variant="light"
              onClick={handleCopyPrevMonth}
              disabled={copying || prevBudgets.length === 0}
              leftSection={<Copy size={16} strokeWidth={2} />}
            >
              Copy last month
            </Button>
            <Button
              variant="light"
              onClick={() => setIsBulkOpen(true)}
              leftSection={<Layers size={16} strokeWidth={2} />}
            >
              Bulk add
            </Button>
            <Button leftSection={<Plus size={16} strokeWidth={2} />} onClick={handleOpenCreate}>
              Set budget
            </Button>
          </Group>
        </Group>
        <DatatrixTable
          rows={rows}
          columns={columns}
          emptyLabel="No budgets set for this month."
          loading={isBudgetsLoading}
          getRowId={(row) => row.id}
          onRowClick={(row) => handleEditBudget(row.id)}
          rowHeight={96}
        />
      </Paper>
    </Stack>
  );
};
