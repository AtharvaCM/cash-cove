import { Button, Group, Menu, Paper, Stack, Text, Title } from "@mantine/core";
import type { ReactNode } from "react";
import { DateInput } from "@mantine/dates";
import dayjs from "dayjs";
import { Download, FileText } from "lucide-react";

type ReportHeaderProps = {
  rangeLabel: string;
  start: Date | null;
  end: Date | null;
  onStartChange: (value: Date | null) => void;
  onEndChange: (value: Date | null) => void;
  onExportCsv: () => void;
  onExportPdf: () => void;
  disableExport: boolean;
  viewToggle?: ReactNode;
};

export const ReportHeader = ({
  rangeLabel,
  start,
  end,
  onStartChange,
  onEndChange,
  onExportCsv,
  onExportPdf,
  disableExport,
  viewToggle,
}: ReportHeaderProps) => {
  const today = dayjs().endOf("day").toDate();
  const applyPreset = (preset: "this-month" | "last-month" | "last-90") => {
    if (preset === "this-month") {
      onStartChange(dayjs().startOf("month").toDate());
      onEndChange(dayjs().endOf("month").toDate());
      return;
    }
    if (preset === "last-month") {
      const lastMonth = dayjs().subtract(1, "month");
      onStartChange(lastMonth.startOf("month").toDate());
      onEndChange(lastMonth.endOf("month").toDate());
      return;
    }
    onStartChange(dayjs().subtract(89, "day").startOf("day").toDate());
    onEndChange(dayjs().endOf("day").toDate());
  };
  return (
    <Paper withBorder shadow="sm" radius="lg" p="md">
      <Group justify="space-between" align="center" wrap="wrap">
        <Stack gap={4}>
          <Title order={4}>Reports</Title>
          {viewToggle}
          <Text size="sm" c="dimmed">
            {rangeLabel}
          </Text>
        </Stack>
        <Group gap="sm" wrap="wrap" align="flex-end">
          <DateInput
            label="From"
            value={start}
            onChange={(value) => onStartChange(value ? new Date(value) : null)}
            clearable={false}
            maxDate={end ?? today}
          />
          <DateInput
            label="To"
            value={end}
            onChange={(value) => onEndChange(value ? new Date(value) : null)}
            clearable={false}
            maxDate={today}
          />
          <Group gap="xs" align="center">
            <Text size="xs" c="dimmed">
              Presets
            </Text>
            <Button
              variant="subtle"
              size="xs"
              onClick={() => applyPreset("this-month")}
            >
              This month
            </Button>
            <Button
              variant="subtle"
              size="xs"
              onClick={() => applyPreset("last-month")}
            >
              Last month
            </Button>
            <Button
              variant="subtle"
              size="xs"
              onClick={() => applyPreset("last-90")}
            >
              Last 90 days
            </Button>
          </Group>
          <Menu shadow="md" withinPortal position="bottom-end">
            <Menu.Target>
              <Button
                variant="light"
                leftSection={<Download size={16} strokeWidth={2} />}
                disabled={disableExport}
              >
                Export
              </Button>
            </Menu.Target>
            <Menu.Dropdown>
              <Menu.Item
                leftSection={<Download size={16} strokeWidth={2} />}
                onClick={onExportCsv}
              >
                CSV
              </Menu.Item>
              <Menu.Item
                leftSection={<FileText size={16} strokeWidth={2} />}
                onClick={onExportPdf}
              >
                PDF
              </Menu.Item>
            </Menu.Dropdown>
          </Menu>
        </Group>
      </Group>
    </Paper>
  );
};
