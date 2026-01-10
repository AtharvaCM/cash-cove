import { useMemo } from "react";
import {
  useGetCategoriesQuery,
  useGetPaymentMethodsQuery,
  useGetTransactionsQuery,
} from "../features/api/apiSlice";
import { formatMonthLabel } from "../lib/format";
import {
  buildCategoryRows,
  buildTagOptions,
  calculateCashflowMetrics,
  filterTransactions,
} from "../lib/cashflow";

export const useCashflowData = ({
  month,
  paymentFilter,
  tagFilter,
}: {
  month: string;
  paymentFilter: string;
  tagFilter: string;
}) => {
  const { data: categories = [] } = useGetCategoriesQuery();
  const { data: paymentMethods = [] } = useGetPaymentMethodsQuery();
  const { data: transactions = [], isLoading: isTransactionsLoading } =
    useGetTransactionsQuery({ month });

  const monthLabel = useMemo(() => formatMonthLabel(month), [month]);
  const categoryMap = useMemo(
    () => new Map(categories.map((category) => [category.id, category.name])),
    [categories]
  );
  const paymentMap = useMemo(
    () => new Map(paymentMethods.map((method) => [method.id, method.name])),
    [paymentMethods]
  );
  const paymentOptions = useMemo(
    () =>
      paymentMethods.map((method) => ({
        value: method.id,
        label: method.name,
      })),
    [paymentMethods]
  );
  const tagOptions = useMemo(
    () => buildTagOptions(transactions),
    [transactions]
  );
  const tagSelectOptions = useMemo(
    () => tagOptions.map((tag) => ({ value: tag.id, label: tag.name })),
    [tagOptions]
  );
  const filteredTransactions = useMemo(
    () => filterTransactions(transactions, paymentFilter, tagFilter),
    [transactions, paymentFilter, tagFilter]
  );

  const metrics = useMemo(
    () =>
      calculateCashflowMetrics({
        transactions: filteredTransactions,
        month,
        categoryMap,
      }),
    [filteredTransactions, month, categoryMap]
  );

  const savingsRate =
    metrics.totalIncome > 0
      ? Math.round((metrics.net / metrics.totalIncome) * 100)
      : null;

  const expenseRows = useMemo(
    () => buildCategoryRows(metrics.topExpenseCategories, metrics.totalExpense),
    [metrics.topExpenseCategories, metrics.totalExpense]
  );

  const incomeRows = useMemo(
    () => buildCategoryRows(metrics.topIncomeCategories, metrics.totalIncome),
    [metrics.topIncomeCategories, metrics.totalIncome]
  );

  return {
    monthLabel,
    transactions,
    isTransactionsLoading,
    categoryMap,
    paymentMap,
    paymentOptions,
    tagSelectOptions,
    filteredTransactions,
    filteredCount: filteredTransactions.length,
    totalCount: transactions.length,
    savingsRate,
    expenseRows,
    incomeRows,
    ...metrics,
  };
};
