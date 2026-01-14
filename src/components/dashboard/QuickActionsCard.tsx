import { Button, Group, Paper, SimpleGrid, Stack, Text, Title } from "@mantine/core";
import { ArrowUpRight, Plus, Repeat, Upload, Wallet } from "lucide-react";
import type { ReactNode } from "react";
import { Link } from "react-router-dom";

type QuickAction = {
  id: string;
  label: string;
  description: string;
  to: string;
  icon: ReactNode;
};

const QUICK_ACTIONS: QuickAction[] = [
  {
    id: "add-transaction",
    label: "Add transaction",
    description: "Record a spend or income.",
    to: "/transactions?action=new",
    icon: <Plus size={16} />,
  },
  {
    id: "import-csv",
    label: "Import CSV",
    description: "Pull in a bank or card export.",
    to: "/transactions?action=import",
    icon: <Upload size={16} />,
  },
  {
    id: "add-subscription",
    label: "Add subscription",
    description: "Track a recurring bill.",
    to: "/subscriptions?action=new",
    icon: <Repeat size={16} />,
  },
  {
    id: "set-budget",
    label: "Set budget",
    description: "Plan a category budget.",
    to: "/budgets?action=new",
    icon: <Wallet size={16} />,
  },
];

type QuickActionsCardProps = {
  style?: React.CSSProperties;
};

export const QuickActionsCard = ({ style }: QuickActionsCardProps) => (
  <Paper
    withBorder
    shadow="sm"
    radius="lg"
    p="md"
    className="dashboard-priority-card dashboard-section"
    style={{ display: "flex", flexDirection: "column", gap: 12, ...style }}
  >
    <Group justify="space-between" align="center" wrap="wrap">
      <Stack gap={2}>
        <Title order={4}>Quick actions</Title>
        <Text size="sm" c="dimmed">
          Jump straight into the most common tasks.
        </Text>
      </Stack>
      <Text size="xs" c="dimmed">
        Shortcuts open ready-to-edit forms.
      </Text>
    </Group>
    <SimpleGrid cols={{ base: 1, sm: 2, md: 4 }} spacing="sm">
      {QUICK_ACTIONS.map((action) => (
        <Paper
          key={action.id}
          withBorder
          radius="md"
          p="sm"
          style={{ background: "var(--surface-alt)" }}
        >
          <Stack gap={6}>
            <Button
              component={Link}
              to={action.to}
              variant="light"
              fullWidth
              leftSection={action.icon}
              rightSection={<ArrowUpRight size={14} />}
            >
              {action.label}
            </Button>
            <Text size="xs" c="dimmed">
              {action.description}
            </Text>
          </Stack>
        </Paper>
      ))}
    </SimpleGrid>
  </Paper>
);
