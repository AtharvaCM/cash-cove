import { Badge, Group, Paper, Stack, Text, Title } from "@mantine/core";
import { formatINR } from "../../lib/format";
import type { BudgetWarning } from "../../lib/dashboard";

type SoftCapAlertsProps = {
  warnings: BudgetWarning[];
  hasBudgets: boolean;
};

export const SoftCapAlerts = ({ warnings, hasBudgets }: SoftCapAlertsProps) => (
  <Paper withBorder shadow="sm" radius="lg" p="md">
    <Group justify="space-between" align="center" mb="md">
      <Stack gap={2}>
        <Title order={4}>Soft-cap alerts</Title>
        <Text size="sm" c="dimmed">
          Flags at 80% and above.
        </Text>
      </Stack>
      <Badge variant="light" color="blue">
        {warnings.length} active
      </Badge>
    </Group>
    {hasBudgets ? (
      warnings.length === 0 ? (
        <Text size="sm" c="dimmed">
          All clear. No caps near limit yet.
        </Text>
      ) : (
        <Stack gap="sm">
          {warnings.map((warning) => {
            const over = warning.ratio >= 1;
            const percent = Math.round(warning.ratio * 100);
            const delta = Math.abs(warning.budget - warning.spent);

            return (
              <Paper
                key={warning.label}
                withBorder
                radius="md"
                p="sm"
                style={{ background: "var(--surface-alt)" }}
              >
                <Group justify="space-between" align="center" wrap="nowrap">
                  <Stack gap={2}>
                    <Text size="sm" fw={600}>
                      {warning.label}
                    </Text>
                    <Text size="xs" c="dimmed">
                      {formatINR(warning.spent)} of {formatINR(warning.budget)}
                    </Text>
                  </Stack>
                  <Text size="sm" fw={600} c={over ? "red.6" : "brand.6"}>
                    {over ? `${formatINR(delta)} over` : `${percent}% used`}
                  </Text>
                </Group>
              </Paper>
            );
          })}
        </Stack>
      )
    ) : (
      <Text size="sm" c="dimmed">
        Set budgets to activate alerts.
      </Text>
    )}
  </Paper>
);
