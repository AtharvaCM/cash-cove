import { Paper, SimpleGrid, Text, Title } from "@mantine/core";
import { formatINR } from "../../lib/format";

type FundSummaryCardsProps = {
  totals: {
    target: number;
    saved: number;
    monthly: number;
    progress: number;
  };
  fundCount: number;
};

export const FundSummaryCards = ({ totals, fundCount }: FundSummaryCardsProps) => (
  <SimpleGrid cols={{ base: 1, md: 3 }} spacing="md">
    <Paper withBorder shadow="sm" radius="lg" p="md">
      <Text size="sm" c="dimmed">
        Total saved
      </Text>
      <Title order={3} mt="xs">
        {formatINR(totals.saved)}
      </Title>
      <Text size="sm" c="brand.6" fw={600}>
        Across {fundCount} funds
      </Text>
    </Paper>
    <Paper withBorder shadow="sm" radius="lg" p="md">
      <Text size="sm" c="dimmed">
        Total target
      </Text>
      <Title order={3} mt="xs">
        {formatINR(totals.target)}
      </Title>
      <Text size="sm" c="brand.6" fw={600}>
        Monthly plan {formatINR(totals.monthly)}
      </Text>
    </Paper>
    <Paper withBorder shadow="sm" radius="lg" p="md">
      <Text size="sm" c="dimmed">
        Progress
      </Text>
      <Title order={3} mt="xs">
        {totals.progress}%
      </Title>
      <Text size="sm" c="brand.6" fw={600}>
        Towards all goals
      </Text>
    </Paper>
  </SimpleGrid>
);
