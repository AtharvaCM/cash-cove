import {
  Button,
  Group,
  Paper,
  Select,
  Stack,
  Text,
  Title,
} from "@mantine/core";
import { MonthPickerInput } from "@mantine/dates";
import dayjs from "dayjs";
import { Download, Filter, Tag } from "lucide-react";

type SelectOption = { value: string; label: string };

type CashflowHeaderProps = {
  month: string;
  monthLabel: string;
  paymentFilter: string;
  tagFilter: string;
  paymentOptions: SelectOption[];
  tagOptions: SelectOption[];
  filteredCount: number;
  totalCount: number;
  onMonthChange: (value: string) => void;
  onPaymentChange: (value: string | null) => void;
  onTagChange: (value: string | null) => void;
  onExport: () => void;
};

export const CashflowHeader = ({
  month,
  monthLabel,
  paymentFilter,
  tagFilter,
  paymentOptions,
  tagOptions,
  filteredCount,
  totalCount,
  onMonthChange,
  onPaymentChange,
  onTagChange,
  onExport,
}: CashflowHeaderProps) => (
  <Paper withBorder shadow="sm" radius="lg" p="md">
    <Group justify="space-between" align="flex-start" wrap="wrap" gap="md">
      <Stack gap={2}>
        <Title order={4}>{monthLabel}</Title>
        <Text size="sm" c="dimmed">
          Cashflow overview
        </Text>
      </Stack>
      <Group gap="sm" align="flex-end" wrap="wrap">
        <MonthPickerInput
          label="Month"
          value={dayjs(month + "-01").toDate()}
          onChange={(value) => value && onMonthChange(dayjs(value).format("YYYY-MM"))}
          maxDate={dayjs().endOf("month").toDate()}
          size="xs"
          clearable={false}
          styles={{ input: { width: 160 } }}
        />
        <Select
          label="Payment"
          data={paymentOptions}
          value={paymentFilter || null}
          onChange={onPaymentChange}
          placeholder="All"
          clearable
          size="xs"
          leftSection={<Filter size={14} strokeWidth={2} />}
        />
        <Select
          label="Tag"
          data={tagOptions}
          value={tagFilter || null}
          onChange={onTagChange}
          placeholder="All"
          clearable
          size="xs"
          leftSection={<Tag size={14} strokeWidth={2} />}
        />
        <Button
          variant="light"
          color="blue"
          size="xs"
          onClick={onExport}
          disabled={filteredCount === 0}
          leftSection={<Download size={14} strokeWidth={2} />}
        >
          Export CSV
        </Button>
      </Group>
    </Group>
    <Text size="sm" c="dimmed" mt="sm">
      {filteredCount === totalCount
        ? "Track how income and expenses move together each month."
        : `Filtered ${filteredCount} of ${totalCount} transactions.`}
    </Text>
  </Paper>
);
