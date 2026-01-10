import { ActionIcon, Badge, Group, Paper, Stack, Text, Title } from "@mantine/core";
import { formatINR } from "../../lib/format";
import type { Account } from "../../types/finance";

type AccountBalancesProps = {
  accounts: Account[];
  hidden: boolean;
  onToggle: () => void;
  loading?: boolean;
  icon: React.ReactNode;
  style?: React.CSSProperties;
};

const maskValue = (value: number, hidden: boolean) =>
  hidden ? "₹ • • •" : formatINR(value);

export const AccountBalances = ({
  accounts,
  hidden,
  onToggle,
  loading = false,
  icon,
  style,
}: AccountBalancesProps) => {
  const total = accounts.reduce((sum, account) => sum + (account.current_balance ?? 0), 0);

  return (
    <Paper
      withBorder
      shadow="sm"
      radius="lg"
      p="md"
      style={{ display: "flex", flexDirection: "column", ...style }}
    >
      <Group justify="space-between" align="center" mb="xs">
        <Stack gap={4}>
          <Title order={4}>Accounts</Title>
          <Text size="sm" c="dimmed">
            Balances across bank, credit card, cash, and wallet.
          </Text>
        </Stack>
        <ActionIcon
          variant="subtle"
          color="gray"
          onClick={onToggle}
          aria-label={hidden ? "Show balances" : "Hide balances"}
        >
          {icon}
        </ActionIcon>
      </Group>
      <Group justify="space-between" align="center" mb="sm">
        <Text size="sm" c="dimmed">
          Total
        </Text>
        <Text fw={700}>{maskValue(total, hidden)}</Text>
      </Group>
      <Stack gap={8}>
        {loading ? (
          <Text size="sm" c="dimmed">
            Loading accounts...
          </Text>
        ) : accounts.length === 0 ? (
          <Text size="sm" c="dimmed">
            No accounts yet. Add them in Settings → Accounts.
          </Text>
        ) : (
          accounts.map((account) => (
            <Group key={account.id} justify="space-between" align="center">
              <Group gap="xs">
                <Text fw={600}>{account.name}</Text>
                <Badge variant="light" color="blue">
                  {account.type === "card" ? "Credit card" : account.type}
                </Badge>
              </Group>
              <Text fw={600}>{maskValue(account.current_balance ?? 0, hidden)}</Text>
            </Group>
          ))
        )}
      </Stack>
    </Paper>
  );
};
