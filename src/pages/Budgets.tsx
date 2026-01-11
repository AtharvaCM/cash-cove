import { Badge, Button, Group, Paper, Stack, Text, Title } from "@mantine/core";
import { MonthPickerInput } from "@mantine/dates";
import { Copy, Layers, Plus } from "lucide-react";
import { useMemo, useState } from "react";
import dayjs from "dayjs";
import {
  useGetBudgetsQuery,
  useGetCategoriesQuery,
  useUpsertBudgetsMutation,
} from "../features/api/apiSlice";
import { formatINR, formatMonthLabel } from "../lib/format";
import { DatatrixTable } from "../components/DatatrixTable";
import { BudgetDeleteModal } from "../components/budgets/BudgetDeleteModal";
import { BudgetFormModal } from "../components/budgets/BudgetFormModal";
import { BudgetBulkModal } from "../components/budgets/BudgetBulkModal";
import type { ColDef } from "ag-grid-community";
import type { Budget } from "../types/finance";

type BudgetRow = {
  id: string;
  category: string;
  amount: number;
};

export const Budgets = () => {
  const [month, setMonth] = useState(dayjs().format("YYYY-MM"));
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isBulkOpen, setIsBulkOpen] = useState(false);
  const [editingBudgetId, setEditingBudgetId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Budget | null>(null);
  const [copying, setCopying] = useState(false);

  const { data: categories = [] } = useGetCategoriesQuery();
  const { data: budgets = [], isLoading: isBudgetsLoading } =
    useGetBudgetsQuery(month);
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
  const rows = useMemo<BudgetRow[]>(
    () =>
      budgets.map((budget) => ({
        id: budget.id,
        category: categoryMap.get(budget.category_id ?? "") ?? "Overall",
        amount: budget.amount,
      })),
    [budgets, categoryMap]
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
    ],
    []
  );

  const selectedBudget = editingBudgetId
    ? budgetMap.get(editingBudgetId) ?? null
    : null;

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
