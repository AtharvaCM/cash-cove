import {
  Badge,
  Button,
  Group,
  Modal,
  Paper,
  Popover,
  SimpleGrid,
  Switch,
  Select,
  Stack,
  Text,
  TextInput,
  Title,
} from "@mantine/core";
import { DateInput } from "@mantine/dates";
import { useMediaQuery } from "@mantine/hooks";
import { Plus, Save, Trash2, Upload } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import dayjs from "dayjs";
import {
  useGetAccountsQuery,
  useGetCategoriesQuery,
  useGetPaymentMethodsQuery,
  useGetTagsQuery,
  useGetTransactionsQuery,
  useUpdateTransactionMutation,
} from "../features/api/apiSlice";
import { formatINR } from "../lib/format";
import { DatatrixTable } from "../components/DatatrixTable";
import { TransactionFormModal } from "../components/transactions/TransactionFormModal";
import { TransactionImportModal } from "../components/transactions/TransactionImportModal";
import { useSearchParams } from "react-router-dom";
import type { ColDef, GridApi, ICellRendererParams } from "ag-grid-community";
import type { Transaction } from "../types/finance";
import { ActiveFilterChips, type ActiveFilterChip } from "../components/filters/ActiveFilterChips";
import { loadSavedFilters, saveSavedFilters, type SavedFilter } from "../lib/savedFilters";
import { useAppSelector } from "../app/hooks";
import { useAppMonth } from "../context/AppMonthContext";

type TransactionRow = {
  id: string;
  date: string;
  category: string;
  account: string;
  payment: string;
  notes: string;
  tags: string;
  amount: number;
  type: Transaction["type"];
  isTransfer: boolean;
};

const TransactionTypeCell = (params: ICellRendererParams<TransactionRow>) => {
  const isTransfer = params.data?.isTransfer;
  const type = params.data?.type ?? "expense";
  if (isTransfer) {
    return (
      <Badge variant="light" color="gray" radius="sm">
        Transfer
      </Badge>
    );
  }
  return (
    <Badge
      variant="light"
      color={type === "income" ? "teal" : "red"}
      radius="sm"
    >
      {type === "income" ? "Income" : "Expense"}
    </Badge>
  );
};

type TransactionFilters = {
  search: string;
  accountId: string;
  tag: string;
  dateFrom: string;
  dateTo: string;
  minAmount: string;
  maxAmount: string;
};

const buildFiltersKey = (userId?: string | null) =>
  `cashcove:filters:transactions:${userId ?? "anon"}`;

