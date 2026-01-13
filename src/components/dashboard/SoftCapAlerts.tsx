import { Badge, Group, Paper, Stack, Text, Title } from "@mantine/core";
import { EmptyState } from "../common/EmptyState";
import { formatINR } from "../../lib/format";
import type { BudgetWarning } from "../../lib/dashboard";

type SoftCapAlertsProps = {
  warnings: BudgetWarning[];
  hasBudgets: boolean;
  style?: React.CSSProperties;
};

export const SoftCapAlerts = ({ warnings, hasBudgets, style }: SoftCapAlertsProps) => (
  <Paper
    withBorder
    shadow="sm"
    radius="lg"
    p="md"
    style={{ display: "flex", flexDirection: "column", ...style }}
  >
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
    {!hasBudgets && (
      <EmptyState
        description="Set budgets to activate alerts."
        action={{ label: "Set budgets", to: "/budgets" }}
      />
    )}
    {hasBudgets && warnings.length === 0 && (
      <EmptyState description="All clear. No caps near limit yet." />
    )}
    {hasBudgets && warnings.length > 0 && (
      <Stack gap="sm">
        {warnings.map((warning) => {
          const over = warning.spent > warning.budget;
          const atLimit = !over && Math.abs(warning.budget - warning.spent) < 0.01;
          const percent = Math.round(warning.ratio * 100);
          const delta = Math.max(0, warning.spent - warning.budget);
          let statusLabel = `${percent}% used`;

          if (over) {
            statusLabel = `${formatINR(delta)} over`;
          } else if (atLimit) {
            statusLabel = "At limit";
          }

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
                  {statusLabel}
                </Text>
              </Group>
            </Paper>
          );
        })}
      </Stack>
    )}
  </Paper>
);
