import { Badge, Button, Group, Paper, Stack, Text, Title } from "@mantine/core";
import { MonthPickerInput } from "@mantine/dates";
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

type BudgetRow = {
  id: string;
  category: string;
  amount: number;
  spend: number;
  status: "over" | "near" | "ok" | "none";
};

const BudgetSpendCell = (params: ICellRendererParams<BudgetRow>) => {
  const spend = Number(params.value ?? 0);
  const amount = params.data?.amount ?? 0;
  const status = params.data?.status ?? "ok";
  let color = "#2f9e44";
  let label = "Within budget";

  if (amount === 0 && spend > 0) {
    color = "#e03131";
    label = "No budget";
  } else if (status === "over") {
    color = "#e03131";
    label = "Over budget";
  } else if (status === "near") {
    color = "#f08c00";
    label = "Near limit";
  }

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
      }}
      title={label}
    >
      <span
        style={{
          display: "inline-flex",
          width: 10,
          height: 10,
          borderRadius: "999px",
          background: color,
          flexShrink: 0,
        }}
      />
      <span>{formatINR(spend)}</span>
    </div>
  );
};

export const Budgets = () => {
  const [month, setMonth] = useState(dayjs().format("YYYY-MM"));
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
      { headerName: "Category", field: "category", flex: 1.4 },
      {
        headerName: "Budget",
        field: "amount",
        maxWidth: 180,
        valueFormatter: (params) => formatINR(Number(params.value ?? 0)),
      },
      {
        headerName: "Spent",
        field: "spend",
        maxWidth: 200,
        cellRenderer: BudgetSpendCell,
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
            <MonthPickerInput
              label="Month"
              value={dayjs(month + "-01").toDate()}
              onChange={(value) => value && setMonth(dayjs(value).format("YYYY-MM"))}
              maxDate={dayjs().endOf("month").toDate()}
              size="xs"
              clearable={false}
              styles={{ input: { width: 160 } }}
            />
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
        />
      </Paper>
    </Stack>
  );
};
