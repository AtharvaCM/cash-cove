import {
  Badge,
  Button,
  Group,
  Modal,
  Paper,
  Popover,
  Select,
  SimpleGrid,
  Stack,
  Switch,
  Text,
  TextInput,
  Title,
} from "@mantine/core";
import { DateInput } from "@mantine/dates";
import { useMediaQuery } from "@mantine/hooks";
import { CheckCircle2, Plus, Save, Trash2 } from "lucide-react";
import dayjs from "dayjs";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  useAddTransactionMutation,
  useGetAccountsQuery,
  useGetCategoriesQuery,
  useGetPaymentMethodsQuery,
  useGetSubscriptionsQuery,
  useUpdateSubscriptionMutation,
} from "../features/api/apiSlice";
import { DatatrixTable } from "../components/DatatrixTable";
import { SubscriptionFormModal } from "../components/subscriptions/SubscriptionFormModal";
import { formatINR } from "../lib/format";
import {
  calculateSubscriptionTotals,
  formatIntervalLabel,
  getUpcomingSubscriptions,
  isSubscriptionOverdue,
} from "../lib/subscriptions";
import type { ColDef, ICellRendererParams } from "ag-grid-community";
import type { Subscription } from "../types/finance";
import { ActiveFilterChips, type ActiveFilterChip } from "../components/filters/ActiveFilterChips";
import { loadSavedFilters, saveSavedFilters, type SavedFilter } from "../lib/savedFilters";
import { useAppSelector } from "../app/hooks";

type SubscriptionRow = {
  id: string;
  name: string;
  cadence: string;
  next_due: string;
  next_due_raw: string;
  amount: number;
  status: Subscription["status"];
  account: string;
  category: string;
  payment: string;
  overdue: boolean;
  hasAccount: boolean;
};

type SubscriptionActionParams = {
  onPostPayment: (id: string) => void;
  postingId: string | null;
  isBulkPosting: boolean;
  postErrors: Record<string, string>;
};

type SubscriptionFilters = {
  search: string;
  status: string;
  accountId: string;
  dueFrom: string;
  dueTo: string;
  minAmount: string;
  maxAmount: string;
};

const buildFiltersKey = (userId?: string | null) =>
  `cashcove:filters:subscriptions:${userId ?? "anon"}`;

const SubscriptionNextDueCell = (
  params: ICellRendererParams<SubscriptionRow>
) => {
  const raw = params.data?.next_due_raw;
  if (!raw) {
    return <Text size="sm">-</Text>;
  }
  const dueDate = dayjs(raw);
  const daysAway = dueDate.diff(dayjs(), "day");
  const isOverdue = daysAway < 0;
  const isToday = daysAway === 0;
  const isSoon = daysAway > 0 && daysAway <= 7;
  let statusLabel = "Upcoming";
  let detailLabel = `In ${daysAway} days`;

  if (isOverdue) {
    statusLabel = "Overdue";
    detailLabel = `${Math.abs(daysAway)} days late`;
  } else if (isToday) {
    statusLabel = "Due today";
    detailLabel = "Today";
  } else if (isSoon) {
    statusLabel = "Due soon";
    detailLabel = `In ${daysAway} days`;
  }

  let tone = "gray";
  if (isOverdue) {
    tone = "red";
  } else if (isSoon || isToday) {
    tone = "orange";
  }
  return (
    <Stack gap={4}>
      <Text fw={600}>{params.data?.next_due}</Text>
      <Group gap={6} wrap="wrap">
        <Badge variant="light" color={tone} radius="sm">
          {statusLabel}
        </Badge>
        <Text size="xs" c="dimmed">
          {detailLabel}
        </Text>
      </Group>
    </Stack>
  );
};

