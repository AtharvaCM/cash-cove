import {
  Alert,
  Badge,
  Button,
  Group,
  Paper,
  SimpleGrid,
  Stack,
  Text,
  Title,
} from "@mantine/core";
import { CheckCircle2, Plus } from "lucide-react";
import dayjs from "dayjs";
import { useCallback, useMemo, useState } from "react";
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

export const Subscriptions = () => {
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [postingId, setPostingId] = useState<string | null>(null);
  const [postError, setPostError] = useState<string | null>(null);

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

  const handlePostPayment = useCallback(
    async (subscriptionId: string) => {
      const subscription = subscriptionMap.get(subscriptionId);
      if (!subscription) {
        return;
      }
      setPostError(null);

      if (!subscription.account_id) {
        setPostError("Select an account before posting a subscription payment.");
        return;
      }

      if (!subscription.next_due) {
        setPostError("Subscription needs a next due date before posting.");
        return;
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
      } catch {
        setPostError("Unable to post the subscription payment.");
      } finally {
        setPostingId(null);
      }
    },
    [addTransaction, subscriptionMap, updateSubscription]
  );

  const columns = useMemo<ColDef<SubscriptionRow>[]>(
    () => [
      { headerName: "Subscription", field: "name", flex: 1.3 },
      { headerName: "Cadence", field: "cadence", maxWidth: 160 },
      {
        headerName: "Next due",
        field: "next_due",
        flex: 1,
        cellRenderer: (params: ICellRendererParams<SubscriptionRow>) => {
          const raw = params.data?.next_due_raw;
          if (!raw) {
            return <Text size="sm">-</Text>;
          }
          const daysAway = dayjs(raw).diff(dayjs(), "day");
          const isOverdue = daysAway < 0;
          const label = isOverdue
            ? `Overdue by ${Math.abs(daysAway)}d`
            : daysAway === 0
              ? "Due today"
              : `Due in ${daysAway}d`;
          const tone = isOverdue ? "red" : daysAway <= 7 ? "orange" : "gray";
          return (
            <Stack gap={4}>
              <Text fw={600}>{params.data?.next_due}</Text>
              <Badge variant="light" color={tone} radius="sm">
                {label}
              </Badge>
            </Stack>
          );
        },
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
        cellRenderer: (params: ICellRendererParams<SubscriptionRow>) => {
          const status = params.data?.status ?? "active";
          const color =
            status === "active" ? "green" : status === "paused" ? "yellow" : "gray";
          const label =
            status === "active" ? "Active" : status === "paused" ? "Paused" : "Cancelled";
          return (
            <Badge variant="light" color={color} radius="sm">
              {label}
            </Badge>
          );
        },
      },
      { headerName: "Account", field: "account", flex: 1 },
      { headerName: "Category", field: "category", flex: 1 },
      { headerName: "Payment", field: "payment", flex: 1 },
      {
        headerName: "Actions",
        field: "id",
        maxWidth: 160,
        sortable: false,
        cellRenderer: (params: ICellRendererParams<SubscriptionRow>) => {
          const row = params.data;
          if (!row) {
            return null;
          }
          const disabled =
            row.status !== "active" || !row.hasAccount || Boolean(postingId);
          return (
            <Button
              size="xs"
              variant="light"
              leftSection={<CheckCircle2 size={14} strokeWidth={2} />}
              disabled={disabled}
              loading={postingId === row.id}
              onClick={(event) => {
                event.stopPropagation();
                handlePostPayment(row.id);
              }}
            >
              Post payment
            </Button>
          );
        },
      },
    ],
    [handlePostPayment, postingId]
  );

  const handleOpenCreate = () => {
    setEditingId(null);
    setIsFormOpen(true);
  };

  const handleEditSubscription = (id: string) => {
    setEditingId(id);
    setIsFormOpen(true);
  };

  const handleCloseForm = () => {
    setIsFormOpen(false);
    setEditingId(null);
  };

  const formKey = `${selectedSubscription?.id ?? "new"}-${
    isFormOpen ? "open" : "closed"
  }`;

  return (
    <Stack gap="lg">
      <SubscriptionFormModal
        key={formKey}
        opened={isFormOpen}
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
              {subscriptions.length} items
            </Text>
            <Text size="xs" c="dimmed">
              Click a row to edit or delete.
            </Text>
          </Stack>
          <Group gap="sm" wrap="wrap">
            <Button leftSection={<Plus size={16} strokeWidth={2} />} onClick={handleOpenCreate}>
              Add subscription
            </Button>
          </Group>
        </Group>
        {postError ? (
          <Alert color="red" variant="light" mb="sm">
            {postError}
          </Alert>
        ) : null}
        <DatatrixTable
          rows={rows}
          columns={columns}
          height="max(420px, calc(100vh - 320px))"
          emptyLabel="No subscriptions tracked yet."
          loading={isLoading}
          getRowId={(row) => row.id}
          onRowClick={(row) => handleEditSubscription(row.id)}
        />
      </Paper>
    </Stack>
  );
};
