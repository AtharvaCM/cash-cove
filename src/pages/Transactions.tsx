import { Button, Group, Paper, Stack, Text, Title } from "@mantine/core";
import { MonthPickerInput } from "@mantine/dates";
import { Upload, Plus } from "lucide-react";
import { useMemo, useState } from "react";
import dayjs from "dayjs";
import {
  useGetAccountsQuery,
  useGetCategoriesQuery,
  useGetPaymentMethodsQuery,
  useGetTransactionsQuery,
} from "../features/api/apiSlice";
import { formatINR } from "../lib/format";
import { DatatrixTable } from "../components/DatatrixTable";
import { TransactionFormModal } from "../components/transactions/TransactionFormModal";
import { TransactionImportModal } from "../components/transactions/TransactionImportModal";
import { useSearchParams } from "react-router-dom";
import type { ColDef } from "ag-grid-community";
import type { Transaction } from "../types/finance";

export const Transactions = () => {
  const [month, setMonth] = useState(dayjs().format("YYYY-MM"));
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [editingTransactionId, setEditingTransactionId] = useState<
    string | null
  >(null);
  const [searchParams, setSearchParams] = useSearchParams();
  const actionParam = searchParams.get("action");
  const formVisible = isFormOpen || actionParam === "new";
  const importVisible = isImportOpen || actionParam === "import";

  const { data: categories = [] } = useGetCategoriesQuery();
  const { data: paymentMethods = [] } = useGetPaymentMethodsQuery();
  const { data: accounts = [] } = useGetAccountsQuery();
  const { data: transactions = [], isLoading: isTransactionsLoading } =
    useGetTransactionsQuery({ month });

  const categoryMap = useMemo(
    () => new Map(categories.map((category) => [category.id, category.name])),
    [categories]
  );
  const paymentMap = useMemo(
    () => new Map(paymentMethods.map((pm) => [pm.id, pm.name])),
    [paymentMethods]
  );
  const accountMap = useMemo(
    () => new Map(accounts.map((account) => [account.id, account.name])),
    [accounts]
  );

  const rows = useMemo(
    () =>
      transactions.map((tx) => ({
        id: tx.id,
        date: dayjs(tx.date).format("DD MMM"),
        category: categoryMap.get(tx.category_id ?? "") ?? "-",
        account: accountMap.get(tx.account_id ?? "") ?? "-",
        payment: paymentMap.get(tx.payment_method_id ?? "") ?? "-",
        notes: tx.notes?.trim() || "-",
        tags: tx.tags?.length ? tx.tags.map((tag) => tag.name).join(", ") : "-",
        amount: tx.amount,
        type: tx.type,
        flag: tx.is_transfer ? "Transfer" : "",
      })),
    [transactions, categoryMap, paymentMap, accountMap]
  );

  const columns = useMemo<ColDef<(typeof rows)[number]>[]>(
    () => [
      { headerName: "Date", field: "date", maxWidth: 120 },
      { headerName: "Category", field: "category", flex: 1.2 },
      { headerName: "Account", field: "account", flex: 1 },
      { headerName: "Payment", field: "payment", flex: 1 },
      {
        headerName: "Flag",
        field: "flag",
        maxWidth: 140,
        cellClass: "datatrix-cell-muted",
      },
      {
        headerName: "Notes",
        field: "notes",
        flex: 1.6,
        cellClass: "datatrix-cell-muted",
      },
      {
        headerName: "Tags",
        field: "tags",
        flex: 1.2,
        cellClass: "datatrix-cell-muted",
      },
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

  const selectedTransaction = useMemo<Transaction | null>(() => {
    if (!editingTransactionId) {
      return null;
    }
    return transactions.find((tx) => tx.id === editingTransactionId) ?? null;
  }, [transactions, editingTransactionId]);

  const clearActionParam = () => {
    if (!actionParam) {
      return;
    }
    const next = new URLSearchParams(searchParams);
    next.delete("action");
    setSearchParams(next, { replace: true });
  };

  const handleOpenCreate = () => {
    setEditingTransactionId(null);
    setIsFormOpen(true);
  };

  const handleEditTransaction = (id: string) => {
    setEditingTransactionId(id);
    setIsFormOpen(true);
  };

  const handleCloseForm = () => {
    setIsFormOpen(false);
    setEditingTransactionId(null);
    clearActionParam();
  };

  const handleCloseImport = () => {
    setIsImportOpen(false);
    clearActionParam();
  };

  const formKey = `${selectedTransaction?.id ?? "new"}-${
    formVisible ? "open" : "closed"
  }`;
  const importKey = `import-${importVisible ? "open" : "closed"}`;

  return (
    <Stack gap="lg">
      <TransactionFormModal
        key={formKey}
        opened={formVisible}
        onClose={handleCloseForm}
        transaction={selectedTransaction}
        categories={categories}
        paymentMethods={paymentMethods}
        accounts={accounts}
      />
      <TransactionImportModal
        key={importKey}
        opened={importVisible}
        onClose={handleCloseImport}
        categories={categories}
        paymentMethods={paymentMethods}
        accounts={accounts}
      />

      <Paper withBorder shadow="sm" radius="lg" p="md">
        <Group justify="space-between" align="center" mb="md" wrap="wrap">
          <Stack gap={2}>
            <Title order={4}>Transactions</Title>
            <Text size="sm" c="dimmed">
              {transactions.length} items
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
            <Button
              variant="light"
              onClick={() => setIsImportOpen(true)}
              leftSection={<Upload size={16} strokeWidth={2} />}
            >
              Import CSV
            </Button>
            <Button leftSection={<Plus size={16} strokeWidth={2} />} onClick={handleOpenCreate}>
              Add transaction
            </Button>
          </Group>
        </Group>
        <DatatrixTable
          rows={rows}
          columns={columns}
          height="max(420px, calc(100vh - 280px))"
          emptyLabel="No transactions yet. Add or import to get started."
          loading={isTransactionsLoading}
          getRowId={(row) => row.id}
          onRowClick={(row) => handleEditTransaction(row.id)}
        />
      </Paper>
    </Stack>
  );
};