const SubscriptionStatusCell = (
  params: ICellRendererParams<SubscriptionRow>
) => {
  const status = params.data?.status ?? "active";
  let color = "gray";
  let label = "Cancelled";
  if (status === "active") {
    color = "green";
    label = "Active";
  } else if (status === "paused") {
    color = "yellow";
    label = "Paused";
  }
  return (
    <Badge variant="light" color={color} radius="sm">
      {label}
    </Badge>
  );
};

const SubscriptionActionsCell = (
  params: ICellRendererParams<SubscriptionRow> & SubscriptionActionParams
) => {
  const row = params.data;
  if (!row) {
    return null;
  }
  const disabled =
    row.status !== "active" ||
    !row.hasAccount ||
    Boolean(params.postingId) ||
    params.isBulkPosting;
  const rowError = params.postErrors[row.id];
  return (
    <Stack gap={4}>
      <Button
        size="xs"
        variant="light"
        leftSection={<CheckCircle2 size={14} strokeWidth={2} />}
        disabled={disabled}
        loading={params.postingId === row.id}
        onClick={(event) => {
          event.stopPropagation();
          params.onPostPayment(row.id);
        }}
      >
        Post payment
      </Button>
      {rowError ? (
        <Text size="xs" c="red.6">
          {rowError}
        </Text>
      ) : null}
    </Stack>
  );
};

