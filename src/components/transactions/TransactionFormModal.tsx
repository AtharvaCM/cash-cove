import {
  Alert,
  Accordion,
  Button,
  Checkbox,
  Group,
  Modal,
  Select,
  SimpleGrid,
  Stack,
  Text,
  Textarea,
  TextInput,
} from "@mantine/core";
import { DateInput } from "@mantine/dates";
import { useMemo, useState } from "react";
import type { ChangeEvent, FormEvent } from "react";
import dayjs from "dayjs";
import {
  useAddTransactionMutation,
  useDeleteTransactionMutation,
  useGetRulesQuery,
  useUpdateTransactionMutation,
} from "../../features/api/apiSlice";
import { useAppSelector } from "../../app/hooks";
import { formatINR } from "../../lib/format";
import { applyRulesToTransaction } from "../../lib/rules";
import {
  loadTransactionDefaults,
  saveTransactionDefaults,
  type TransactionDefaults,
} from "../../lib/preferences";
import type {
  Account,
  Category,
  PaymentMethod,
  Transaction,
} from "../../types/finance";

type TransactionFormModalProps = {
  opened: boolean;
  onClose: () => void;
  transaction?: Transaction | null;
  categories: Category[];
  paymentMethods: PaymentMethod[];
  accounts: Account[];
};

const buildInitialForm = (
  transaction?: Transaction | null,
  defaults?: TransactionDefaults | null
) => ({
  type: transaction?.type ?? "expense",
  date: transaction?.date ?? dayjs().format("YYYY-MM-DD"),
  amount: transaction ? String(transaction.amount) : "",
  category_id: transaction?.category_id ?? defaults?.category_id ?? "",
  payment_method_id:
    transaction?.payment_method_id ?? defaults?.payment_method_id ?? "",
  account_id: transaction?.account_id ?? defaults?.account_id ?? "",
  notes: transaction?.notes ?? "",
  tags: transaction?.tags?.length
    ? transaction.tags.map((tag) => tag.name).join(", ")
    : "",
  reimbursement_category_id: transaction?.reimbursement_category_id ?? "",
  is_recurring: transaction?.is_recurring ?? false,
  is_transfer: transaction?.is_transfer ?? false,
  is_reimbursement: transaction?.is_reimbursement ?? false,
});

