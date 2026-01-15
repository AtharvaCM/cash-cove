import { Button, Group, Modal, Select, Stack, Text, TextInput } from "@mantine/core";
import { useState } from "react";
import { useUpdateAccountMutation } from "../../features/api/apiSlice";
import type { Account } from "../../types/finance";
import { formatINR } from "../../lib/format";

type PayCardModalProps = {
  opened: boolean;
  onClose: () => void;
  accounts: Account[];
};

const defaultAmountForCard = (card?: Account | null) => {
  if (!card) {
    return "";
  }
  const balance = Number(card.current_balance ?? 0);
  if (balance < 0) {
    return String(Math.abs(balance));
  }
  return "";
};

export const PayCardModal = ({ opened, onClose, accounts }: PayCardModalProps) => {
  const [form, setForm] = useState({
    fromAccountId: "",
    cardAccountId: "",
    amount: "",
  });
  const [error, setError] = useState<string | null>(null);
  const [updateAccount, { isLoading }] = useUpdateAccountMutation();

  const bankLikeAccounts = accounts.filter(
    (acc) => acc.type === "bank" || acc.type === "cash" || acc.type === "wallet"
  );
  const cardAccounts = accounts.filter((acc) => acc.type === "card");

  const handleClose = () => {
    setForm({ fromAccountId: "", cardAccountId: "", amount: "" });
    setError(null);
    onClose();
  };

  const handlePayCard = async () => {
    setError(null);
    const amount = form.amount ? Number(form.amount) : 0;
    if (!form.fromAccountId || !form.cardAccountId) {
      setError("Choose both accounts.");
      return;
    }
    if (!amount || Number.isNaN(amount) || amount <= 0) {
      setError("Enter a valid amount.");
      return;
    }
    const from = accounts.find((a) => a.id === form.fromAccountId);
    const card = accounts.find((a) => a.id === form.cardAccountId);
    if (!from || !card) {
      setError("Accounts not found.");
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
      handleClose();
    } catch {
      setError("Unable to record card payment.");
    }
  };

  return (
    <Modal
      opened={opened}
      onClose={handleClose}
      title="Pay credit card"
      size="md"
    >
      <Stack gap="sm">
        <Select
          label="From account (bank/cash)"
          data={bankLikeAccounts.map((acc) => ({
            value: acc.id,
            label: `${acc.name} · ${formatINR(acc.current_balance ?? 0)}`,
          }))}
          value={form.fromAccountId || null}
          onChange={(value) =>
            setForm((prev) => ({ ...prev, fromAccountId: value ?? "" }))
          }
          placeholder="Select source"
        />
        <Select
          label="Card account"
          data={cardAccounts.map((acc) => ({
            value: acc.id,
            label: `${acc.name} · ${formatINR(acc.current_balance ?? 0)}`,
          }))}
          value={form.cardAccountId || null}
          onChange={(value) => {
            const nextId = value ?? "";
            const nextCard = accounts.find((acc) => acc.id === nextId);
            setForm((prev) => {
              if (prev.cardAccountId === nextId) {
                return prev;
              }
              return {
                ...prev,
                cardAccountId: nextId,
                amount: defaultAmountForCard(nextCard),
              };
            });
          }}
          placeholder="Select card"
        />
        <TextInput
          label="Amount"
          type="number"
          value={form.amount}
          onChange={(event) =>
            setForm((prev) => ({ ...prev, amount: event.target.value }))
          }
          placeholder="0"
          min="0"
          step="0.01"
        />
        {error ? (
          <Text size="sm" c="red">
            {error}
          </Text>
        ) : null}
        <Group justify="flex-end">
          <Button variant="subtle" color="gray" onClick={handleClose}>
            Cancel
          </Button>
          <Button onClick={handlePayCard} loading={isLoading} color="green">
            Save payment
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
};
