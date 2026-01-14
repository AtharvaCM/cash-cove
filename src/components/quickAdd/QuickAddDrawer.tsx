import {
  Alert,
  Button,
  Drawer,
  Group,
  SegmentedControl,
  Select,
  SimpleGrid,
  Stack,
  Text,
  TextInput,
  Textarea,
} from "@mantine/core";
import { DateInput } from "@mantine/dates";
import dayjs from "dayjs";
import { useMemo, useState } from "react";
import {
  useAddFundContributionMutation,
  useAddSubscriptionMutation,
  useAddTransactionMutation,
  useGetAccountsQuery,
  useGetCategoriesQuery,
  useGetFundsQuery,
  useGetPaymentMethodsQuery,
  useGetRulesQuery,
} from "../../features/api/apiSlice";
import { applyRulesToTransaction } from "../../lib/rules";
import {
  loadTransactionDefaults,
  saveTransactionDefaults,
} from "../../lib/preferences";
import { useAppSelector } from "../../app/hooks";

type QuickAddDrawerProps = {
  opened: boolean;
  onClose: () => void;
};

type QuickMode = "expense" | "income" | "fund" | "subscription";

type QuickTransactionForm = {
  type: "expense" | "income";
  date: string;
  amount: string;
  category_id: string;
  account_id: string;
  payment_method_id: string;
  notes: string;
};

type QuickFundForm = {
  fund_id: string;
  date: string;
  amount: string;
  note: string;
};

type QuickSubscriptionForm = {
  name: string;
  amount: string;
  interval_months: string;
  next_due: string;
  category_id: string;
  account_id: string;
  payment_method_id: string;
  notes: string;
};

const buildTransactionForm = (
  defaults: ReturnType<typeof loadTransactionDefaults> | null,
  type: "expense" | "income"
): QuickTransactionForm => ({
  type,
  date: dayjs().format("YYYY-MM-DD"),
  amount: "",
  category_id: defaults?.category_id ?? "",
  account_id: defaults?.account_id ?? "",
  payment_method_id: defaults?.payment_method_id ?? "",
  notes: "",
});

const buildFundForm = (): QuickFundForm => ({
  fund_id: "",
  date: dayjs().format("YYYY-MM-DD"),
  amount: "",
  note: "",
});

const buildSubscriptionForm = (): QuickSubscriptionForm => ({
  name: "",
  amount: "",
  interval_months: "1",
  next_due: dayjs().format("YYYY-MM-DD"),
  category_id: "",
  account_id: "",
  payment_method_id: "",
  notes: "",
});