export const TransactionFormModal = ({
  opened,
  onClose,
  transaction,
  categories,
  paymentMethods,
  accounts,
}: TransactionFormModalProps) => {
  const mode = transaction ? "edit" : "create";
  const userId = useAppSelector((state) => state.auth.user?.id ?? null);
  const defaults = useMemo(
    () => (transaction ? null : loadTransactionDefaults(userId)),
    [transaction, userId]
  );
  const [form, setForm] = useState(() => buildInitialForm(transaction, defaults));
  const [error, setError] = useState<string | null>(null);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [paymentTouched, setPaymentTouched] = useState(false);

  const [addTransaction, { isLoading: isSaving }] = useAddTransactionMutation();
  const [updateTransaction, { isLoading: isUpdating }] =
    useUpdateTransactionMutation();
  const [deleteTransaction, { isLoading: isDeleting }] =
    useDeleteTransactionMutation();
  const { data: rules = [] } = useGetRulesQuery();

  const categoryMap = useMemo(
    () => new Map(categories.map((category) => [category.id, category.name])),
    [categories]
  );
  const categoryOptions = useMemo(
    () =>
      categories.map((category) => ({
        value: category.id,
        label: category.name,
      })),
    [categories]
  );
  const expenseCategoryOptions = useMemo(
    () =>
      categories
        .filter((category) => category.type === "expense")
        .map((category) => ({
          value: category.id,
          label: category.name,
        })),
    [categories]
  );
  const paymentOptions = useMemo(
    () =>
      paymentMethods.map((method) => ({
        value: method.id,
        label: method.name,
      })),
    [paymentMethods]
  );
  const accountOptions = useMemo(
    () =>
      accounts.map((account) => ({
        value: account.id,
        label: `${account.name} · ${account.type === "card" ? "Credit card" : account.type}`,
      })),
    [accounts]
  );
  const defaultCardPaymentId = useMemo(() => {
    const match = paymentMethods.find((pm) => pm.name.toLowerCase().includes("card"));
    return match?.id ?? null;
  }, [paymentMethods]);
  const defaultAccountId = accounts[0]?.id ?? "";
  const effectiveAccountId = form.account_id || defaultAccountId;
  const accountForDefault = accounts.find((acc) => acc.id === effectiveAccountId);
  const shouldDefaultPayment =
    !form.payment_method_id &&
    !paymentTouched &&
    accountForDefault?.type === "card" &&
    defaultCardPaymentId;
  const effectivePaymentMethodId =
    form.payment_method_id || (shouldDefaultPayment ? defaultCardPaymentId : "");
  const isReimbursementIncome = form.type === "income" && form.is_reimbursement;
  const shouldShowAdvanced =
    Boolean(form.tags.trim()) ||
    Boolean(form.notes.trim()) ||
    form.is_recurring ||
    form.is_transfer ||
    form.is_reimbursement ||
    Boolean(form.reimbursement_category_id);

  const handleChange = (
    event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = event.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);

    const selectedAccount = accounts.find((acc) => acc.id === effectiveAccountId);
    const selectedPayment = paymentMethods.find(
      (pm) => pm.id === effectivePaymentMethodId
    );
    const reimbursementCategoryId = isReimbursementIncome
      ? form.reimbursement_category_id || null
      : null;

    if (!form.amount || Number.isNaN(Number(form.amount))) {
      setError("Enter a valid amount.");
      return;
    }

    if (!effectiveAccountId) {
      setError("Select an account to keep balances in sync.");
      return;
    }

    if (isReimbursementIncome && !reimbursementCategoryId) {
      setError("Select an expense category to offset.");
      return;
    }

    if (
      selectedAccount?.type === "card" &&
      effectivePaymentMethodId &&
      !selectedPayment?.name.toLowerCase().includes("card")
    ) {
      setError("Card accounts should use a card/pos payment method.");
      return;
    }

    try {
      const baseTags = form.tags
        .split(",")
        .map((tag) => tag.trim())
        .filter(Boolean);
      const ruled = applyRulesToTransaction(
        {
          notes: form.notes.trim() ? form.notes.trim() : null,
          type: form.type,
          category_id: isReimbursementIncome ? null : form.category_id || null,
          tags: baseTags,
        },
        rules
      );
      const payload = {
        type: form.type,
        date: form.date,
        amount: Number(form.amount),
        category_id: isReimbursementIncome ? null : ruled.category_id,
        reimbursement_category_id: reimbursementCategoryId,
        payment_method_id: effectivePaymentMethodId || null,
        account_id: effectiveAccountId || null,
        notes: form.notes.trim() ? form.notes.trim() : null,
        tags: ruled.tags,
        is_transfer: form.is_transfer,
        is_recurring: form.is_recurring,
        is_reimbursement: isReimbursementIncome,
      };

      if (transaction?.id) {
        await updateTransaction({
          id: transaction.id,
          ...payload,
        }).unwrap();
      } else {
        await addTransaction(payload).unwrap();
      }

      if (!isReimbursementIncome) {
        saveTransactionDefaults(userId, {
          account_id: effectiveAccountId || "",
          payment_method_id: effectivePaymentMethodId || "",
          category_id: ruled.category_id ?? "",
        });
      }
      onClose();
    } catch {
      setError(
        mode === "edit"
          ? "Unable to update the transaction."
          : "Unable to save the transaction."
      );
    }
  };

  const handleOpenDelete = () => {
    if (!transaction) {
      return;
    }
    setDeleteError(null);
    setIsDeleteOpen(true);
  };

  const handleCloseDelete = () => {
    setIsDeleteOpen(false);
  };

  const handleConfirmDelete = async () => {
    if (!transaction) {
      return;
    }

    try {
      await deleteTransaction({ id: transaction.id }).unwrap();
      setIsDeleteOpen(false);
      onClose();
    } catch {
      setDeleteError("Unable to delete the transaction.");
    }
  };

  return (
    <>
      <Modal
        opened={opened}
        onClose={onClose}
        title={mode === "edit" ? "Edit transaction" : "Add transaction"}
        size="lg"
      >
        <Stack component="form" gap="sm" onSubmit={handleSubmit}>
          <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm">
            <Select
              label="Type"
              data={[
                { value: "expense", label: "Expense" },
                { value: "income", label: "Income" },
              ]}
              value={form.type}
              onChange={(value) =>
                setForm((prev) => {
                  const nextType = (value ?? "expense") as "expense" | "income";
                  if (nextType === "income") {
                    return { ...prev, type: nextType };
                  }
                  return {
                    ...prev,
                    type: nextType,
                    is_reimbursement: false,
                    reimbursement_category_id: "",
                  };
                })
              }
              allowDeselect={false}
            />
            <DateInput
              label="Date"
              value={dayjs(form.date).toDate()}
              onChange={(value) =>
                value &&
                setForm((prev) => ({
                  ...prev,
                  date: dayjs(value).format("YYYY-MM-DD"),
                }))
              }
              required
            />
          </SimpleGrid>
          <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm">
            <TextInput
              label="Amount"
              type="number"
              name="amount"
              value={form.amount}
              onChange={handleChange}
              placeholder="0"
              min="0"
              step="0.01"
              required
            />
            <Select
              label={isReimbursementIncome ? "Offset category" : "Category"}
              data={isReimbursementIncome ? expenseCategoryOptions : categoryOptions}
              value={
                isReimbursementIncome
                  ? form.reimbursement_category_id || null
                  : form.category_id || null
              }
              onChange={(value) =>
                setForm((prev) =>
                  isReimbursementIncome
                    ? { ...prev, reimbursement_category_id: value ?? "" }
                    : { ...prev, category_id: value ?? "" }
                )
              }
              placeholder="Select"
              clearable={!isReimbursementIncome}
              required={isReimbursementIncome}
            />
          </SimpleGrid>
          <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm">
            <Select
              label="Account (bank/card/wallet)"
              data={accountOptions}
              value={effectiveAccountId || null}
              onChange={(value) =>
                setForm((prev) => ({ ...prev, account_id: value ?? "" }))
              }
              placeholder="Select"
              required
              searchable
              clearable
            />
            <Select
              label="Payment method (channel)"
              data={paymentOptions}
              value={effectivePaymentMethodId || null}
              onChange={(value) => {
                setPaymentTouched(true);
                setForm((prev) => ({ ...prev, payment_method_id: value ?? "" }));
              }}
              placeholder="e.g., UPI, POS, Cash"
              clearable
              onDropdownOpen={() => setPaymentTouched(true)}
            />
          </SimpleGrid>
          <Accordion
            variant="separated"
            radius="md"
            defaultValue={shouldShowAdvanced ? "advanced" : undefined}
          >
            <Accordion.Item value="advanced">
              <Accordion.Control>Advanced options</Accordion.Control>
              <Accordion.Panel>
                <Stack gap="sm">
                  <TextInput
                    label="Tags"
                    name="tags"
                    value={form.tags}
                    onChange={handleChange}
                    placeholder="food, weekend, work"
                  />
                  {form.type === "income" ? (
                    <Checkbox
                      label="This income is a reimbursement/refund"
                      checked={form.is_reimbursement}
                      onChange={(event) => {
                        const checked = event.currentTarget.checked;
                        setForm((prev) => ({
                          ...prev,
                          is_reimbursement: checked,
                          is_transfer: checked ? false : prev.is_transfer,
                          reimbursement_category_id: checked
                            ? prev.reimbursement_category_id || prev.category_id || ""
                            : "",
                        }));
                      }}
                    />
                  ) : null}
                  <Checkbox
                    label="Exclude from budgets/income (transfer, internal move)"
                    checked={form.is_transfer}
                    onChange={(event) =>
                      setForm((prev) => ({
                        ...prev,
                        is_transfer: event?.currentTarget?.checked ?? false,
                        is_reimbursement: event?.currentTarget?.checked
                          ? false
                          : prev.is_reimbursement,
                        reimbursement_category_id: event?.currentTarget?.checked
                          ? ""
                          : prev.reimbursement_category_id,
                      }))
                    }
                  />
                  <Checkbox
                    label="Mark as recurring (monthly)"
                    checked={form.is_recurring}
                    onChange={(event) =>
                      setForm((prev) => ({
                        ...prev,
                        is_recurring: event?.currentTarget?.checked ?? false,
                      }))
                    }
                  />
                  <Textarea
                    label="Notes"
                    name="notes"
                    value={form.notes}
                    onChange={handleChange}
                    placeholder="Optional details"
                    minRows={2}
                  />
                </Stack>
              </Accordion.Panel>
            </Accordion.Item>
          </Accordion>
          {error ? (
            <Alert color="red" variant="light">
              {error}
            </Alert>
          ) : null}
          <Group justify="flex-end">
            <Button variant="subtle" color="gray" onClick={onClose}>
              Cancel
            </Button>
            {mode === "edit" ? (
              <Button variant="light" color="red" onClick={handleOpenDelete}>
                Delete
              </Button>
            ) : null}
            <Button
              type="submit"
              loading={isSaving || isUpdating}
              color="green"
            >
              {mode === "edit" ? "Save changes" : "Save transaction"}
            </Button>
          </Group>
        </Stack>
      </Modal>

      <Modal
        opened={isDeleteOpen}
        onClose={handleCloseDelete}
        title="Delete transaction"
        size="sm"
      >
        <Stack gap="sm">
          <Text size="sm">
            Delete the{" "}
            <Text component="span" fw={600}>
              {formatINR(transaction?.amount ?? 0)}
            </Text>{" "}
            {transaction?.type === "expense" ? "expense" : "income"} from{" "}
            <Text component="span" fw={600}>
              {transaction?.category_id
                ? categoryMap.get(transaction.category_id) ?? "this category"
                : "Uncategorized"}
            </Text>
            ?
          </Text>
          {deleteError ? (
            <Alert color="red" variant="light">
              {deleteError}
            </Alert>
          ) : null}
          <Group justify="flex-end">
            <Button variant="subtle" color="gray" onClick={handleCloseDelete}>
              Cancel
            </Button>
            <Button
              color="red"
              loading={isDeleting}
              onClick={handleConfirmDelete}
            >
              Delete transaction
            </Button>
          </Group>
        </Stack>
      </Modal>
    </>
  );
};
