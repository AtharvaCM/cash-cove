import {
  Button,
  Group,
  Modal,
  Select,
  Stack,
  Text,
  TextInput,
} from "@mantine/core";
import { useState } from "react";
import { useUpdateAccountMutation } from "../../features/api/apiSlice";
import type { Account } from "../../types/finance";
import { formatINR } from "../../lib/format";

type TransferModalProps = {
  opened: boolean;
  onClose: () => void;
  accounts: Account[];
};

export const TransferModal = ({ opened, onClose, accounts }: TransferModalProps) => {
  const [fromId, setFromId] = useState("");
  const [toId, setToId] = useState("");
  const [amount, setAmount] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [updateAccount, { isLoading }] = useUpdateAccountMutation();

  const handleTransfer = async () => {
    setError(null);
    const parsed = Number(amount);
    if (!fromId || !toId || fromId === toId) {
      setError("Choose distinct source and destination accounts.");
      return;
    }
    if (!parsed || Number.isNaN(parsed) || parsed <= 0) {
      setError("Enter a valid amount.");
      return;
    }
    const from = accounts.find((acc) => acc.id === fromId);
    const to = accounts.find((acc) => acc.id === toId);
    if (!from || !to) {
      setError("Accounts not found.");
      return;
    }
    try {
      await updateAccount({
        id: from.id,
        name: from.name,
        type: from.type,
        currency: from.currency,
        current_balance: from.current_balance - parsed,
      }).unwrap();
      await updateAccount({
        id: to.id,
        name: to.name,
        type: to.type,
        currency: to.currency,
        current_balance: to.current_balance + parsed,
      }).unwrap();
      onClose();
      setFromId("");
      setToId("");
      setAmount("");
    } catch {
      setError("Unable to complete transfer.");
    }
  };

  const accountOptions = accounts.map((acc) => ({
    value: acc.id,
    label: `${acc.name} · ${acc.type} (${formatINR(acc.current_balance ?? 0)})`,
  }));

  return (
    <Modal opened={opened} onClose={onClose} title="Transfer" size="md">
      <Stack gap="sm">
        <Select
          label="From account"
          data={accountOptions}
          value={fromId || null}
          onChange={(value) => setFromId(value ?? "")}
          searchable
        />
        <Select
          label="To account"
          data={accountOptions}
          value={toId || null}
          onChange={(value) => setToId(value ?? "")}
          searchable
        />
        <TextInput
          label="Amount"
          type="number"
          value={amount}
          onChange={(event) => setAmount(event.target.value)}
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
          <Button variant="subtle" color="gray" onClick={onClose}>
            Cancel
          </Button>
          <Button color="green" onClick={handleTransfer} loading={isLoading}>
            Transfer
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
};
