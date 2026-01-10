import { ActionIcon, Badge, Group, Paper, Progress, SimpleGrid, Stack, Text } from "@mantine/core";
import dayjs from "dayjs";
import type { Fund } from "../../types/finance";
import { formatINR } from "../../lib/format";
import { FUND_TYPES } from "../../lib/fundOptions";
import { Pencil, Trash } from "lucide-react";

type FundProgressGridProps = {
  funds: Fund[];
  onEdit: (fund: Fund) => void;
  onDelete: (fund: Fund) => void;
};

export const FundProgressGrid = ({
  funds,
  onEdit,
  onDelete,
}: FundProgressGridProps) => {
  if (funds.length === 0) {
    return (
      <Text size="sm" c="dimmed">
        Create your first fund to start tracking progress.
      </Text>
    );
  }

  return (
    <SimpleGrid cols={{ base: 1, md: 2 }} spacing="md">
      {funds.map((fund) => {
        const progress =
          fund.target_amount > 0
            ? Math.max(
                0,
                Math.min(100, (fund.current_amount / fund.target_amount) * 100)
              )
            : 0;
        const remaining = fund.target_amount - fund.current_amount;
        const typeLabel =
          FUND_TYPES.find((item) => item.value === fund.type)?.label ?? fund.type;

        return (
          <Paper key={fund.id} withBorder radius="md" p="md">
            <Group justify="space-between" align="center" mb="xs">
              <Stack gap={2}>
                <Text fw={600}>{fund.name}</Text>
                <Text size="xs" c="dimmed">
                  {typeLabel}
                </Text>
              </Stack>
              <Group gap="xs">
                <Badge variant="light" color="blue">
                  {Math.round(progress)}%
                </Badge>
                <ActionIcon
                  variant="subtle"
                  color="blue"
                  aria-label={`Edit ${fund.name}`}
                  onClick={() => onEdit(fund)}
                >
                  <Pencil size={16} strokeWidth={2} />
                </ActionIcon>
                <ActionIcon
                  variant="subtle"
                  color="red"
                  aria-label={`Delete ${fund.name}`}
                  onClick={() => onDelete(fund)}
                >
                  <Trash size={16} strokeWidth={2} />
                </ActionIcon>
              </Group>
            </Group>
            <Progress
              value={progress}
              color={progress >= 100 ? "green" : "blue"}
              size="md"
            />
            <Group justify="space-between" mt="sm">
              <Text size="sm">{formatINR(fund.current_amount)} saved</Text>
              <Text size="sm" c={remaining <= 0 ? "green.6" : "dimmed"}>
                {remaining <= 0 ? "Goal met" : `${formatINR(remaining)} to go`}
              </Text>
            </Group>
            <Stack gap={2} mt="xs">
              {fund.monthly_contribution ? (
                <Text size="xs" c="dimmed">
                  Monthly contribution: {formatINR(fund.monthly_contribution)}
                </Text>
              ) : null}
              {fund.target_date ? (
                <Text size="xs" c="dimmed">
                  Target by {dayjs(fund.target_date).format("MMM YYYY")}
                </Text>
              ) : null}
            </Stack>
          </Paper>
        );
      })}
    </SimpleGrid>
  );
};