export const Subscriptions = () => {
  const userId = useAppSelector((state) => state.auth.user?.id ?? null);
  const isMobile = useMediaQuery("(max-width: 900px)");
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [postingId, setPostingId] = useState<string | null>(null);
  const [postErrors, setPostErrors] = useState<Record<string, string>>({});
  const [needsAccountOnly, setNeedsAccountOnly] = useState(() => {
    if (typeof window === "undefined") {
      return false;
    }
    try {
      const saved = window.localStorage.getItem(
        "cashcove:subscriptions:needsAccountOnly"
      );
      if (saved === null) {
        return false;
      }
      return saved === "true";
    } catch {
      return false;
    }
  });
  const [searchParams, setSearchParams] = useSearchParams();
  const actionParam = searchParams.get("action");
  const formVisible = isFormOpen || actionParam === "new";
  const [isBulkPosting, setIsBulkPosting] = useState(false);
  const [bulkSummary, setBulkSummary] = useState<{
    total: number;
    success: number;
    failed: number;
  } | null>(null);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [filterAccount, setFilterAccount] = useState("");
  const [filterFrom, setFilterFrom] = useState("");
  const [filterTo, setFilterTo] = useState("");
  const [minAmount, setMinAmount] = useState("");
  const [maxAmount, setMaxAmount] = useState("");
  const [saveModalOpen, setSaveModalOpen] = useState(false);
  const [saveName, setSaveName] = useState("");
  const [selectedSavedId, setSelectedSavedId] = useState<string | null>(null);
  const [savedPopoverOpen, setSavedPopoverOpen] = useState(false);
  const [savedFilters, setSavedFilters] = useState<
    SavedFilter<SubscriptionFilters>[]
  >(() => loadSavedFilters(buildFiltersKey(userId)));

  const { data: subscriptions = [], isLoading } = useGetSubscriptionsQuery();
  const { data: categories = [] } = useGetCategoriesQuery();
  const { data: accounts = [] } = useGetAccountsQuery();
  const { data: paymentMethods = [] } = useGetPaymentMethodsQuery();

  const [addTransaction] = useAddTransactionMutation();
  const [updateSubscription] = useUpdateSubscriptionMutation();

  const categoryMap = useMemo(
    () => new Map(categories.map((category) => [category.id, category.name])),
    [categories]
  );
  const accountMap = useMemo(
    () => new Map(accounts.map((account) => [account.id, account.name])),
    [accounts]
  );
  const paymentMap = useMemo(
    () => new Map(paymentMethods.map((method) => [method.id, method.name])),
    [paymentMethods]
  );
  const subscriptionMap = useMemo(
    () => new Map(subscriptions.map((subscription) => [subscription.id, subscription])),
    [subscriptions]
  );

  const selectedSubscription = editingId
    ? subscriptionMap.get(editingId) ?? null
    : null;

  const monthKey = dayjs().format("YYYY-MM");
  const totals = useMemo(
    () => calculateSubscriptionTotals(subscriptions, monthKey),
    [subscriptions, monthKey]
  );
  const upcoming = useMemo(
    () => getUpcomingSubscriptions(subscriptions, 30),
    [subscriptions]
  );
  const upcomingTotal = useMemo(
    () => upcoming.reduce((sum, sub) => sum + sub.amount, 0),
    [upcoming]
  );
  const dueThisWeek = useMemo(() => {
    const today = dayjs().startOf("day");
    return subscriptions.filter((sub) => {
      if (sub.status !== "active" || !sub.next_due) {
        return false;
      }
      const daysAway = dayjs(sub.next_due).diff(today, "day");
      return daysAway >= 0 && daysAway <= 7;
    });
  }, [subscriptions]);
  const dueThisWeekEligible = useMemo(
    () => dueThisWeek.filter((sub) => sub.account_id),
    [dueThisWeek]
  );
  const dueThisWeekNeedsAccount = useMemo(
    () => dueThisWeek.filter((sub) => !sub.account_id).length,
    [dueThisWeek]
  );

  const filteredSubscriptions = useMemo(() => {
    const searchTerm = search.trim().toLowerCase();
    return subscriptions.filter((sub) => {
      if (needsAccountOnly && sub.account_id) {
        return false;
      }
      if (filterStatus && sub.status !== filterStatus) {
        return false;
      }
      if (filterAccount && sub.account_id !== filterAccount) {
        return false;
      }
      if (filterFrom && sub.next_due < filterFrom) {
        return false;
      }
      if (filterTo && sub.next_due > filterTo) {
        return false;
      }
      if (minAmount && sub.amount < Number(minAmount)) {
        return false;
      }
      if (maxAmount && sub.amount > Number(maxAmount)) {
        return false;
      }
      if (!searchTerm) {
        return true;
      }
      const categoryLabel = sub.category_id
        ? categoryMap.get(sub.category_id) ?? ""
        : "";
      const accountLabel = sub.account_id
        ? accountMap.get(sub.account_id) ?? ""
        : "";
      const paymentLabel = sub.payment_method_id
        ? paymentMap.get(sub.payment_method_id) ?? ""
        : "";
      const notesLabel = sub.notes ?? "";
      const haystack = `${sub.name} ${categoryLabel} ${accountLabel} ${paymentLabel} ${notesLabel}`.toLowerCase();
      return haystack.includes(searchTerm);
    });
  }, [
    subscriptions,
    needsAccountOnly,
    filterStatus,
    filterAccount,
    filterFrom,
    filterTo,
    minAmount,
    maxAmount,
    search,
    categoryMap,
    accountMap,
    paymentMap,
  ]);

  const rows = useMemo<SubscriptionRow[]>(
    () =>
      filteredSubscriptions.map((sub) => ({
        id: sub.id,
        name: sub.name,
        cadence: formatIntervalLabel(sub.interval_months),
        next_due: sub.next_due
          ? dayjs(sub.next_due).format("DD MMM YYYY")
          : "-",
        next_due_raw: sub.next_due,
        amount: sub.amount,
        status: sub.status,
        account: accountMap.get(sub.account_id ?? "") ?? "-",
        category: categoryMap.get(sub.category_id ?? "") ?? "-",
        payment: paymentMap.get(sub.payment_method_id ?? "") ?? "-",
        overdue: isSubscriptionOverdue(sub),
        hasAccount: Boolean(sub.account_id),
      })),
    [filteredSubscriptions, accountMap, categoryMap, paymentMap]
  );

  const clearActionParam = () => {
    if (!actionParam) {
      return;
    }
    const next = new URLSearchParams(searchParams);
    next.delete("action");
    setSearchParams(next, { replace: true });
  };

  const handlePostPayment = useCallback(
    async (subscriptionId: string) => {
      const subscription = subscriptionMap.get(subscriptionId);
      if (!subscription) {
        return false;
      }
      setPostErrors((prev) => {
        if (!prev[subscriptionId]) {
          return prev;
        }
        const next = { ...prev };
        delete next[subscriptionId];
        return next;
      });

      if (!subscription.account_id) {
        setPostErrors((prev) => ({
          ...prev,
          [subscriptionId]:
            "Select an account before posting a subscription payment.",
        }));
        return false;
      }

      if (!subscription.next_due) {
        setPostErrors((prev) => ({
          ...prev,
          [subscriptionId]: "Subscription needs a next due date before posting.",
        }));
        return false;
      }

      setPostingId(subscription.id);
      try {
        await addTransaction({
          type: "expense",
          date: subscription.next_due,
          amount: subscription.amount,
          category_id: subscription.category_id,
          payment_method_id: subscription.payment_method_id,
          account_id: subscription.account_id,
          notes: subscription.notes?.trim()
            ? subscription.notes.trim()
            : `Subscription: ${subscription.name}`,
          tags: [],
          is_transfer: false,
          is_recurring: true,
        }).unwrap();

        const nextDue = dayjs(subscription.next_due)
          .add(subscription.interval_months, "month")
          .format("YYYY-MM-DD");

        await updateSubscription({
          ...subscription,
          last_paid: subscription.next_due,
          next_due: nextDue,
        }).unwrap();
        setPostErrors((prev) => {
          if (!prev[subscriptionId]) {
            return prev;
          }
          const next = { ...prev };
          delete next[subscriptionId];
          return next;
        });
        return true;
      } catch {
        setPostErrors((prev) => ({
          ...prev,
          [subscriptionId]: "Unable to post the subscription payment.",
        }));
        return false;
      } finally {
        setPostingId(null);
      }
    },
    [addTransaction, subscriptionMap, updateSubscription]
  );
  const handleBulkPost = useCallback(async () => {
    if (isBulkPosting || dueThisWeekEligible.length === 0) {
      return;
    }
    setIsBulkPosting(true);
    setBulkSummary(null);
    let success = 0;
    let failed = 0;
    for (const subscription of dueThisWeekEligible) {
      const ok = await handlePostPayment(subscription.id);
      if (ok) {
        success += 1;
      } else {
        failed += 1;
      }
    }
    setBulkSummary({
      total: success + failed,
      success,
      failed,
    });
    setIsBulkPosting(false);
  }, [dueThisWeekEligible, handlePostPayment, isBulkPosting]);

  const columns = useMemo<ColDef<SubscriptionRow>[]>(
    () => [
      { headerName: "Subscription", field: "name", flex: 1.3 },
      { headerName: "Cadence", field: "cadence", maxWidth: 160 },
      {
        headerName: "Next due",
        field: "next_due",
        flex: 1,
        cellRenderer: SubscriptionNextDueCell,
      },
      {
        headerName: "Amount",
        field: "amount",
        maxWidth: 160,
        valueFormatter: (params) => formatINR(Number(params.value ?? 0)),
      },
      {
        headerName: "Status",
        field: "status",
        maxWidth: 160,
        cellRenderer: SubscriptionStatusCell,
      },
      { headerName: "Account", field: "account", flex: 1 },
      { headerName: "Category", field: "category", flex: 1 },
      { headerName: "Payment", field: "payment", flex: 1 },
      {
        headerName: "Actions",
        field: "id",
        maxWidth: 160,
        sortable: false,
        cellRenderer: SubscriptionActionsCell,
        cellRendererParams: {
          onPostPayment: handlePostPayment,
          postingId,
          isBulkPosting,
          postErrors,
        },
      },
    ],
    [handlePostPayment, isBulkPosting, postErrors, postingId]
  );

  const handleOpenCreate = () => {
    setEditingId(null);
    setIsFormOpen(true);
  };

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    try {
      window.localStorage.setItem(
        "cashcove:subscriptions:needsAccountOnly",
        String(needsAccountOnly)
      );
    } catch {
      // Ignore storage errors (e.g., storage disabled).
    }
  }, [needsAccountOnly]);

  const handleEditSubscription = (id: string) => {
    setEditingId(id);
    setIsFormOpen(true);
  };

  const handleCloseForm = () => {
    setIsFormOpen(false);
    setEditingId(null);
    clearActionParam();
  };

  const formKey = `${selectedSubscription?.id ?? "new"}-${
    formVisible ? "open" : "closed"
  }`;
  const dueThisWeekLabel =
    dueThisWeekEligible.length > 0
      ? `Post all due this week (${dueThisWeekEligible.length})`
      : "Post all due this week";
  const totalCount = subscriptions.length;
  const filteredCount = filteredSubscriptions.length;
  const countLabel =
    totalCount === filteredCount
      ? `${totalCount} items`
      : `${filteredCount} of ${totalCount} items`;
  const emptyLabel =
    totalCount === 0
      ? "No subscriptions yet. Add one to get started."
      : "No subscriptions match these filters.";
  const bulkSummaryLabel = bulkSummary
    ? bulkSummary.failed === 0
      ? `Posted ${bulkSummary.success} payment${
          bulkSummary.success === 1 ? "" : "s"
        }.`
      : `Posted ${bulkSummary.success}/${bulkSummary.total}. ${bulkSummary.failed} failed.`
    : null;
  const bulkSummaryColor =
    bulkSummary && bulkSummary.failed === 0 ? "teal.7" : "orange.6";

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
    if (filterStatus) {
      chips.push({
        key: "status",
        label: `Status: ${filterStatus}`,
        onClear: () => setFilterStatus(""),
      });
    }
    if (filterAccount) {
      chips.push({
        key: "account",
        label: `Account: ${accountMap.get(filterAccount) ?? "Unknown"}`,
        onClear: () => setFilterAccount(""),
      });
    }
    if (filterFrom || filterTo) {
      const fromLabel = filterFrom
        ? dayjs(filterFrom).format("DD MMM")
        : "Any";
      const toLabel = filterTo ? dayjs(filterTo).format("DD MMM") : "Any";
      chips.push({
        key: "due",
        label: `Due: ${fromLabel} → ${toLabel}`,
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
    if (needsAccountOnly) {
      chips.push({
        key: "needs-account",
        label: "Needs account",
        onClear: () => setNeedsAccountOnly(false),
      });
    }
    return chips;
  }, [
    search,
    filterStatus,
    filterAccount,
    filterFrom,
    filterTo,
    minAmount,
    maxAmount,
    needsAccountOnly,
    accountMap,
  ]);

  const persistSavedFilters = (next: SavedFilter<SubscriptionFilters>[]) => {
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
    setFilterStatus(match.value.status);
    setFilterAccount(match.value.accountId);
    setFilterFrom(match.value.dueFrom);
    setFilterTo(match.value.dueTo);
    setMinAmount(match.value.minAmount);
    setMaxAmount(match.value.maxAmount);
  };

  const handleSaveCurrentFilters = () => {
    const trimmed = saveName.trim();
    if (!trimmed) {
      return;
    }
    const id = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const value: SubscriptionFilters = {
      search,
      status: filterStatus,
      accountId: filterAccount,
      dueFrom: filterFrom,
      dueTo: filterTo,
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
            placeholder="e.g., Due this week, Streaming only"
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
      <SubscriptionFormModal
        key={formKey}
        opened={formVisible}
        onClose={handleCloseForm}
        subscription={selectedSubscription}
        categories={categories}
        accounts={accounts}
        paymentMethods={paymentMethods}
      />

      <SimpleGrid cols={{ base: 1, md: 3 }} spacing="md">
        <Paper withBorder shadow="sm" radius="lg" p="md">
          <Text size="sm" c="dimmed">
            Due this month
          </Text>
          <Title order={3}>{formatINR(totals.dueThisMonth)}</Title>
        </Paper>
        <Paper withBorder shadow="sm" radius="lg" p="md">
          <Text size="sm" c="dimmed">
            Annual commitment
          </Text>
          <Title order={3}>{formatINR(totals.annualTotal)}</Title>
        </Paper>
        <Paper withBorder shadow="sm" radius="lg" p="md">
          <Group justify="space-between" align="center" mb="xs">
            <Text size="sm" c="dimmed">
              Due in 30 days
            </Text>
            <Badge variant="light" color="blue">
              {upcoming.length} renewals
            </Badge>
          </Group>
          <Title order={3}>{formatINR(upcomingTotal)}</Title>
        </Paper>
      </SimpleGrid>

      <Paper withBorder shadow="sm" radius="lg" p="md">
        <Group justify="space-between" align="center" mb="md" wrap="wrap">
          <Stack gap={2}>
            <Title order={4}>Subscriptions</Title>
            <Text size="sm" c="dimmed">
              {countLabel}
            </Text>
            <Text size="xs" c="dimmed">
              Click a row to edit or delete.
            </Text>
          </Stack>
          <Group gap="sm" wrap="wrap">
            <Switch
              size="sm"
              label="Needs account"
              checked={needsAccountOnly}
              onChange={(event) =>
                setNeedsAccountOnly(event.currentTarget.checked)
              }
            />
            <Stack gap={4} align="flex-end">
              <Button
                variant="light"
                loading={isBulkPosting}
                disabled={dueThisWeekEligible.length === 0}
                onClick={handleBulkPost}
              >
                {dueThisWeekLabel}
              </Button>
              {dueThisWeekNeedsAccount > 0 ? (
                <Text size="xs" c="dimmed">
                  {dueThisWeekNeedsAccount} due this week need an account
                </Text>
              ) : null}
              {bulkSummaryLabel ? (
                <Text size="xs" c={bulkSummaryColor}>
                  {bulkSummaryLabel}
                </Text>
              ) : null}
            </Stack>
            {!isMobile ? (
              <Button
                leftSection={<Plus size={16} strokeWidth={2} />}
                onClick={handleOpenCreate}
              >
                Add subscription
              </Button>
            ) : null}
          </Group>
        </Group>
        <Stack gap="sm" mb="md">
          <Paper withBorder radius="md" p="sm">
            <Stack gap="sm">
              <SimpleGrid cols={{ base: 1, sm: 2, md: 3, xl: 6 }} spacing="sm">
              <TextInput
                label="Search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Name, category, account"
                size="xs"
              />
              <Select
                label="Status"
                data={[
                  { value: "active", label: "Active" },
                  { value: "paused", label: "Paused" },
                  { value: "cancelled", label: "Cancelled" },
                ]}
                value={filterStatus || null}
                onChange={(value) => setFilterStatus(value ?? "")}
                clearable
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
              <Group gap="xs" align="flex-end" wrap="nowrap" style={{ minWidth: 0 }}>
                <DateInput
                  label="Due from"
                  value={filterFrom ? dayjs(filterFrom).toDate() : null}
                  onChange={(value) =>
                    setFilterFrom(value ? dayjs(value).format("YYYY-MM-DD") : "")
                  }
                  clearable
                  size="xs"
                  styles={{ input: { minWidth: 0 } }}
                  style={{ flex: 1 }}
                />
                <DateInput
                  label="Due to"
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
          height="max(420px, calc(100vh - 320px))"
          emptyLabel={emptyLabel}
          loading={isLoading}
          getRowId={(row) => row.id}
          onRowClick={(row) => handleEditSubscription(row.id)}
        />
      </Paper>
    </Stack>
  );
};
