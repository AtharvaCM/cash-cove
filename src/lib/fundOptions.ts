import type { FundType } from "../types/finance";

export const FUND_TYPES: Array<{ value: FundType; label: string }> = [
  { value: "car", label: "Car down payment" },
  { value: "land", label: "Land down payment" },
  { value: "emergency", label: "Emergency fund" },
  { value: "goal", label: "Other goal" },
];

export type ContributionKind = "deposit" | "withdrawal";

export const CONTRIBUTION_TYPES: Array<{
  value: ContributionKind;
  label: string;
}> = [
  { value: "deposit", label: "Deposit" },
  { value: "withdrawal", label: "Withdrawal" },
];
