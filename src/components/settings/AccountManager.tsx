import {
  ActionIcon,
  Button,
  Group,
  Modal,
  ScrollArea,
  Select,
  Stack,
  Table,
  Text,
  TextInput,
} from "@mantine/core";
import { useState } from "react";
import { Pencil, Plus, Trash } from "lucide-react";
import {
  useAddAccountMutation,
  useDeleteAccountMutation,
  useGetAccountsQuery,
  useUpdateAccountMutation,
} from "../../features/api/apiSlice";
import type { Account } from "../../types/finance";
import { ConfirmDeleteModal } from "./ConfirmDeleteModal";
import { SectionCard } from "./SectionCard";

const ACCOUNT_TYPES = [
  { value: "bank", label: "Bank (incl. debit cards)" },
  { value: "card", label: "Credit card" },
  { value: "wallet", label: "Wallet" },
  { value: "cash", label: "Cash" },
  { value: "other", label: "Other" },
];

export const AccountManager = () => {
  const { data: accounts = [] } = useGetAccountsQuery();
  const [addAccount, { isLoading: isSaving }] = useAddAccountMutation();
  const [updateAccount, { isLoading: isUpdating }] =
    useUpdateAccountMutation();
  const [deleteAccount, { isLoading: isDeleting }] =
    useDeleteAccountMutation();

  const [modalOpen, setModalOpen] = useState(false);
  const [mode, setMode] = useState<"create" | "edit">("create");
  const [editing, setEditing] = useState<Account | null>(null);
  const [form, setForm] = useState({
    name: "",
    type: "bank" as Account["type"],
    current_balance: "",
    currency: "INR",
  });
  const [error, setError] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [payModalOpen, setPayModalOpen] = useState(false);
  const [payForm, setPayForm] = useState({
    fromAccountId: "",
    cardAccountId: "",
    amount: "",
  });
  const [payError, setPayError] = useState<string | null>(null);

  const openCreate = () => {
    setMode("create");
    setEditing(null);
    setForm({ name: "", type: "bank", current_balance: "", currency: "INR" });
    setError(null);
    setModalOpen(true);
  };

  const openEdit = (account: Account) => {
    setMode("edit");
    setEditing(account);
    setForm({
      name: account.name,
      type: account.type,
      current_balance: String(account.current_balance ?? 0),
      currency: account.currency ?? "INR",
    });
    setError(null);
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) {
      setError("Name is required.");
      return;
    }
    const balance = form.current_balance ? Number(form.current_balance) : 0;
    if (Number.isNaN(balance)) {
      setError("Enter a valid balance.");
      return;
    }
    const payload = {
      name: form.name.trim(),
      type: form.type,
      current_balance: balance,
      currency: form.currency || "INR",
    };
    try {
      if (mode === "edit" && editing) {
        await updateAccount({ id: editing.id, ...payload }).unwrap();
      } else {
        await addAccount(payload).unwrap();
      }
      setModalOpen(false);
    } catch {
      setError("Unable to save account.");
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteId) return;
    await deleteAccount({ id: deleteId }).unwrap();
    setDeleteId(null);
  };

  const bankLikeAccounts = accounts.filter(
    (acc) => acc.type === "bank" || acc.type === "cash" || acc.type === "wallet"
  );
  const cardAccounts = accounts.filter((acc) => acc.type === "card");

  const handlePayCard = async () => {
    setPayError(null);
    const amount = payForm.amount ? Number(payForm.amount) : 0;
    if (!payForm.fromAccountId || !payForm.cardAccountId) {
      setPayError("Choose both accounts.");
      return;
    }
    if (!amount || Number.isNaN(amount) || amount <= 0) {
      setPayError("Enter a valid amount.");
      return;
    }
    const from = accounts.find((a) => a.id === payForm.fromAccountId);
    const card = accounts.find((a) => a.id === payForm.cardAccountId);
    if (!from || !card) {
      setPayError("Accounts not found.");
      return;
    }
    try {
      await updateAccount({
        id: from.id,
        name: from.name,
        type: from.type,
        currency: from.currency,
        current_balance: from.current_balance - amount,
      }).unwrap();
      await updateAccount({
        id: card.id,
        name: card.name,
        type: card.type,
        currency: card.currency,
        current_balance: card.current_balance + amount,
      }).unwrap();
      setPayModalOpen(false);
      setPayForm({ fromAccountId: "", cardAccountId: "", amount: "" });
    } catch {
      setPayError("Unable to record card payment.");
    }
  };

  return (
    <>
      <SectionCard
        title="Accounts"
        description="Track bank, credit card, wallet, or cash balances for coverage. Debit cards share your bank account balance."
        badge={`${accounts.length} total`}
      >
        <Group justify="space-between" mb="sm">
          <Text size="sm" c="dimmed">
            Use this to check fund coverage vs. real balances.
          </Text>
          <Group gap="xs">
            <Button
              onClick={() => setPayModalOpen(true)}
              leftSection={<Pencil size={16} strokeWidth={2} />}
              variant="light"
              disabled={bankLikeAccounts.length === 0 || cardAccounts.length === 0}
            >
              Pay card
            </Button>
            <Button onClick={openCreate} leftSection={<Plus size={16} strokeWidth={2} />}>
              New account
            </Button>
          </Group>
        </Group>
        <ScrollArea h={220}>
          <Table horizontalSpacing="md" verticalSpacing="sm" highlightOnHover>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Name</Table.Th>
                <Table.Th>Type</Table.Th>
                <Table.Th>Balance</Table.Th>
                <Table.Th></Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {accounts.map((account) => (
                <Table.Tr key={account.id}>
                  <Table.Td>{account.name}</Table.Td>
                  <Table.Td>{account.type}</Table.Td>
                  <Table.Td>{account.current_balance.toLocaleString()}</Table.Td>
                  <Table.Td width={120}>
                    <Group gap={6} justify="flex-end">
                      <ActionIcon
                        variant="subtle"
                        color="blue"
                        onClick={() => openEdit(account)}
                        aria-label="Edit account"
                      >
                        <Pencil size={16} strokeWidth={2} />
                      </ActionIcon>
                      <ActionIcon
                        variant="subtle"
                        color="red"
                        onClick={() => setDeleteId(account.id)}
                        aria-label="Delete account"
                      >
                        <Trash size={16} strokeWidth={2} />
                      </ActionIcon>
                    </Group>
                  </Table.Td>
                </Table.Tr>
              ))}
              {accounts.length === 0 ? (
                <Table.Tr>
                  <Table.Td colSpan={4}>
                    <Text size="sm" c="dimmed">
                      No accounts yet.
                    </Text>
                  </Table.Td>
                </Table.Tr>
              ) : null}
            </Table.Tbody>
          </Table>
        </ScrollArea>
      </SectionCard>

      <Modal
        opened={modalOpen}
        onClose={() => setModalOpen(false)}
        title={mode === "edit" ? "Edit account" : "New account"}
        size="md"
      >
        <Stack gap="sm">
          <TextInput
            label="Name"
            value={form.name}
            onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
            placeholder="e.g., HDFC Savings"
            required
          />
          <Select
            label="Type"
            data={ACCOUNT_TYPES}
            value={form.type}
            onChange={(value) =>
              setForm((prev) => ({ ...prev, type: (value as Account["type"]) ?? "bank" }))
            }
          />
          <TextInput
            label="Current balance"
            type="number"
            value={form.current_balance}
            onChange={(event) =>
              setForm((prev) => ({ ...prev, current_balance: event.target.value }))
            }
            placeholder="0"
            step="0.01"
          />
          <TextInput
            label="Currency"
            value={form.currency}
            onChange={(event) => setForm((prev) => ({ ...prev, currency: event.target.value }))}
          />
          {error ? (
            <Text size="sm" c="red">
              {error}
            </Text>
          ) : null}
          <Group justify="flex-end">
            <Button variant="subtle" color="gray" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} loading={isSaving || isUpdating} color="green">
              Save
            </Button>
          </Group>
        </Stack>
      </Modal>

      <ConfirmDeleteModal
        opened={Boolean(deleteId)}
        onClose={() => setDeleteId(null)}
        onConfirm={handleConfirmDelete}
        loading={isDeleting}
        title="Delete account?"
        message="Existing transactions using this account will lose that link."
      />

      <Modal
        opened={payModalOpen}
        onClose={() => setPayModalOpen(false)}
        title="Pay credit card"
        size="md"
      >
        <Stack gap="sm">
          <Select
            label="From account (bank/cash)"
            data={bankLikeAccounts.map((acc) => ({
              value: acc.id,
              label: `${acc.name} · ${acc.current_balance.toLocaleString()}`,
            }))}
            value={payForm.fromAccountId || null}
            onChange={(value) =>
              setPayForm((prev) => ({ ...prev, fromAccountId: value ?? "" }))
            }
            placeholder="Select source"
          />
          <Select
            label="Card account"
            data={cardAccounts.map((acc) => ({
              value: acc.id,
              label: `${acc.name} · ${acc.current_balance.toLocaleString()}`,
            }))}
            value={payForm.cardAccountId || null}
            onChange={(value) =>
              setPayForm((prev) => ({ ...prev, cardAccountId: value ?? "" }))
            }
            placeholder="Select card"
          />
          <TextInput
            label="Amount"
            type="number"
            value={payForm.amount}
            onChange={(event) =>
              setPayForm((prev) => ({ ...prev, amount: event.target.value }))
            }
            placeholder="0"
            min="0"
            step="0.01"
          />
          {payError ? (
            <Text size="sm" c="red">
              {payError}
            </Text>
          ) : null}
          <Group justify="flex-end">
            <Button variant="subtle" color="gray" onClick={() => setPayModalOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handlePayCard} loading={isUpdating}>
              Save payment
            </Button>
          </Group>
        </Stack>
      </Modal>
    </>
  );
};
