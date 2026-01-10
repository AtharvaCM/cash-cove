import {
  Alert,
  Button,
  Group,
  Modal,
  Select,
  SimpleGrid,
  Stack,
  TextInput,
  Textarea,
} from "@mantine/core";
import { DateInput } from "@mantine/dates";
import { useState } from "react";
import type { FormEvent } from "react";
import {
  useAddFundMutation,
  useUpdateFundMutation,
} from "../../features/api/apiSlice";
import { FUND_TYPES } from "../../lib/fundOptions";
import type { Fund } from "../../types/finance";

type FundFormModalProps = {
  opened: boolean;
  onClose: () => void;
  fund?: Fund | null;
};

const buildInitialFundForm = (fund?: Fund | null) => ({
  name: fund?.name ?? "",
  type: fund?.type ?? "car",
  target_amount: fund ? String(fund.target_amount ?? 0) : "",
  current_amount: fund ? String(fund.current_amount ?? 0) : "",
  monthly_contribution:
    fund?.monthly_contribution === null || fund?.monthly_contribution === undefined
      ? ""
      : String(fund.monthly_contribution),
  target_date: fund?.target_date ?? "",
  notes: fund?.notes ?? "",
});

export const FundFormModal = ({ opened, onClose, fund }: FundFormModalProps) => {
  const [fundForm, setFundForm] = useState(() => buildInitialFundForm(fund));
  const [fundError, setFundError] = useState<string | null>(null);
  const [addFund, { isLoading: isSavingFund }] = useAddFundMutation();
  const [updateFund, { isLoading: isUpdatingFund }] = useUpdateFundMutation();

  const handleFundSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setFundError(null);

    if (!fundForm.name.trim()) {
      setFundError("Enter a name for the fund.");
      return;
    }

    if (!fundForm.target_amount || Number.isNaN(Number(fundForm.target_amount))) {
      setFundError("Enter a valid target amount.");
      return;
    }

    const targetAmount = Number(fundForm.target_amount);
    const currentAmount = fundForm.current_amount
      ? Number(fundForm.current_amount)
      : 0;
    const monthlyContribution = fundForm.monthly_contribution
      ? Number(fundForm.monthly_contribution)
      : null;

    if (Number.isNaN(targetAmount) || targetAmount < 0) {
      setFundError("Target amount must be 0 or more.");
      return;
    }

    if (Number.isNaN(currentAmount) || currentAmount < 0) {
      setFundError("Current amount must be 0 or more.");
      return;
    }

    if (
      monthlyContribution !== null &&
      (Number.isNaN(monthlyContribution) || monthlyContribution < 0)
    ) {
      setFundError("Monthly contribution must be 0 or more.");
      return;
    }

    try {
      const payload = {
        name: fundForm.name.trim(),
        type: fundForm.type as Fund["type"],
        target_amount: targetAmount,
        current_amount: currentAmount,
        monthly_contribution: monthlyContribution,
        target_date: fundForm.target_date || null,
        notes: fundForm.notes.trim() ? fundForm.notes.trim() : null,
      };

      if (fund?.id) {
        await updateFund({ id: fund.id, ...payload }).unwrap();
      } else {
        await addFund(payload).unwrap();
      }

      onClose();
    } catch {
      setFundError(fund?.id ? "Unable to update the fund." : "Unable to save the fund.");
    }
  };

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={fund?.id ? "Edit fund" : "Create fund"}
      size="lg"
    >
      <Stack component="form" gap="sm" onSubmit={handleFundSubmit}>
        <TextInput
          label="Fund name"
          placeholder="Car down payment"
          value={fundForm.name}
          onChange={(event) =>
            setFundForm((prev) => ({ ...prev, name: event.target.value }))
          }
          required
        />
        <Select
          label="Fund type"
          data={FUND_TYPES}
          value={fundForm.type}
          onChange={(value) =>
            setFundForm((prev) => ({
              ...prev,
              type: (value ?? "car") as Fund["type"],
            }))
          }
          allowDeselect={false}
        />
        <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm">
          <TextInput
            label="Target amount"
            type="number"
            value={fundForm.target_amount}
            onChange={(event) =>
              setFundForm((prev) => ({
                ...prev,
                target_amount: event.target.value,
              }))
            }
            placeholder="0"
            min="0"
            step="0.01"
            required
          />
          <TextInput
            label="Current amount"
            type="number"
            value={fundForm.current_amount}
            onChange={(event) =>
              setFundForm((prev) => ({
                ...prev,
                current_amount: event.target.value,
              }))
            }
            placeholder="0"
            min="0"
            step="0.01"
          />
        </SimpleGrid>
        <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm">
          <TextInput
            label="Monthly contribution"
            type="number"
            value={fundForm.monthly_contribution}
            onChange={(event) =>
              setFundForm((prev) => ({
                ...prev,
                monthly_contribution: event.target.value,
              }))
            }
            placeholder="Optional"
            min="0"
            step="0.01"
          />
          <DateInput
            label="Target date"
            value={fundForm.target_date ? new Date(fundForm.target_date) : null}
            onChange={(value) =>
              setFundForm((prev) => ({
                ...prev,
                target_date: value ? value.toISOString().slice(0, 10) : "",
              }))
            }
            clearable
          />
        </SimpleGrid>
        <Textarea
          label="Notes"
          value={fundForm.notes}
          onChange={(event) =>
            setFundForm((prev) => ({ ...prev, notes: event.target.value }))
          }
          placeholder="Optional context"
          minRows={2}
        />
        {fundError ? (
          <Alert color="red" variant="light">
            {fundError}
          </Alert>
        ) : null}
        <Group justify="flex-end">
          <Button variant="subtle" color="gray" onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="submit"
            loading={isSavingFund || isUpdatingFund}
            color="green"
          >
            {fund?.id ? "Update fund" : "Save fund"}
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
};
