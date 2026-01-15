import { Alert, Badge, Group, Paper, Stack, Text } from "@mantine/core";
import dayjs from "dayjs";
import type { Transaction, TransactionRule } from "../../types/finance";
import { previewRules } from "../../lib/rules";
import { formatINR } from "../../lib/format";

type RuleImpactPreviewProps = {
  draftRule: TransactionRule;
  rules: TransactionRule[];
  transactions: Transaction[];
  categoryMap: Map<string, string>;
};

type PreviewMatch = {
  id: string;
  date: string;
  notes: string;
  amount: string;
  resultCategory: string;
  resultTags: string;
  overridden: boolean;
};

const buildTransactionInput = (tx: Transaction) => ({
  notes: tx.notes?.trim() ? tx.notes.trim() : null,
  type: tx.type,
  category_id: tx.category_id ?? null,
  tags: tx.tags?.map((tag) => tag.name) ?? [],
});

export const RuleImpactPreview = ({
  draftRule,
  rules,
  transactions,
  categoryMap,
}: RuleImpactPreviewProps) => {
  if (!draftRule.match_text.trim()) {
    return (
      <Text size="sm" c="dimmed">
        Add match text to preview impacted transactions.
      </Text>
    );
  }

  if (!draftRule.is_active) {
    return (
      <Text size="sm" c="dimmed">
        Enable the rule to preview matches.
      </Text>
    );
  }

  const previewRuleset = [
    draftRule,
    ...rules.filter((rule) => rule.id !== draftRule.id),
  ];

  const matches: PreviewMatch[] = [];
  let overriddenCount = 0;

  transactions.forEach((tx) => {
    if (!tx.notes || tx.is_transfer) {
      return;
    }
    if (
      draftRule.transaction_type !== "any" &&
      tx.type !== draftRule.transaction_type
    ) {
      return;
    }
    const input = buildTransactionInput(tx);
    const result = previewRules(input, previewRuleset);
    const matched = result.matchedRules?.some((rule) => rule.id === draftRule.id);
    if (!matched) {
      return;
    }
    const resultCategoryId = result.category_id ?? null;
    const resultCategory = resultCategoryId
      ? categoryMap.get(resultCategoryId) ?? "Uncategorized"
      : "Uncategorized";
    const override =
      Boolean(draftRule.category_id) &&
      input.category_id === null &&
      resultCategoryId !== draftRule.category_id;
    if (override) {
      overriddenCount += 1;
    }
    matches.push({
      id: tx.id,
      date: dayjs(tx.date).format("DD MMM"),
      notes: tx.notes ?? "",
      amount: `${tx.type === "expense" ? "-" : "+"}${formatINR(tx.amount)}`,
      resultCategory,
      resultTags: result.tags.length > 0 ? result.tags.join(", ") : "No tags",
      overridden: override,
    });
  });

  const previewItems = matches.slice(0, 5);

  return (
    <Paper withBorder radius="md" p="md">
      <Stack gap="sm">
        <Group justify="space-between" align="center">
          <Text fw={600}>Impacted transactions</Text>
          <Text size="xs" c="dimmed">
            {matches.length} matches (last 90 days)
          </Text>
        </Group>
        {overriddenCount > 0 && draftRule.category_id ? (
          <Alert color="yellow" variant="light">
            {overriddenCount} matches already pick a category from a higher-priority
            rule, so this rule will only add tags for them.
          </Alert>
        ) : null}
        {previewItems.length > 0 ? (
          <Stack gap="sm">
            {previewItems.map((item) => (
              <Group key={item.id} justify="space-between" align="flex-start">
                <Stack gap={2} style={{ flex: 1 }}>
                  <Text size="sm" fw={600}>
                    {item.notes}
                  </Text>
                  <Text size="xs" c="dimmed">
                    {item.date} · {item.amount}
                  </Text>
                </Stack>
                <Stack gap={4} align="flex-end">
                  <Badge size="sm" variant="light" color="blue">
                    {item.resultCategory}
                  </Badge>
                  <Text size="xs" c="dimmed">
                    {item.resultTags}
                  </Text>
                  {item.overridden ? (
                    <Badge size="xs" variant="light" color="orange">
                      Overridden
                    </Badge>
                  ) : null}
                </Stack>
              </Group>
            ))}
            {matches.length > previewItems.length ? (
              <Text size="xs" c="dimmed">
                Showing 5 of {matches.length} matches.
              </Text>
            ) : null}
          </Stack>
        ) : (
          <Text size="sm" c="dimmed">
            No recent transactions match this rule.
          </Text>
        )}
      </Stack>
    </Paper>
  );
};
