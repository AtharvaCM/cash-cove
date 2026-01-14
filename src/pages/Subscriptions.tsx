import {
  Badge,
  Button,
  Group,
  Paper,
  SimpleGrid,
  Stack,
  Switch,
  Text,
  Title,
} from "@mantine/core";
import { CheckCircle2, Plus } from "lucide-react";
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

const SubscriptionNextDueCell = (
  params: ICellRendererParams<SubscriptionRow>
) => {
  const raw = params.data?.next_due_raw;
  if (!raw) {
    return <Text size="sm">-</Text>;
  }
  const daysAway = dayjs(raw).diff(dayjs(), "day");
  const isOverdue = daysAway < 0;
  let label = `Due in ${daysAway}d`;
  if (isOverdue) {
    label = `Overdue by ${Math.abs(daysAway)}d`;
  } else if (daysAway === 0) {
    label = "Due today";
  }

  let tone = "gray";
  if (isOverdue) {
    tone = "red";
  } else if (daysAway <= 7) {
    tone = "orange";
  }
  return (
    <Stack gap={4}>
      <Text fw={600}>{params.data?.next_due}</Text>
      <Badge variant="light" color={tone} radius="sm">
        {label}
      </Badge>
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

  const rows = useMemo<SubscriptionRow[]>(
    () =>
      subscriptions.map((sub) => ({
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
    [subscriptions, accountMap, categoryMap, paymentMap]
  );
  const filteredRows = useMemo(
    () => (needsAccountOnly ? rows.filter((row) => !row.hasAccount) : rows),
    [rows, needsAccountOnly]
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
  const countLabel = needsAccountOnly
    ? `${filteredRows.length} of ${subscriptions.length} need an account`
    : `${subscriptions.length} items`;
  const emptyLabel = needsAccountOnly
    ? "All subscriptions have accounts."
    : "No subscriptions yet. Add one to get started.";
  const bulkSummaryLabel = bulkSummary
    ? bulkSummary.failed === 0
      ? `Posted ${bulkSummary.success} payment${
          bulkSummary.success === 1 ? "" : "s"
        }.`
      : `Posted ${bulkSummary.success}/${bulkSummary.total}. ${bulkSummary.failed} failed.`
    : null;
  const bulkSummaryColor =
    bulkSummary && bulkSummary.failed === 0 ? "teal.7" : "orange.6";

  return (
    <Stack gap="lg">
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
            <Button
              leftSection={<Plus size={16} strokeWidth={2} />}
              onClick={handleOpenCreate}
            >
              Add subscription
            </Button>
          </Group>
        </Group>
        <DatatrixTable
          rows={filteredRows}
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
