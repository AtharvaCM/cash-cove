import { Stack } from "@mantine/core";
import { useState } from "react";
import { CashflowHeader } from "../components/cashflow/CashflowHeader";
import { CashflowSummaryCards } from "../components/cashflow/CashflowSummaryCards";
import { CashflowWeeklyChart } from "../components/cashflow/CashflowWeeklyChart";
import { CashflowCategoryTables } from "../components/cashflow/CashflowCategoryTables";
import { useCashflowData } from "../hooks/useCashflowData";
import { useAppMonth } from "../context/AppMonthContext";

export const Cashflow = () => {
  const { month } = useAppMonth();
  const [paymentFilter, setPaymentFilter] = useState("");
  const [tagFilter, setTagFilter] = useState("");
  const {
    monthLabel,
    isTransactionsLoading,
    categoryMap,
    paymentMap,
    paymentOptions,
    tagSelectOptions,
    filteredTransactions,
    filteredCount,
    totalCount,
    savingsRate,
    expenseRows,
    incomeRows,
    totalIncome,
    totalExpense,
    net,
    incomeCount,
    expenseCount,
    weeklyData,
  } = useCashflowData({
    month,
    paymentFilter,
    tagFilter,
  });

  const handleExport = () => {
    if (filteredTransactions.length === 0) {
      return;
    }

    const escape = (value: string) => {
      const escaped = value.replaceAll('"', '""');
      return /[",\n]/.test(escaped) ? `"${escaped}"` : escaped;
    };

    const header = [
      "Date",
      "Type",
      "Amount",
      "Category",
      "Payment Method",
      "Tags",
      "Notes",
    ];

    const rows = filteredTransactions.map((tx) => [
      tx.date,
      tx.type,
      tx.amount.toFixed(2),
      categoryMap.get(tx.category_id ?? "") ?? "Uncategorized",
      paymentMap.get(tx.payment_method_id ?? "") ?? "-",
      tx.tags?.map((tag) => tag.name).join(" | ") ?? "",
      tx.notes ?? "",
    ]);

    const csv = [header, ...rows]
      .map((row) => row.map((value) => escape(String(value))).join(","))
      .join("\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `sanchay-cashflow-${month}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Stack gap="lg">
      <CashflowHeader
        monthLabel={monthLabel}
        paymentFilter={paymentFilter}
        tagFilter={tagFilter}
        paymentOptions={paymentOptions}
        tagOptions={tagSelectOptions}
        filteredCount={filteredCount}
        totalCount={totalCount}
        onPaymentChange={(value) => setPaymentFilter(value ?? "")}
        onTagChange={(value) => setTagFilter(value ?? "")}
        onExport={handleExport}
      />

      <CashflowSummaryCards
        totalIncome={totalIncome}
        totalExpense={totalExpense}
        net={net}
        incomeCount={incomeCount}
        expenseCount={expenseCount}
        savingsRate={savingsRate}
      />

      <CashflowWeeklyChart
        weeklyData={weeklyData}
        hasData={filteredTransactions.length > 0}
      />

      <CashflowCategoryTables
        expenseRows={expenseRows}
        incomeRows={incomeRows}
        isLoading={isTransactionsLoading}
      />
    </Stack>
  );
};