export const Transactions = () => {
  const userId = useAppSelector((state) => state.auth.user?.id ?? null);
  const { month } = useAppMonth();
  const isMobile = useMediaQuery("(max-width: 900px)");
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [editingTransactionId, setEditingTransactionId] = useState<
    string | null
  >(null);
  const [search, setSearch] = useState("");
  const [filterAccount, setFilterAccount] = useState("");
  const [filterTag, setFilterTag] = useState("");
  const [filterFrom, setFilterFrom] = useState("");
  const [filterTo, setFilterTo] = useState("");
  const [minAmount, setMinAmount] = useState("");
  const [maxAmount, setMaxAmount] = useState("");
  const [saveModalOpen, setSaveModalOpen] = useState(false);
  const [saveName, setSaveName] = useState("");
  const [selectedSavedId, setSelectedSavedId] = useState<string | null>(null);
  const [savedPopoverOpen, setSavedPopoverOpen] = useState(false);
  const [savedFilters, setSavedFilters] = useState<
    SavedFilter<TransactionFilters>[]
  >(() => loadSavedFilters(buildFiltersKey(userId)));
  const [selectedRows, setSelectedRows] = useState<TransactionRow[]>([]);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkCategoryEnabled, setBulkCategoryEnabled] = useState(false);
  const [bulkCategoryId, setBulkCategoryId] = useState<string | null>(null);
  const [bulkAccountEnabled, setBulkAccountEnabled] = useState(false);
  const [bulkAccountId, setBulkAccountId] = useState<string | null>(null);
  const [bulkTagsEnabled, setBulkTagsEnabled] = useState(false);
  const [bulkTags, setBulkTags] = useState("");
  const [bulkError, setBulkError] = useState<string | null>(null);
  const [bulkSaving, setBulkSaving] = useState(false);
  const gridApiRef = useRef<GridApi<TransactionRow> | null>(null);
  const [searchParams, setSearchParams] = useSearchParams();
  const actionParam = searchParams.get("action");
  const formVisible = isFormOpen || actionParam === "new";
  const importVisible = isImportOpen || actionParam === "import";


  const { data: categories = [] } = useGetCategoriesQuery();
  const { data: paymentMethods = [] } = useGetPaymentMethodsQuery();
  const { data: accounts = [] } = useGetAccountsQuery();
  const { data: tags = [] } = useGetTagsQuery();
  const { data: transactions = [], isLoading: isTransactionsLoading } =
    useGetTransactionsQuery({ month });
  const [updateTransaction] = useUpdateTransactionMutation();

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
  const filteredTransactions = useMemo(() => {
    const searchTerm = search.trim().toLowerCase();
    return transactions.filter((tx) => {
      if (filterAccount && tx.account_id !== filterAccount) {
        return false;
      }
      if (filterTag && !tx.tags?.some((tag) => tag.name === filterTag)) {
        return false;
      }
      if (filterFrom && tx.date < filterFrom) {
        return false;
      }
      if (filterTo && tx.date > filterTo) {
        return false;
      }
      if (minAmount && Number(tx.amount) < Number(minAmount)) {
        return false;
      }
      if (maxAmount && Number(tx.amount) > Number(maxAmount)) {
        return false;
      }
      if (!searchTerm) {
        return true;
      }
      const categoryLabel = tx.category_id
        ? categoryMap.get(tx.category_id) ?? ""
        : "uncategorized";
      const accountLabel = tx.account_id
        ? accountMap.get(tx.account_id) ?? ""
        : "";
      const paymentLabel = tx.payment_method_id
        ? paymentMap.get(tx.payment_method_id) ?? ""
        : "";
      const tagsLabel = tx.tags?.map((tag) => tag.name).join(" ") ?? "";
      const notesLabel = tx.notes ?? "";
      const haystack = `${categoryLabel} ${accountLabel} ${paymentLabel} ${tagsLabel} ${notesLabel}`.toLowerCase();
      return haystack.includes(searchTerm);
    });
  }, [
    transactions,
    search,
    filterAccount,
    filterTag,
    filterFrom,
    filterTo,
    minAmount,
    maxAmount,
    categoryMap,
    accountMap,
    paymentMap,
  ]);

  const rows = useMemo<TransactionRow[]>(
    () =>
      filteredTransactions.map((tx) => ({
        id: tx.id,
        date: dayjs(tx.date).format("DD MMM"),
        category: tx.category_id
          ? categoryMap.get(tx.category_id) ?? tx.category_id
          : "Uncategorized",
        account: accountMap.get(tx.account_id ?? "") ?? "-",
        payment: paymentMap.get(tx.payment_method_id ?? "") ?? "-",
        notes: tx.notes?.trim() ?? "",
        tags: tx.tags?.length ? tx.tags.map((tag) => tag.name).join(", ") : "-",
        amount: tx.amount,
        type: tx.type,
        isTransfer: Boolean(tx.is_transfer),
      })),
    [filteredTransactions, categoryMap, paymentMap, accountMap]
  );
  const transactionMap = useMemo(
    () => new Map(transactions.map((tx) => [tx.id, tx])),
    [transactions]
  );
  const columns = useMemo<ColDef<TransactionRow>[]>(
    () => [
      {
        headerName: "",
        field: "select",
        width: 48,
        checkboxSelection: true,
        headerCheckboxSelection: true,
        sortable: false,
        resizable: false,
        pinned: "left",
      },
      { headerName: "Date", field: "date", maxWidth: 120 },
      {
        headerName: "Category",
        field: "category",
        flex: 1.2,
      },
      {
        headerName: "Type",
        field: "type",
        maxWidth: 140,
        cellRenderer: TransactionTypeCell,
      },
      { headerName: "Account", field: "account", flex: 1 },
      { headerName: "Payment", field: "payment", flex: 1 },
      {
        headerName: "Notes",
        field: "notes",
        flex: 1.6,
        cellClass: "datatrix-cell-muted",
        valueFormatter: (params) => (params.value ? params.value : "-"),
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
  const totalCount = transactions.length;
  const filteredCount = filteredTransactions.length;
  const countLabel =
    totalCount === filteredCount
      ? `${totalCount} items`
      : `${filteredCount} of ${totalCount} items`;

  const savedFilterOptions = useMemo(
    () =>
      savedFilters.map((filter) => ({ value: filter.id, label: filter.name })),
    [savedFilters]
  );

  const activeChips = useMemo<ActiveFilterChip[]>(() => {
    const chips: ActiveFilterChip[] = [];
    if (search.trim()) {
      chips.push({
        key: "search",
        label: `Search: ${search.trim()}`,
        onClear: () => setSearch(""),
      });
    }
    if (filterAccount) {
      chips.push({
        key: "account",
        label: `Account: ${accountMap.get(filterAccount) ?? "Unknown"}`,
        onClear: () => setFilterAccount(""),
      });
    }
    if (filterTag) {
      chips.push({
        key: "tag",
        label: `Tag: ${filterTag}`,
        onClear: () => setFilterTag(""),
      });
    }
    if (filterFrom || filterTo) {
      const fromLabel = filterFrom
        ? dayjs(filterFrom).format("DD MMM")
        : "Any";
      const toLabel = filterTo ? dayjs(filterTo).format("DD MMM") : "Any";
      chips.push({
        key: "date",
        label: `Date: ${fromLabel} → ${toLabel}`,
        onClear: () => {
          setFilterFrom("");
          setFilterTo("");
        },
      });
    }
    if (minAmount || maxAmount) {
      const minLabel = minAmount ? formatINR(Number(minAmount)) : "Any";
      const maxLabel = maxAmount ? formatINR(Number(maxAmount)) : "Any";
      chips.push({
        key: "amount",
        label: `Amount: ${minLabel} – ${maxLabel}`,
        onClear: () => {
          setMinAmount("");
          setMaxAmount("");
        },
      });
    }
    return chips;
  }, [
    search,
    filterAccount,
    filterTag,
    filterFrom,
    filterTo,
    minAmount,
    maxAmount,
    accountMap,
  ]);

  const bulkCategoryOptions = useMemo(
    () => [
      { value: "uncategorized", label: "Uncategorized" },
      ...categories.map((category) => ({
        value: category.id,
        label: category.name,
      })),
    ],
    [categories]
  );
  const bulkAccountOptions = useMemo(
    () => [
      { value: "none", label: "No account" },
      ...accounts.map((account) => ({
        value: account.id,
        label: account.name,
      })),
    ],
    [accounts]
  );

  const selectedIds = useMemo(
    () => selectedRows.map((row) => row.id),
    [selectedRows]
  );

  const handleOpenBulk = () => {
    if (selectedIds.length === 0) {
      return;
    }
    setBulkError(null);
    setBulkCategoryEnabled(false);
    setBulkCategoryId(null);
    setBulkAccountEnabled(false);
    setBulkAccountId(null);
    setBulkTagsEnabled(false);
    setBulkTags("");
    setBulkOpen(true);
  };

  const handleCloseBulk = () => {
    setBulkOpen(false);
    setBulkError(null);
  };

  const handleClearSelection = () => {
    gridApiRef.current?.deselectAll();
    setSelectedRows([]);
  };

  const handleApplyBulk = async () => {
    if (selectedIds.length === 0) {
      return;
    }
    if (!bulkCategoryEnabled && !bulkAccountEnabled && !bulkTagsEnabled) {
      setBulkError("Select at least one field to update.");
      return;
    }
    setBulkSaving(true);
    setBulkError(null);
    const nextTags = bulkTagsEnabled
      ? bulkTags
          .split(",")
          .map((tag) => tag.trim())
          .filter(Boolean)
      : [];
    try {
      for (const id of selectedIds) {
        const transaction = transactionMap.get(id);
        if (!transaction) continue;
        const nextCategoryId = bulkCategoryEnabled
          ? bulkCategoryId === "uncategorized"
            ? null
            : bulkCategoryId
          : transaction.category_id ?? null;
        const nextAccountId = bulkAccountEnabled
          ? bulkAccountId === "none"
            ? null
            : bulkAccountId
          : transaction.account_id ?? null;
        const nextTagsFinal = bulkTagsEnabled
          ? nextTags
          : transaction.tags?.map((tag) => tag.name) ?? [];

        await updateTransaction({
          id: transaction.id,
          type: transaction.type,
          date: transaction.date,
          amount: transaction.amount,
          category_id: nextCategoryId,
          payment_method_id: transaction.payment_method_id ?? null,
          account_id: nextAccountId,
          notes: transaction.notes ?? null,
          tags: nextTagsFinal,
          is_transfer: transaction.is_transfer ?? false,
          is_recurring: transaction.is_recurring,
        }).unwrap();
      }
      setBulkOpen(false);
      handleClearSelection();
    } catch {
      setBulkError("Unable to apply bulk changes. Try again.");
    } finally {
      setBulkSaving(false);
    }
  };

  const persistSavedFilters = (next: SavedFilter<TransactionFilters>[]) => {
    setSavedFilters(next);
    saveSavedFilters(buildFiltersKey(userId), next);
  };

  const handleApplySavedFilter = (id: string | null) => {
    setSelectedSavedId(id);
    if (!id) {
      return;
    }
    const match = savedFilters.find((filter) => filter.id === id);
    if (!match) {
      return;
    }
    setSearch(match.value.search);
    setFilterAccount(match.value.accountId);
    setFilterTag(match.value.tag);
    setFilterFrom(match.value.dateFrom);
    setFilterTo(match.value.dateTo);
    setMinAmount(match.value.minAmount);
    setMaxAmount(match.value.maxAmount);
  };

  const handleSaveCurrentFilters = () => {
    const trimmed = saveName.trim();
    if (!trimmed) {
      return;
    }
    const id = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const value: TransactionFilters = {
      search,
      accountId: filterAccount,
      tag: filterTag,
      dateFrom: filterFrom,
      dateTo: filterTo,
      minAmount,
      maxAmount,
    };
    persistSavedFilters([...savedFilters, { id, name: trimmed, value }]);
    setSelectedSavedId(id);
    setSaveName("");
    setSaveModalOpen(false);
  };

  const handleDeleteSavedFilter = () => {
    if (!selectedSavedId) {
      return;
    }
    const next = savedFilters.filter((filter) => filter.id !== selectedSavedId);
    persistSavedFilters(next);
    setSelectedSavedId(null);
  };

  return (
    <Stack gap="lg">
      <Modal
        opened={saveModalOpen}
        onClose={() => setSaveModalOpen(false)}
        title="Save filters"
        size="sm"
      >
        <Stack gap="sm">
          <TextInput
            label="Filter name"
            value={saveName}
            onChange={(event) => setSaveName(event.target.value)}
            placeholder="e.g., Card spend, Food only"
            required
          />
          <Group justify="flex-end">
            <Button
              variant="subtle"
              color="gray"
              onClick={() => setSaveModalOpen(false)}
            >
              Cancel
            </Button>
            <Button
              leftSection={<Save size={16} strokeWidth={2} />}
              onClick={handleSaveCurrentFilters}
            >
              Save
            </Button>
          </Group>
        </Stack>
      </Modal>
      <Modal
        opened={bulkOpen}
        onClose={handleCloseBulk}
        title={`Bulk edit (${selectedIds.length})`}
        size="md"
      >
        <Stack gap="sm">
          <Group justify="space-between" align="center">
            <Text size="sm" c="dimmed">
              Apply changes to all selected transactions.
            </Text>
            <Button variant="subtle" color="gray" size="xs" onClick={handleClearSelection}>
              Clear selection
            </Button>
          </Group>
          <Stack gap="xs">
            <Group justify="space-between" align="center">
              <Text size="sm" fw={600}>
                Category
              </Text>
              <Switch
                checked={bulkCategoryEnabled}
                onChange={(event) =>
                  setBulkCategoryEnabled(event.currentTarget.checked)
                }
                size="sm"
                label={bulkCategoryEnabled ? "Enabled" : "Skip"}
              />
            </Group>
            <Select
              data={bulkCategoryOptions}
              value={bulkCategoryId}
              onChange={setBulkCategoryId}
              disabled={!bulkCategoryEnabled}
              placeholder="Choose category"
              searchable
              clearable
            />
          </Stack>
          <Stack gap="xs">
            <Group justify="space-between" align="center">
              <Text size="sm" fw={600}>
                Account
              </Text>
              <Switch
                checked={bulkAccountEnabled}
                onChange={(event) =>
                  setBulkAccountEnabled(event.currentTarget.checked)
                }
                size="sm"
                label={bulkAccountEnabled ? "Enabled" : "Skip"}
              />
            </Group>
            <Select
              data={bulkAccountOptions}
              value={bulkAccountId}
              onChange={setBulkAccountId}
              disabled={!bulkAccountEnabled}
              placeholder="Choose account"
              searchable
              clearable
            />
          </Stack>
          <Stack gap="xs">
            <Group justify="space-between" align="center">
              <Text size="sm" fw={600}>
                Tags
              </Text>
              <Switch
                checked={bulkTagsEnabled}
                onChange={(event) =>
                  setBulkTagsEnabled(event.currentTarget.checked)
                }
                size="sm"
                label={bulkTagsEnabled ? "Enabled" : "Skip"}
              />
            </Group>
            <TextInput
              value={bulkTags}
              onChange={(event) => setBulkTags(event.target.value)}
              disabled={!bulkTagsEnabled}
              placeholder="comma separated"
            />
          </Stack>
          {bulkError ? (
            <Text size="sm" c="red">
              {bulkError}
            </Text>
          ) : null}
          <Group justify="flex-end">
            <Button variant="subtle" color="gray" onClick={handleCloseBulk}>
              Cancel
            </Button>
            <Button
              color="green"
              loading={bulkSaving}
              onClick={handleApplyBulk}
            >
              Apply changes
            </Button>
          </Group>
        </Stack>
      </Modal>
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
              {countLabel}
            </Text>
            <Text size="xs" c="dimmed">
              Click a row to edit or delete.
            </Text>
          </Stack>
          <Group gap="sm" align="flex-end" wrap="wrap">
            <Button
              variant="light"
              onClick={() => setIsImportOpen(true)}
              leftSection={<Upload size={16} strokeWidth={2} />}
            >
              Import CSV
            </Button>
            {!isMobile ? (
              <Button leftSection={<Plus size={16} strokeWidth={2} />} onClick={handleOpenCreate}>
                Add transaction
              </Button>
            ) : null}
          </Group>
        </Group>
        {selectedIds.length > 0 ? (
          <Paper withBorder radius="md" p="sm" mb="md">
            <Group justify="space-between" align="center" wrap="wrap">
              <Text size="sm">
                {selectedIds.length} selected
              </Text>
              <Group gap="xs">
                <Button size="xs" variant="light" onClick={handleOpenBulk}>
                  Bulk edit
                </Button>
                <Button size="xs" variant="subtle" color="gray" onClick={handleClearSelection}>
                  Clear
                </Button>
              </Group>
            </Group>
          </Paper>
        ) : null}
        <Stack gap="xs" mb="md">
          <Paper withBorder radius="md" p="sm">
            <Stack gap="sm">
              <SimpleGrid cols={{ base: 1, sm: 2, md: 3, xl: 6 }} spacing="sm">
              <TextInput
                label="Search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Category, account, tags, notes"
                size="xs"
              />
              <Select
                label="Account"
                data={accounts.map((account) => ({
                  value: account.id,
                  label: account.name,
                }))}
                value={filterAccount || null}
                onChange={(value) => setFilterAccount(value ?? "")}
                clearable
                searchable
                size="xs"
              />
              <Select
                label="Tag"
                data={tags.map((tag) => ({ value: tag.name, label: tag.name }))}
                value={filterTag || null}
                onChange={(value) => setFilterTag(value ?? "")}
                clearable
                searchable
                size="xs"
              />
              <Group gap="xs" align="flex-end" wrap="nowrap" style={{ minWidth: 0 }}>
                <DateInput
                  label="From"
                  value={filterFrom ? dayjs(filterFrom).toDate() : null}
                  onChange={(value) =>
                    setFilterFrom(
                      value ? dayjs(value).format("YYYY-MM-DD") : ""
                    )
                  }
                  clearable
                  size="xs"
                  styles={{ input: { minWidth: 0 } }}
                  style={{ flex: 1 }}
                />
                <DateInput
                  label="To"
                  value={filterTo ? dayjs(filterTo).toDate() : null}
                  onChange={(value) =>
                    setFilterTo(value ? dayjs(value).format("YYYY-MM-DD") : "")
                  }
                  clearable
                  size="xs"
                  styles={{ input: { minWidth: 0 } }}
                  style={{ flex: 1 }}
                />
              </Group>
              <Group gap="xs" align="flex-end" wrap="nowrap" style={{ minWidth: 0 }}>
                <TextInput
                  label="Min"
                  type="number"
                  value={minAmount}
                  onChange={(event) => setMinAmount(event.target.value)}
                  placeholder="0"
                  min="0"
                  step="0.01"
                  size="xs"
                  styles={{ input: { minWidth: 0 } }}
                  style={{ flex: 1 }}
                />
                <TextInput
                  label="Max"
                  type="number"
                  value={maxAmount}
                  onChange={(event) => setMaxAmount(event.target.value)}
                  placeholder="0"
                  min="0"
                  step="0.01"
                  size="xs"
                  styles={{ input: { minWidth: 0 } }}
                  style={{ flex: 1 }}
                />
              </Group>
              <Popover
                opened={savedPopoverOpen}
                onChange={setSavedPopoverOpen}
                position="bottom-end"
                withArrow
                shadow="md"
              >
                <Popover.Target>
                  <Button
                    variant="light"
                    size="xs"
                    leftSection={<Save size={14} strokeWidth={2} />}
                    style={{ width: "100%" }}
                  >
                    Saved filters
                  </Button>
                </Popover.Target>
                <Popover.Dropdown>
                  <Stack gap="xs">
                    <Select
                      label="Saved filters"
                      data={savedFilterOptions}
                      value={selectedSavedId}
                      onChange={(value) => {
                        handleApplySavedFilter(value);
                        setSavedPopoverOpen(false);
                      }}
                      placeholder="Choose"
                      clearable
                      size="xs"
                    />
                    <Group grow>
                      <Button
                        variant="light"
                        size="xs"
                        leftSection={<Save size={14} strokeWidth={2} />}
                        onClick={() => {
                          setSavedPopoverOpen(false);
                          setSaveModalOpen(true);
                        }}
                      >
                        Save
                      </Button>
                      <Button
                        variant="light"
                        size="xs"
                        color="red"
                        leftSection={<Trash2 size={14} strokeWidth={2} />}
                        onClick={() => {
                          handleDeleteSavedFilter();
                          setSavedPopoverOpen(false);
                        }}
                        disabled={!selectedSavedId}
                      >
                        Delete
                      </Button>
                    </Group>
                  </Stack>
                </Popover.Dropdown>
              </Popover>
            </SimpleGrid>
              <ActiveFilterChips items={activeChips} />
            </Stack>
          </Paper>
        </Stack>
        <DatatrixTable
          rows={rows}
          columns={columns}
          height="max(420px, calc(100vh - 280px))"
          emptyLabel="No transactions yet. Add or import to get started."
          loading={isTransactionsLoading}
          getRowId={(row) => row.id}
          onRowClick={(row) => handleEditTransaction(row.id)}
          enableSelection
          onSelectionChanged={(rows) => setSelectedRows(rows)}
          onGridReady={(event) => {
            gridApiRef.current = event.api;
          }}
        />
      </Paper>
    </Stack>
  );
};
