import { Paper, SimpleGrid, Text, Title } from "@mantine/core";
import { formatINR } from "../../lib/format";

type OverviewCardsProps = {
  monthLabel: string;
  transactionCount: number;
  totalSpent: number;
  totalBudget: number;
  remaining: number;
};

export const OverviewCards = ({
  monthLabel,
  transactionCount,
  totalSpent,
  totalBudget,
  remaining,
}: OverviewCardsProps) => (
  <SimpleGrid cols={{ base: 1, md: 3 }} spacing="md">
    <Paper withBorder shadow="sm" radius="lg" p="md">
      <Text size="sm" c="dimmed">
        Month
      </Text>
      <Title order={3} mt="xs">
        {monthLabel}
      </Title>
      <Text size="sm" c="brand.6" fw={600}>
        {transactionCount} transactions
      </Text>
    </Paper>
    <Paper withBorder shadow="sm" radius="lg" p="md">
      <Text size="sm" c="dimmed">
        Spent
      </Text>
      <Title order={3} mt="xs">
        {formatINR(totalSpent)}
      </Title>
      <Text size="sm" c="brand.6" fw={600}>
        Budget alerts at 80% spend
      </Text>
    </Paper>
    <Paper withBorder shadow="sm" radius="lg" p="md">
      <Text size="sm" c="dimmed">
        Budget
      </Text>
      <Title order={3} mt="xs">
        {formatINR(totalBudget)}
      </Title>
      <Text size="sm" c={remaining < 0 ? "red.6" : "brand.6"} fw={600}>
        {remaining < 0
          ? `${formatINR(Math.abs(remaining))} over`
          : `${formatINR(remaining)} left`}
      </Text>
    </Paper>
  </SimpleGrid>
);
