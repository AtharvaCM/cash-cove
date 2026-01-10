import {
  Alert,
  Button,
  Group,
  Modal,
  ScrollArea,
  Stack,
  Table,
  Text,
  TextInput,
} from "@mantine/core";
import { useMemo, useState } from "react";
import { formatMonthLabel } from "../../lib/format";
import type { Budget, Category } from "../../types/finance";
import { useUpsertBudgetsMutation } from "../../features/api/apiSlice";

type BudgetBulkModalProps = {
  opened: boolean;
  onClose: () => void;
  month: string;
  categories: Category[];
  budgets: Budget[];
};

export const BudgetBulkModal = ({
  opened,
  onClose,
  month,
  categories,
  budgets,
}: BudgetBulkModalProps) => {
  const [amounts, setAmounts] = useState<Record<string, string>>({});
  const [overallAmount, setOverallAmount] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [upsertBudgets, { isLoading }] = useUpsertBudgetsMutation();

  const takenCategoryIds = useMemo(
    () =>
      new Set(budgets.filter((b) => b.category_id).map((b) => b.category_id!)),
    [budgets]
  );
  const hasOverallBudget = useMemo(
    () => budgets.some((b) => !b.category_id),
    [budgets]
  );

  const availableCategories = useMemo(
    () => categories.filter((cat) => !takenCategoryIds.has(cat.id)),
    [categories, takenCategoryIds]
  );

  const handleChangeAmount = (categoryId: string, value: string) => {
    setAmounts((prev) => ({ ...prev, [categoryId]: value }));
  };

  const handleSubmit = async () => {
    setError(null);
    const entries: Array<{ category_id: string | null; amount: number }> = [];

    if (!hasOverallBudget) {
      const overall = Number.parseFloat(overallAmount);
      if (!Number.isNaN(overall) && overall > 0) {
        entries.push({ category_id: null, amount: overall });
      }
    }

    availableCategories.forEach((cat) => {
      const value = amounts[cat.id];
      if (!value) {
        return;
      }
      const parsed = Number.parseFloat(value);
      if (!Number.isNaN(parsed) && parsed > 0) {
        entries.push({ category_id: cat.id, amount: parsed });
      }
    });

    if (entries.length === 0) {
      setError("Enter at least one budget amount.");
      return;
    }

    try {
      await upsertBudgets({ month, items: entries }).unwrap();
      setAmounts({});
      setOverallAmount("");
      onClose();
    } catch {
      setError("Unable to save budgets. Please try again.");
    }
  };

  return (
    <Modal opened={opened} onClose={onClose} title="Bulk add budgets" size="lg">
      <Stack gap="sm">
        <Text size="sm" c="dimmed">
          Month: {formatMonthLabel(month)}
        </Text>
        {hasOverallBudget ? (
          <Text size="xs" c="dimmed">
            Overall budget already set. Add category amounts below.
          </Text>
        ) : (
          <TextInput
            label="Overall budget"
            placeholder="0"
            type="number"
            value={overallAmount}
            onChange={(event) => setOverallAmount(event.target.value)}
            min="0"
            step="0.01"
          />
        )}

        <ScrollArea h={320}>
          <Table highlightOnHover verticalSpacing="sm" horizontalSpacing="md">
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Category</Table.Th>
                <Table.Th style={{ width: 160 }}>Amount</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {availableCategories.map((category) => (
                <Table.Tr key={category.id}>
                  <Table.Td>{category.name}</Table.Td>
                  <Table.Td>
                    <TextInput
                      type="number"
                      placeholder="0"
                      value={amounts[category.id] ?? ""}
                      onChange={(event) =>
                        handleChangeAmount(category.id, event.target.value)
                      }
                      min="0"
                      step="0.01"
                      size="sm"
                    />
                  </Table.Td>
                </Table.Tr>
              ))}
              {availableCategories.length === 0 ? (
                <Table.Tr>
                  <Table.Td colSpan={2}>
                    <Text size="sm" c="dimmed">
                      All categories already have a budget for this month.
                    </Text>
                  </Table.Td>
                </Table.Tr>
              ) : null}
            </Table.Tbody>
          </Table>
        </ScrollArea>

        {error ? (
          <Alert color="red" variant="light">
            {error}
          </Alert>
        ) : null}
        <Group justify="flex-end">
          <Button variant="subtle" color="gray" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} loading={isLoading} color="green">
            Save budgets
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
};