export const QuickAddDrawer = ({ opened, onClose }: QuickAddDrawerProps) => {
  const userId = useAppSelector((state) => state.auth.user?.id ?? null);
  const defaults = useMemo(() => loadTransactionDefaults(userId), [userId]);

  const { data: categories = [] } = useGetCategoriesQuery();
  const { data: paymentMethods = [] } = useGetPaymentMethodsQuery();
  const { data: accounts = [] } = useGetAccountsQuery();
  const { data: funds = [] } = useGetFundsQuery();
  const { data: rules = [] } = useGetRulesQuery();

  const [addTransaction, { isLoading: isSavingTransaction }] =
    useAddTransactionMutation();
  const [addFundContribution, { isLoading: isSavingFund }] =
    useAddFundContributionMutation();
  const [addSubscription, { isLoading: isSavingSubscription }] =
    useAddSubscriptionMutation();

  const [mode, setMode] = useState<QuickMode>("expense");
  const [transactionForm, setTransactionForm] = useState<QuickTransactionForm>(
    () => buildTransactionForm(defaults, "expense")
  );
  const [fundForm, setFundForm] = useState<QuickFundForm>(() => buildFundForm());
  const [subscriptionForm, setSubscriptionForm] = useState<QuickSubscriptionForm>(
    () => buildSubscriptionForm()
  );
  const [paymentTouched, setPaymentTouched] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const resetState = () => {
    const nextDefaults = loadTransactionDefaults(userId);
    setMode("expense");
    setTransactionForm(buildTransactionForm(nextDefaults, "expense"));
    setFundForm(buildFundForm());
    setSubscriptionForm(buildSubscriptionForm());
    setPaymentTouched(false);
    setError(null);
  };

  const handleClose = () => {
    resetState();
    onClose();
  };

  const categoryOptions = useMemo(
    () =>
      categories.map((category) => ({
        value: category.id,
        label: category.name,
      })),
    [categories]
  );
  const accountOptions = useMemo(
    () =>
      accounts.map((account) => ({
        value: account.id,
        label: `${account.name} · ${account.type === "card" ? "Credit card" : account.type}`,
      })),
    [accounts]
  );
  const paymentOptions = useMemo(
    () =>
      paymentMethods.map((method) => ({
        value: method.id,
        label: method.name,
      })),
    [paymentMethods]
  );
  const fundOptions = useMemo(
    () =>
      funds.map((fund) => ({
        value: fund.id,
        label: fund.name,
      })),
    [funds]
  );

  const defaultAccountId = accounts[0]?.id ?? "";
  const effectiveAccountId = transactionForm.account_id || defaultAccountId;
  const accountForDefault = accounts.find((acc) => acc.id === effectiveAccountId);
  const defaultCardPaymentId = useMemo(() => {
    const match = paymentMethods.find((pm) => pm.name.toLowerCase().includes("card"));
    return match?.id ?? null;
  }, [paymentMethods]);
  const shouldDefaultPayment =
    !transactionForm.payment_method_id &&
    !paymentTouched &&
    accountForDefault?.type === "card" &&
    defaultCardPaymentId;
  const effectivePaymentMethodId =
    transactionForm.payment_method_id ||
    (shouldDefaultPayment ? defaultCardPaymentId : "");

  const handleModeChange = (value: string) => {
    const next = value as QuickMode;
    setMode(next);
    setError(null);
    if (next === "expense" || next === "income") {
      setTransactionForm((prev) => ({ ...prev, type: next }));
    }
  };

  const handleSaveTransaction = async () => {
    setError(null);
    if (!transactionForm.amount || Number.isNaN(Number(transactionForm.amount))) {
      setError("Enter a valid amount.");
      return;
    }
    if (!effectiveAccountId) {
      setError("Select an account to keep balances in sync.");
      return;
    }

    const ruled = applyRulesToTransaction(
      {
        notes: transactionForm.notes.trim()
          ? transactionForm.notes.trim()
          : null,
        type: transactionForm.type,
        category_id: transactionForm.category_id || null,
        tags: [],
      },
      rules
    );

    try {
      await addTransaction({
        type: transactionForm.type,
        date: transactionForm.date,
        amount: Number(transactionForm.amount),
        category_id: ruled.category_id,
        payment_method_id: effectivePaymentMethodId || null,
        account_id: effectiveAccountId || null,
        notes: transactionForm.notes.trim() ? transactionForm.notes.trim() : null,
        tags: ruled.tags,
        is_transfer: false,
        is_recurring: false,
      }).unwrap();

      saveTransactionDefaults(userId, {
        account_id: effectiveAccountId || "",
        payment_method_id: effectivePaymentMethodId || "",
        category_id: ruled.category_id ?? "",
      });
      handleClose();
    } catch {
      setError("Unable to save the transaction.");
    }
  };

  const handleSaveFundContribution = async () => {
    setError(null);
    if (!fundForm.fund_id) {
      setError("Select a fund.");
      return;
    }
    if (!fundForm.amount || Number.isNaN(Number(fundForm.amount))) {
      setError("Enter a valid amount.");
      return;
    }

    try {
      await addFundContribution({
        fund_id: fundForm.fund_id,
        date: fundForm.date,
        amount: Number(fundForm.amount),
        note: fundForm.note.trim() ? fundForm.note.trim() : null,
      }).unwrap();
      handleClose();
    } catch {
      setError("Unable to save the contribution.");
    }
  };

  const handleSaveSubscription = async () => {
    setError(null);
    if (!subscriptionForm.name.trim()) {
      setError("Enter a subscription name.");
      return;
    }
    if (!subscriptionForm.amount || Number.isNaN(Number(subscriptionForm.amount))) {
      setError("Enter a valid amount.");
      return;
    }
    if (!subscriptionForm.next_due) {
      setError("Select a next due date.");
      return;
    }

    const intervalMonths = Number(subscriptionForm.interval_months || 1);
    if (!intervalMonths || Number.isNaN(intervalMonths) || intervalMonths <= 0) {
      setError("Enter a valid billing cadence.");
      return;
    }

    try {
      await addSubscription({
        name: subscriptionForm.name.trim(),
        amount: Number(subscriptionForm.amount),
        currency: "INR",
        interval_months: intervalMonths,
        billing_anchor: subscriptionForm.next_due,
        next_due: subscriptionForm.next_due,
        last_paid: null,
        status: "active",
        category_id: subscriptionForm.category_id || null,
        account_id: subscriptionForm.account_id || null,
        payment_method_id: subscriptionForm.payment_method_id || null,
        notes: subscriptionForm.notes.trim() ? subscriptionForm.notes.trim() : null,
      }).unwrap();
      handleClose();
    } catch {
      setError("Unable to save the subscription.");
    }
  };

  const primaryActionLabel =
    mode === "fund"
      ? "Save contribution"
      : mode === "subscription"
      ? "Save subscription"
      : "Save transaction";
  const isSaving = isSavingTransaction || isSavingFund || isSavingSubscription;

  return (
    <Drawer
      opened={opened}
      onClose={handleClose}
      title="Quick add"
      position="right"
      size="lg"
      padding="md"
    >
      <Stack gap="md">
        <SegmentedControl
          value={mode}
          onChange={handleModeChange}
          data={[
            { value: "expense", label: "Expense" },
            { value: "income", label: "Income" },
            { value: "fund", label: "Fund" },
            { value: "subscription", label: "Subscription" },
          ]}
        />

        {(mode === "expense" || mode === "income") && (
          <Stack gap="sm">
            <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm">
              <TextInput
                label="Amount"
                type="number"
                value={transactionForm.amount}
                onChange={(event) =>
                  setTransactionForm((prev) => ({
                    ...prev,
                    amount: event.target.value,
                  }))
                }
                placeholder="0"
                min="0"
                step="0.01"
                required
              />
              <DateInput
                label="Date"
                value={dayjs(transactionForm.date).toDate()}
                onChange={(value) =>
                  value &&
                  setTransactionForm((prev) => ({
                    ...prev,
                    date: dayjs(value).format("YYYY-MM-DD"),
                  }))
                }
                required
              />
            </SimpleGrid>
            <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm">
              <Select
                label="Category"
                data={categoryOptions}
                value={transactionForm.category_id || null}
                onChange={(value) =>
                  setTransactionForm((prev) => ({
                    ...prev,
                    category_id: value ?? "",
                  }))
                }
                searchable
                clearable
              />
              <Select
                label="Account"
                data={accountOptions}
                value={effectiveAccountId || null}
                onChange={(value) =>
                  setTransactionForm((prev) => ({
                    ...prev,
                    account_id: value ?? "",
                  }))
                }
                required
                searchable
                clearable
              />
            </SimpleGrid>
            <Select
              label="Payment method"
              data={paymentOptions}
              value={effectivePaymentMethodId || null}
              onChange={(value) => {
                setPaymentTouched(true);
                setTransactionForm((prev) => ({
                  ...prev,
                  payment_method_id: value ?? "",
                }));
              }}
              placeholder="UPI, POS, Cash"
              clearable
              searchable
              onDropdownOpen={() => setPaymentTouched(true)}
            />
            <Textarea
              label="Notes"
              value={transactionForm.notes}
              onChange={(event) =>
                setTransactionForm((prev) => ({
                  ...prev,
                  notes: event.target.value,
                }))
              }
              placeholder="Optional details"
              minRows={2}
            />
          </Stack>
        )}

        {mode === "fund" && (
          <Stack gap="sm">
            <Select
              label="Fund"
              data={fundOptions}
              value={fundForm.fund_id || null}
              onChange={(value) =>
                setFundForm((prev) => ({ ...prev, fund_id: value ?? "" }))
              }
              required
              searchable
            />
            <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm">
              <TextInput
                label="Amount"
                type="number"
                value={fundForm.amount}
                onChange={(event) =>
                  setFundForm((prev) => ({
                    ...prev,
                    amount: event.target.value,
                  }))
                }
                placeholder="0"
                min="0"
                step="0.01"
                required
              />
              <DateInput
                label="Date"
                value={dayjs(fundForm.date).toDate()}
                onChange={(value) =>
                  value &&
                  setFundForm((prev) => ({
                    ...prev,
                    date: dayjs(value).format("YYYY-MM-DD"),
                  }))
                }
                required
              />
            </SimpleGrid>
            <Textarea
              label="Note"
              value={fundForm.note}
              onChange={(event) =>
                setFundForm((prev) => ({ ...prev, note: event.target.value }))
              }
              placeholder="Optional note"
              minRows={2}
            />
          </Stack>
        )}

        {mode === "subscription" && (
          <Stack gap="sm">
            <TextInput
              label="Subscription name"
              value={subscriptionForm.name}
              onChange={(event) =>
                setSubscriptionForm((prev) => ({
                  ...prev,
                  name: event.target.value,
                }))
              }
              placeholder="Netflix, Spotify"
              required
            />
            <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm">
              <TextInput
                label="Amount"
                type="number"
                value={subscriptionForm.amount}
                onChange={(event) =>
                  setSubscriptionForm((prev) => ({
                    ...prev,
                    amount: event.target.value,
                  }))
                }
                placeholder="0"
                min="0"
                step="0.01"
                required
              />
              <Select
                label="Cadence"
                value={subscriptionForm.interval_months}
                data={[
                  { value: "1", label: "Monthly" },
                  { value: "12", label: "Yearly" },
                ]}
                onChange={(value) =>
                  setSubscriptionForm((prev) => ({
                    ...prev,
                    interval_months: value ?? "1",
                  }))
                }
                required
              />
            </SimpleGrid>
            <DateInput
              label="Next due"
              value={dayjs(subscriptionForm.next_due).toDate()}
              onChange={(value) =>
                value &&
                setSubscriptionForm((prev) => ({
                  ...prev,
                  next_due: dayjs(value).format("YYYY-MM-DD"),
                }))
              }
              required
            />
            <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm">
              <Select
                label="Category"
                data={categoryOptions}
                value={subscriptionForm.category_id || null}
                onChange={(value) =>
                  setSubscriptionForm((prev) => ({
                    ...prev,
                    category_id: value ?? "",
                  }))
                }
                searchable
                clearable
              />
              <Select
                label="Account"
                data={accountOptions}
                value={subscriptionForm.account_id || null}
                onChange={(value) =>
                  setSubscriptionForm((prev) => ({
                    ...prev,
                    account_id: value ?? "",
                  }))
                }
                searchable
                clearable
              />
            </SimpleGrid>
            <Select
              label="Payment method"
              data={paymentOptions}
              value={subscriptionForm.payment_method_id || null}
              onChange={(value) =>
                setSubscriptionForm((prev) => ({
                  ...prev,
                  payment_method_id: value ?? "",
                }))
              }
              searchable
              clearable
            />
            <Textarea
              label="Notes"
              value={subscriptionForm.notes}
              onChange={(event) =>
                setSubscriptionForm((prev) => ({
                  ...prev,
                  notes: event.target.value,
                }))
              }
              placeholder="Optional details"
              minRows={2}
            />
          </Stack>
        )}

        {error ? (
          <Alert color="red" variant="light">
            {error}
          </Alert>
        ) : null}

        <Group justify="space-between">
          <Text size="xs" c="dimmed">
            Quick add uses smart defaults for account, payment, and category.
          </Text>
          <Group gap="sm">
            <Button variant="subtle" color="gray" onClick={handleClose}>
              Cancel
            </Button>
            <Button
              color="green"
              loading={isSaving}
              onClick={() => {
                if (mode === "fund") {
                  void handleSaveFundContribution();
                } else if (mode === "subscription") {
                  void handleSaveSubscription();
                } else {
                  void handleSaveTransaction();
                }
              }}
            >
              {primaryActionLabel}
            </Button>
          </Group>
        </Group>
      </Stack>
    </Drawer>
  );
};
