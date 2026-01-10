import { Paper, Stack, Text, Title } from "@mantine/core";
import { useMemo } from "react";
import dayjs from "dayjs";
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatINR } from "../../lib/format";
import type { FundContribution } from "../../types/finance";

type FundContributionChartProps = {
  contributions: FundContribution[];
};

export const FundContributionChart = ({
  contributions,
}: FundContributionChartProps) => {
  const monthlyData = useMemo(() => {
    const buckets = new Map<
      string,
      { label: string; total: number; sortKey: number }
    >();
    contributions.forEach((item) => {
      const date = dayjs(item.date);
      const key = date.format("YYYY-MM");
      const entry = buckets.get(key) ?? {
        label: date.format("MMM YY"),
        total: 0,
        sortKey: date.valueOf(),
      };
      entry.total += item.amount;
      buckets.set(key, entry);
    });
    return Array.from(buckets.values())
      .sort((a, b) => a.sortKey - b.sortKey)
      .slice(-6);
  }, [contributions]);

  return (
    <Paper withBorder shadow="sm" radius="lg" p="md">
      <Stack gap="xs" mb="sm">
        <Title order={4}>Monthly contributions</Title>
        <Text size="sm" c="dimmed">
          Last six months of contributions.
        </Text>
      </Stack>
      {monthlyData.length === 0 ? (
        <Text size="sm" c="dimmed">
          Add contributions to see the trend.
        </Text>
      ) : (
        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={monthlyData}>
            <XAxis dataKey="label" tickLine={false} axisLine={false} />
            <YAxis tickLine={false} axisLine={false} />
            <Tooltip formatter={(value) => formatINR(Number(value))} />
            <Bar dataKey="total" fill="#2563eb" radius={[6, 6, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      )}
    </Paper>
  );
};
