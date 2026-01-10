import { Group, Paper, Stack, Text, Title } from "@mantine/core";
import { formatINR } from "../../lib/format";

type ForecastCardProps = {
  cashOnHand: number;
  avgDailySpend: number;
  recurringIncome: number;
  recurringExpense: number;
  style?: React.CSSProperties;
};

export const ForecastCard = ({
  cashOnHand,
  avgDailySpend,
  recurringIncome,
  recurringExpense,
  style,
}: ForecastCardProps) => {
  const netRecurring = recurringIncome - recurringExpense;
  const runwayDays = avgDailySpend > 0 ? Math.max(0, Math.floor(cashOnHand / avgDailySpend)) : 0;

  return (
    <Paper
      withBorder
      shadow="sm"
      radius="lg"
      p="md"
      style={{ display: "flex", flexDirection: "column", ...style }}
    >
      <Title order={4} mb={4}>
        Forecast
      </Title>
      <Text size="sm" c="dimmed" mb="xs">
        Runway and recurring impact
      </Text>
      <Stack gap={8}>
        <Group justify="space-between">
          <Text size="sm" c="dimmed">
            Runway (avg daily spend)
          </Text>
          <Text fw={700}>{runwayDays} days</Text>
        </Group>
        <Group justify="space-between">
          <Text size="sm" c="dimmed">
            Recurring income
          </Text>
          <Text fw={700}>{formatINR(recurringIncome)}</Text>
        </Group>
        <Group justify="space-between">
          <Text size="sm" c="dimmed">
            Recurring expense
          </Text>
          <Text fw={700}>{formatINR(recurringExpense)}</Text>
        </Group>
        <Group justify="space-between">
          <Text size="sm" c="dimmed">
            Net recurring
          </Text>
          <Text fw={700} c={netRecurring >= 0 ? "teal.7" : "red.7"}>
            {netRecurring >= 0 ? "+" : "-"}
            {formatINR(Math.abs(netRecurring))}
          </Text>
        </Group>
      </Stack>
    </Paper>
  );
};
