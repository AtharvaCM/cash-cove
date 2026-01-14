import {
  ActionIcon,
  Button,
  Group,
  Modal,
  Paper,
  Select,
  Stack,
  Text,
  TextInput,
  Title,
} from "@mantine/core";
import { DateInput, MonthPickerInput } from "@mantine/dates";
import { Plus, Save, Trash2, Upload } from "lucide-react";
import { useMemo, useState } from "react";
import dayjs from "dayjs";
import {
  useGetAccountsQuery,
  useGetCategoriesQuery,
  useGetPaymentMethodsQuery,
  useGetTagsQuery,
  useGetTransactionsQuery,
} from "../features/api/apiSlice";
import { formatINR } from "../lib/format";
import { DatatrixTable } from "../components/DatatrixTable";
import { TransactionFormModal } from "../components/transactions/TransactionFormModal";
import { TransactionImportModal } from "../components/transactions/TransactionImportModal";
import { useSearchParams } from "react-router-dom";
import type { ColDef } from "ag-grid-community";
import type { Transaction } from "../types/finance";
import { ActiveFilterChips, type ActiveFilterChip } from "../components/filters/ActiveFilterChips";
import { loadSavedFilters, saveSavedFilters, type SavedFilter } from "../lib/savedFilters";
import { useAppSelector } from "../app/hooks";

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
  flag: string;
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
  const [month, setMonth] = useState(dayjs().format("YYYY-MM"));
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
  const [savedFilters, setSavedFilters] = useState<
    SavedFilter<TransactionFilters>[]
  >(() => loadSavedFilters(buildFiltersKey(userId)));
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
        flag: tx.is_transfer ? "Transfer" : "",
      })),
    [filteredTransactions, categoryMap, paymentMap, accountMap]
  );
  const columns = useMemo<ColDef<TransactionRow>[]>(
    () => [
      { headerName: "Date", field: "date", maxWidth: 120 },
      {
        headerName: "Category",
        field: "category",
        flex: 1.2,
      },
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
        <Stack gap="sm" mb="md">
          <Group gap="sm" align="flex-end" wrap="wrap">
            <TextInput
              label="Search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Category, account, tags, notes"
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
            />
            <Select
              label="Tag"
              data={tags.map((tag) => ({ value: tag.name, label: tag.name }))}
              value={filterTag || null}
              onChange={(value) => setFilterTag(value ?? "")}
              clearable
              searchable
            />
            <DateInput
              label="From"
              value={filterFrom ? dayjs(filterFrom).toDate() : null}
              onChange={(value) =>
                setFilterFrom(value ? dayjs(value).format("YYYY-MM-DD") : "")
              }
              clearable
            />
            <DateInput
              label="To"
              value={filterTo ? dayjs(filterTo).toDate() : null}
              onChange={(value) =>
                setFilterTo(value ? dayjs(value).format("YYYY-MM-DD") : "")
              }
              clearable
            />
            <TextInput
              label="Min amount"
              type="number"
              value={minAmount}
              onChange={(event) => setMinAmount(event.target.value)}
              placeholder="0"
              min="0"
              step="0.01"
            />
            <TextInput
              label="Max amount"
              type="number"
              value={maxAmount}
              onChange={(event) => setMaxAmount(event.target.value)}
              placeholder="0"
              min="0"
              step="0.01"
            />
            <Select
              label="Saved"
              data={savedFilterOptions}
              value={selectedSavedId}
              onChange={handleApplySavedFilter}
              placeholder="Choose"
              clearable
            />
            <Group gap="xs">
              <ActionIcon
                variant="light"
                color="blue"
                size="lg"
                onClick={() => setSaveModalOpen(true)}
                aria-label="Save current filters"
              >
                <Save size={16} strokeWidth={2} />
              </ActionIcon>
              <ActionIcon
                variant="light"
                color="red"
                size="lg"
                onClick={handleDeleteSavedFilter}
                disabled={!selectedSavedId}
                aria-label="Delete saved filter"
              >
                <Trash2 size={16} strokeWidth={2} />
              </ActionIcon>
            </Group>
          </Group>
          <ActiveFilterChips items={activeChips} />
        </Stack>
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
