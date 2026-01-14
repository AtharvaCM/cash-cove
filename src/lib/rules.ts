import type { TransactionRule } from "../types/finance";

type RuleInput = {
  notes: string | null;
  type: "expense" | "income";
  category_id: string | null;
  tags: string[];
};

type RuleOutput = {
  category_id: string | null;
  tags: string[];
  matchedRules?: TransactionRule[];
};

const normalize = (value: string) => value.trim().toLowerCase();

const matchesRule = (rule: TransactionRule, input: RuleInput) => {
  if (!rule.is_active) {
    return false;
  }
  if (rule.transaction_type !== "any" && rule.transaction_type !== input.type) {
    return false;
  }
  if (!input.notes) {
    return false;
  }
  const haystack = normalize(input.notes);
  const needle = normalize(rule.match_text);
  if (!needle) {
    return false;
  }
  if (rule.match_type === "equals") {
    return haystack === needle;
  }
  if (rule.match_type === "starts_with") {
    return haystack.startsWith(needle);
  }
  return haystack.includes(needle);
};

const sortRules = (rules: TransactionRule[]) =>
  [...rules].sort((a, b) => {
    if (a.priority !== b.priority) {
      return a.priority - b.priority;
    }
    return a.name.localeCompare(b.name);
  });

export const applyRulesToTransaction = (
  input: RuleInput,
  rules: TransactionRule[]
): RuleOutput => {
  const preview = previewRules(input, rules);
  return { category_id: preview.category_id, tags: preview.tags };
};

export const previewRules = (
  input: RuleInput,
  rules: TransactionRule[]
): RuleOutput => {
  let nextCategory = input.category_id;
  const tags = new Set(input.tags.map((tag) => normalize(tag)));
  const matchedRules: TransactionRule[] = [];

  sortRules(rules).forEach((rule) => {
    if (!matchesRule(rule, input)) {
      return;
    }
    matchedRules.push(rule);
    if (!nextCategory && rule.category_id) {
      nextCategory = rule.category_id;
    }
    rule.tag_names.forEach((tag) => {
      const cleaned = normalize(tag);
      if (cleaned) {
        tags.add(cleaned);
      }
    });
  });

  return {
    category_id: nextCategory,
    tags: Array.from(tags),
    matchedRules,
  };
};
