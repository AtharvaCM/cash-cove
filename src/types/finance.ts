export type CategoryType = "expense" | "income";

export type Category = {
  id: string;
  name: string;
  parent_id: string | null;
  type: CategoryType;
};

export type PaymentMethod = {
  id: string;
  name: string;
};

export type Account = {
  id: string;
  name: string;
  type: "bank" | "card" | "wallet" | "cash" | "other";
  current_balance: number;
  currency: string;
};

export type Tag = {
  id: string;
  name: string;
};

export type Transaction = {
  id: string;
  type: "expense" | "income";
  date: string;
  amount: number;
  category_id: string | null;
  payment_method_id: string | null;
  account_id?: string | null;
  notes?: string | null;
  notes_enc?: string | null;
  is_transfer?: boolean;
  is_recurring: boolean;
  tags?: Tag[];
};

export type Budget = {
  id: string;
  month: string;
  category_id: string | null;
  amount: number;
};

export type Fund = {
  id: string;
  name: string;
  type: string | null;
  target_amount: number;
  current_amount: number;
  monthly_contribution: number | null;
  target_date: string | null;
  notes: string | null;
};

export type FundContribution = {
  id: string;
  fund_id: string;
  date: string;
  amount: number;
  note: string | null;
  fund_name?: string | null;
};
