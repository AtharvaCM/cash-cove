import { describe, expect, it, vi, beforeEach } from "vitest";

let currentBalance = 100;

vi.mock("../../lib/supabaseClient", () => {
  const from = vi.fn((table: string) => {
    if (table !== "accounts") throw new Error("Unexpected table");
    return {
      select: () => ({
        eq: () => ({
          single: async () => ({ data: { current_balance: currentBalance }, error: null }),
        }),
      }),
      update: (payload: { current_balance: number }) => ({
        eq: () => {
          currentBalance = payload.current_balance;
          return { error: null };
        },
      }),
    };
  });
  return { supabase: { from } };
});

import { transactionsTestHelpers } from "./transactionsApi";

const { signedAmount, applyAccountDelta } = transactionsTestHelpers;

describe("transactions account helpers", () => {
  beforeEach(() => {
    currentBalance = 100;
  });

  it("computes signed amount correctly", () => {
    expect(
      signedAmount({
        amount: 50,
        type: "expense",
        is_transfer: false,
        account_id: "a1",
      })
    ).toBe(-50);
    expect(
      signedAmount({
        amount: 75,
        type: "income",
        is_transfer: false,
        account_id: "a1",
      })
    ).toBe(75);
    expect(
      signedAmount({
        amount: 20,
        type: "expense",
        is_transfer: true,
        account_id: "a1",
      })
    ).toBe(0);
    expect(
      signedAmount({
        amount: 20,
        type: "expense",
        is_transfer: false,
        account_id: null,
      })
    ).toBe(0);
  });

  it("applies account delta to balance", async () => {
    await applyAccountDelta("a1", -25);
    expect(currentBalance).toBe(75);
    await applyAccountDelta("a1", 50);
    expect(currentBalance).toBe(125);
  });
});
