import {
  Badge,
  Button,
  Group,
  Paper,
  SimpleGrid,
  Stack,
  Text,
  Title,
} from "@mantine/core";
import { Plus, Coins } from "lucide-react";
import { useMemo, useState } from "react";
import {
  useGetFundContributionsQuery,
  useGetFundsQuery,
} from "../features/api/apiSlice";
import type { Fund, FundContribution } from "../types/finance";
import { FundSummaryCards } from "../components/funds/FundSummaryCards";
import { FundProgressGrid } from "../components/funds/FundProgressGrid";
import { FundContributionChart } from "../components/funds/FundContributionChart";
import { FundContributionTable } from "../components/funds/FundContributionTable";
import { FundFormModal } from "../components/funds/FundFormModal";
import { FundDeleteModal } from "../components/funds/FundDeleteModal";
import { ContributionModal } from "../components/funds/ContributionModal";
import { FundProjectionTable } from "../components/funds/FundProjectionTable";
import { FundAlertsPanel } from "../components/funds/FundAlertsPanel";
import { buildFundAlerts, buildFundProjections } from "../lib/fundInsights";

export const Funds = () => {
  const { data: funds = [], isLoading: isFundsLoading } = useGetFundsQuery();
  const { data: contributions = [], isLoading: isContribLoading } =
    useGetFundContributionsQuery();

  const [isFundModalOpen, setIsFundModalOpen] = useState(false);
  const [selectedFund, setSelectedFund] = useState<Fund | null>(null);
  const [fundDeleteTarget, setFundDeleteTarget] = useState<Fund | null>(null);

  const [isContributionModalOpen, setIsContributionModalOpen] = useState(false);
  const [selectedContribution, setSelectedContribution] =
    useState<FundContribution | null>(null);

  const totals = useMemo(() => {
    const target = funds.reduce((sum, fund) => sum + fund.target_amount, 0);
    const saved = funds.reduce((sum, fund) => sum + fund.current_amount, 0);
    const monthly = funds.reduce(
      (sum, fund) => sum + (fund.monthly_contribution ?? 0),
      0
    );
    const progress =
      target > 0 ? Math.max(0, Math.round((saved / target) * 100)) : 0;
    return { target, saved, monthly, progress };
  }, [funds]);

  const projections = useMemo(() => buildFundProjections(funds), [funds]);
  const alerts = useMemo(() => buildFundAlerts(projections), [projections]);

  const contributionMap = useMemo(
    () => new Map(contributions.map((item) => [item.id, item])),
    [contributions]
  );

  const handleOpenFundCreate = () => {
    setSelectedFund(null);
    setIsFundModalOpen(true);
  };

  const handleEditFund = (fund: Fund) => {
    setSelectedFund(fund);
    setIsFundModalOpen(true);
  };

  const handleCloseFundModal = () => {
    setIsFundModalOpen(false);
    setSelectedFund(null);
  };

  const handleDeleteFund = (fund: Fund) => {
    setFundDeleteTarget(fund);
  };

  const handleCloseFundDelete = () => {
    setFundDeleteTarget(null);
  };

  const handleOpenContribution = () => {
    setSelectedContribution(null);
    setIsContributionModalOpen(true);
  };

  const handleEditContribution = (id: string) => {
    const contribution = contributionMap.get(id);
    if (!contribution) {
      return;
    }
    setSelectedContribution(contribution);
    setIsContributionModalOpen(true);
  };

  const handleCloseContribution = () => {
    setIsContributionModalOpen(false);
    setSelectedContribution(null);
  };

  const fundFormKey = `fund-${selectedFund?.id ?? "new"}-${
    isFundModalOpen ? "open" : "closed"
  }`;
  const contributionFormKey = `contrib-${selectedContribution?.id ?? "new"}-${
    isContributionModalOpen ? "open" : "closed"
  }`;

  return (
    <Stack gap="lg">
      <FundFormModal
        key={fundFormKey}
        opened={isFundModalOpen}
        onClose={handleCloseFundModal}
        fund={selectedFund}
      />
      <FundDeleteModal
        fund={fundDeleteTarget}
        opened={Boolean(fundDeleteTarget)}
        onClose={handleCloseFundDelete}
      />
      <ContributionModal
        key={contributionFormKey}
        opened={isContributionModalOpen}
        onClose={handleCloseContribution}
        funds={funds}
        contribution={selectedContribution}
      />

      <FundSummaryCards totals={totals} fundCount={funds.length} />

      <Paper withBorder shadow="sm" radius="lg" p="md">
        <Group justify="space-between" align="center" wrap="wrap">
          <Stack gap={2}>
            <Title order={4}>Funds</Title>
            <Text size="sm" c="dimmed">
              Manage car, land, emergency, and goal savings.
            </Text>
          </Stack>
          <Group gap="sm" wrap="wrap">
            <Button
              variant="light"
              color="blue"
              onClick={handleOpenContribution}
              disabled={funds.length === 0}
              leftSection={<Coins size={16} strokeWidth={2} />}
            >
              Add contribution
            </Button>
            <Button
              leftSection={<Plus size={16} strokeWidth={2} />}
              onClick={handleOpenFundCreate}
            >
              New fund
            </Button>
          </Group>
        </Group>
      </Paper>

      <Paper withBorder shadow="sm" radius="lg" p="md">
        <Group justify="space-between" align="center" mb="md">
          <Stack gap={2}>
            <Title order={4}>Fund progress</Title>
            <Text size="sm" c="dimmed">
              Live status across goals and funds.
            </Text>
          </Stack>
          <Badge variant="light" color="blue">
            {funds.length} active
          </Badge>
        </Group>
        <FundProgressGrid
          funds={funds}
          onEdit={handleEditFund}
          onDelete={handleDeleteFund}
        />
      </Paper>

      <SimpleGrid cols={{ base: 1, lg: 2 }} spacing="md">
        <FundAlertsPanel alerts={alerts} />
        <FundContributionChart contributions={contributions} />
      </SimpleGrid>

      <FundProjectionTable projections={projections} loading={isFundsLoading} />

      <FundContributionTable
        funds={funds}
        contributions={contributions}
        loading={isFundsLoading || isContribLoading}
        onEditContribution={handleEditContribution}
      />
    </Stack>
  );
};
