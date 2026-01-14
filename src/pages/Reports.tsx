import { Badge, Button, Group, Paper, SimpleGrid, Stack, Text, Title } from "@mantine/core";
import { DateInput } from "@mantine/dates";
import dayjs from "dayjs";
import { useMemo, useState } from "react";
import { Download, FileText } from "lucide-react";
import { ChartsSection } from "../components/dashboard/ChartsSection";
import { CategoryTrendChart } from "../components/reports/CategoryTrendChart";
import {
  useGetAccountsQuery,
  useGetCategoriesQuery,
  useGetPaymentMethodsQuery,
  useGetTransactionsByRangeQuery,
} from "../features/api/apiSlice";
import { buildDailyData, buildPieData } from "../lib/dashboard";
import { formatINR } from "../lib/format";
import type { Transaction } from "../types/finance";
import type { CategoryTrendSeries } from "../components/reports/CategoryTrendChart";

const DEFAULT_START = dayjs().startOf("month").format("YYYY-MM-DD");
const DEFAULT_END = dayjs().endOf("month").format("YYYY-MM-DD");

const inDateRange = (tx: Transaction, start: string, end: string) =>
  tx.date >= start && tx.date <= end;

const sumByType = (transactions: Transaction[], type: "income" | "expense") =>
  transactions
    .filter((tx) => tx.type === type && !tx.is_transfer)
    .reduce((sum, tx) => sum + tx.amount, 0);

const buildChange = (current: number, previous: number) => {
  if (previous === 0) {
    return {
      label: current === 0 ? "0%" : "New",
      delta: current,
      color: current === 0 ? "gray" : "teal",
    };
  }
  const diff = current - previous;
  const percent = (diff / previous) * 100;
  const sign = percent >= 0 ? "+" : "";
  return {
    label: `${sign}${percent.toFixed(1)}%`,
    delta: diff,
    color: percent >= 0 ? "teal" : "red",
  };
};

const escapeCsvValue = (value: string) => {
  const escaped = value.replaceAll('"', '""');
  return /[",\n]/.test(escaped) ? `"${escaped}"` : escaped;
};

const downloadCsv = (filename: string, rows: string[][]) => {
  const csv = rows.map((row) => row.map(escapeCsvValue).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = globalThis.document?.createElement("a");
  if (!link) {
    URL.revokeObjectURL(url);
    return;
  }
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
};

const resolveName = (id: string | null | undefined, map: Map<string, string>) => {
  if (!id) return "-";
  return map.get(id) ?? "-";
};

const resolveCategoryLabel = (id: string | null | undefined, map: Map<string, string>) => {
  if (!id) return "Uncategorized";
  if (id === "uncategorized") return "Uncategorized";
  if (id === "other") return "Other";
  return map.get(id) ?? "Unknown";
};

const buildReportCsvRows = (
  transactions: Transaction[],
  categoryMap: Map<string, string>,
  accountMap: Map<string, string>,
  paymentMap: Map<string, string>
) => {
  const header = [
    "Date",
    "Type",
    "Category",
    "Amount",
    "Account",
    "Payment method",
    "Transfer",
    "Notes",
    "Tags",
  ];
  const sorted = [...transactions].sort((a, b) => dayjs(a.date).diff(dayjs(b.date)));
  const rows = sorted.map((tx) => {
    const tags = tx.tags?.map((tag) => tag.name).join(" | ") ?? "";
    const notes = tx.notes ?? tx.notes_enc ?? "";
    return [
      tx.date,
      tx.type,
      resolveCategoryLabel(tx.category_id ?? null, categoryMap),
      tx.amount.toFixed(2),
      resolveName(tx.account_id ?? null, accountMap),
      resolveName(tx.payment_method_id ?? null, paymentMap),
      tx.is_transfer ? "Yes" : "No",
      notes,
      tags,
    ];
  });
  return [header, ...rows];
};

const escapeHtml = (value: string) =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");

const buildReportHtml = (payload: {
  rangeLabel: string;
  incomeTotal: number;
  expenseTotal: number;
  netTotal: number;
  categoryItems: Array<{ name: string; value: number }>;
  transactions: Transaction[];
  categoryMap: Map<string, string>;
}) => {
  const rowsHtml =
    payload.transactions.length === 0
      ? "<tr><td colspan=\"5\">No transactions in this range.</td></tr>"
      : payload.transactions
          .map((tx) => {
            const category = resolveCategoryLabel(tx.category_id ?? null, payload.categoryMap);
            const note = tx.notes ?? tx.notes_enc ?? "";
            return `<tr>
  <td>${escapeHtml(dayjs(tx.date).format("DD MMM YYYY"))}</td>
  <td>${escapeHtml(tx.type)}</td>
  <td>${escapeHtml(category)}</td>
  <td>${escapeHtml(formatINR(tx.amount))}</td>
  <td>${escapeHtml(note)}</td>
</tr>`;
          })
          .join("");
  const categoryHtml =
    payload.categoryItems.length === 0
      ? "<li>No category data yet.</li>"
      : payload.categoryItems
          .map(
            (item) =>
              `<li><span>${escapeHtml(item.name)}</span><strong>${escapeHtml(
                formatINR(item.value)
              )}</strong></li>`
          )
          .join("");
  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>CashCove report</title>
    <style>
      body { font-family: "IBM Plex Sans", Arial, sans-serif; color: #0f172a; margin: 32px; }
      h1 { font-size: 22px; margin: 0 0 8px; }
      h2 { font-size: 16px; margin: 24px 0 8px; }
      .muted { color: #64748b; font-size: 12px; }
      .summary { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; margin-top: 16px; }
      .summary div { border: 1px solid #e2e8f0; border-radius: 12px; padding: 12px; }
      .summary strong { display: block; font-size: 18px; margin-top: 4px; }
      ul { list-style: none; padding: 0; margin: 0; }
      li { display: flex; justify-content: space-between; padding: 6px 0; border-bottom: 1px solid #f1f5f9; }
      table { width: 100%; border-collapse: collapse; margin-top: 12px; font-size: 12px; }
      th, td { text-align: left; padding: 8px 6px; border-bottom: 1px solid #e2e8f0; }
      th { font-size: 11px; text-transform: uppercase; letter-spacing: 0.08em; color: #64748b; }
    </style>
  </head>
  <body>
    <h1>CashCove report</h1>
    <div class="muted">${escapeHtml(payload.rangeLabel)}</div>
    <section class="summary">
      <div><span class="muted">Income</span><strong>${escapeHtml(
        formatINR(payload.incomeTotal)
      )}</strong></div>
      <div><span class="muted">Expenses</span><strong>${escapeHtml(
        formatINR(payload.expenseTotal)
      )}</strong></div>
      <div><span class="muted">Net</span><strong>${escapeHtml(
        formatINR(payload.netTotal)
      )}</strong></div>
    </section>
    <h2>Top categories</h2>
    <ul>${categoryHtml}</ul>
    <h2>Transactions</h2>
    <table>
      <thead>
        <tr>
          <th>Date</th>
          <th>Type</th>
          <th>Category</th>
          <th>Amount</th>
          <th>Notes</th>
        </tr>
      </thead>
      <tbody>
        ${rowsHtml}
      </tbody>
    </table>
  </body>
</html>`;
};

const openPrintWindow = (title: string, html: string) => {
  const popup = globalThis.window?.open("", "_blank", "noopener,noreferrer");
  if (!popup) {
    return;
  }
  popup.document.open();
  popup.document.write(html);
  popup.document.close();
  popup.document.title = title;
  popup.focus();
  popup.setTimeout(() => popup.print(), 300);
};

const buildCategoryTrendData = (
  transactions: Transaction[],
  categoryMap: Map<string, string>,
  startDate: string,
  endDate: string
): { data: Array<Record<string, number | string>>; series: CategoryTrendSeries[] } => {
  if (!startDate || !endDate) {
    return { data: [], series: [] };
  }

  const rangeMonths: Array<{ key: string; label: string }> = [];
  let cursor = dayjs(startDate).startOf("month");
  const endMonth = dayjs(endDate).startOf("month");
  while (cursor.isBefore(endMonth) || cursor.isSame(endMonth, "month")) {
    rangeMonths.push({
      key: cursor.format("YYYY-MM"),
      label: cursor.format("MMM YY"),
    });
    cursor = cursor.add(1, "month");
  }

  const totalsByCategory = new Map<string, number>();
  transactions
    .filter((tx) => tx.type === "expense" && !tx.is_transfer)
    .forEach((tx) => {
      const key = tx.category_id ?? "uncategorized";
      totalsByCategory.set(key, (totalsByCategory.get(key) ?? 0) + tx.amount);
    });

  const ranked = Array.from(totalsByCategory.entries()).sort(
    (a, b) => b[1] - a[1]
  );
  const top = ranked.slice(0, 5);
  const topKeys = new Set(top.map(([key]) => key));
  const series: CategoryTrendSeries[] = top.map(([key]) => ({
    key,
    label: resolveCategoryLabel(key, categoryMap),
  }));

  if (ranked.length > top.length) {
    series.push({ key: "other", label: "Other" });
  }

  const rows = rangeMonths.map((month) => {
    const row: Record<string, number | string> = { month: month.label };
    series.forEach((item) => {
      row[item.key] = 0;
    });
    return { key: month.key, row };
  });

  const rowMap = new Map(rows.map((item) => [item.key, item.row]));

  transactions
    .filter((tx) => tx.type === "expense" && !tx.is_transfer)
    .forEach((tx) => {
      const monthKey = dayjs(tx.date).format("YYYY-MM");
      const row = rowMap.get(monthKey);
      if (!row) return;
      const rawKey = tx.category_id ?? "uncategorized";
      const bucketKey = topKeys.has(rawKey) ? rawKey : "other";
      row[bucketKey] = Number(row[bucketKey] ?? 0) + tx.amount;
    });

  return { data: rows.map((item) => item.row), series };
};

export const Reports = () => {
  const [start, setStart] = useState<string | null>(DEFAULT_START);
  const [end, setEnd] = useState<string | null>(DEFAULT_END);

  const normalized = useMemo(() => {
    if (!start || !end) {
      return { startDate: "", endDate: "", spanDays: 0 };
    }
    const startDay = dayjs(start);
    const endDay = dayjs(end);
    if (startDay.isAfter(endDay, "day")) {
      return {
        startDate: endDay.format("YYYY-MM-DD"),
        endDate: startDay.format("YYYY-MM-DD"),
        spanDays: startDay.diff(endDay, "day") + 1,
      };
    }
    return {
      startDate: startDay.format("YYYY-MM-DD"),
      endDate: endDay.format("YYYY-MM-DD"),
      spanDays: endDay.diff(startDay, "day") + 1,
    };
  }, [start, end]);

  const startDate = normalized.startDate;
  const endDate = normalized.endDate;
  const spanDays = normalized.spanDays;
  const prevStart = startDate
    ? dayjs(startDate).subtract(spanDays || 0, "day").format("YYYY-MM-DD")
    : "";
  const prevEnd = startDate
    ? dayjs(startDate).subtract(1, "day").format("YYYY-MM-DD")
    : "";

  const { data: categories = [] } = useGetCategoriesQuery();
  const { data: accounts = [] } = useGetAccountsQuery();
  const { data: paymentMethods = [] } = useGetPaymentMethodsQuery();
  const { data: transactions = [], isLoading } = useGetTransactionsByRangeQuery(
    { start: prevStart || startDate, end: endDate },
    { skip: !startDate || !endDate }
  );

  const currentTransactions = useMemo(
    () =>
      transactions.filter((tx) =>
        startDate && endDate ? inDateRange(tx, startDate, endDate) : false
      ),
    [transactions, startDate, endDate]
  );
  const previousTransactions = useMemo(
    () =>
      transactions.filter((tx) =>
        prevStart && prevEnd ? inDateRange(tx, prevStart, prevEnd) : false
      ),
    [transactions, prevStart, prevEnd]
  );

  const categoryMap = useMemo(
    () => new Map(categories.map((category) => [category.id, category.name])),
    [categories]
  );
  const accountMap = useMemo(
    () => new Map(accounts.map((account) => [account.id, account.name])),
    [accounts]
  );
  const paymentMap = useMemo(
    () =>
      new Map(paymentMethods.map((method) => [method.id, method.name])),
    [paymentMethods]
  );

  const { incomeTotal, expenseTotal, netTotal } = useMemo(() => {
    const income = sumByType(currentTransactions, "income");
    const expense = sumByType(currentTransactions, "expense");
    return { incomeTotal: income, expenseTotal: expense, netTotal: income - expense };
  }, [currentTransactions]);

  const { prevIncome, prevExpense } = useMemo(() => {
    return {
      prevIncome: sumByType(previousTransactions, "income"),
      prevExpense: sumByType(previousTransactions, "expense"),
    };
  }, [previousTransactions]);

  const incomeChange = useMemo(
    () => buildChange(incomeTotal, prevIncome),
    [incomeTotal, prevIncome]
  );
  const expenseChange = useMemo(
    () => buildChange(expenseTotal, prevExpense),
    [expenseTotal, prevExpense]
  );

  const pieData = useMemo(() => {
    const categoryTotals = new Map<string, number>();
    currentTransactions
      .filter((tx) => tx.type === "expense" && !tx.is_transfer)
      .forEach((tx) => {
        if (!tx.category_id) return;
        categoryTotals.set(
          tx.category_id,
          (categoryTotals.get(tx.category_id) ?? 0) + tx.amount
        );
      });
    return buildPieData(categoryTotals, categoryMap).sort(
      (a, b) => b.value - a.value
    );
  }, [currentTransactions, categoryMap]);

  const dailyData = useMemo(() => {
    const dailyTotals = new Map<string, number>();
    currentTransactions
      .filter((tx) => tx.type === "expense" && !tx.is_transfer)
      .forEach((tx) => {
        dailyTotals.set(
          tx.date,
          (dailyTotals.get(tx.date) ?? 0) + tx.amount
        );
      });
    const sorted = Array.from(dailyTotals.entries()).sort((a, b) =>
      dayjs(a[0]).diff(dayjs(b[0]))
    );
    const totals = new Map<string, number>(
      sorted.map(([date, value]) => [dayjs(date).format("DD MMM"), value])
    );
    return buildDailyData(totals);
  }, [currentTransactions]);

  const { trendData, trendSeries } = useMemo(
    () =>
      buildCategoryTrendData(
        currentTransactions,
        categoryMap,
        startDate,
        endDate
      ),
    [currentTransactions, categoryMap, startDate, endDate]
  );

  const rangeLabel = startDate && endDate
    ? `${dayjs(startDate).format("DD MMM")} – ${dayjs(endDate).format("DD MMM")}`
    : "Select a range";

  const handleExportCsv = () => {
    if (!startDate || !endDate) {
      return;
    }
    const rows = buildReportCsvRows(
      currentTransactions,
      categoryMap,
      accountMap,
      paymentMap
    );
    const safeRange = `${startDate}-to-${endDate}`;
    downloadCsv(`cashcove-report-${safeRange}.csv`, rows);
  };

  const handleExportPdf = () => {
    if (!startDate || !endDate) {
      return;
    }
    const html = buildReportHtml({
      rangeLabel,
      incomeTotal,
      expenseTotal,
      netTotal,
      categoryItems: pieData.slice(0, 6),
      transactions: currentTransactions,
      categoryMap,
    });
    openPrintWindow("CashCove report", html);
  };

  return (
    <Stack gap="lg">
      <Paper withBorder shadow="sm" radius="lg" p="md">
        <Group justify="space-between" align="center" wrap="wrap">
          <Stack gap={2}>
            <Title order={4}>Reports</Title>
            <Text size="sm" c="dimmed">
              {rangeLabel}
            </Text>
          </Stack>
          <Group gap="sm" wrap="wrap" align="flex-end">
            <DateInput
              label="From"
              value={start}
              onChange={setStart}
              clearable={false}
              maxDate={end ?? dayjs().endOf("day").format("YYYY-MM-DD")}
            />
            <DateInput
              label="To"
              value={end}
              onChange={setEnd}
              clearable={false}
              maxDate={dayjs().endOf("day").format("YYYY-MM-DD")}
            />
            <Button
              variant="light"
              leftSection={<Download size={16} strokeWidth={2} />}
              onClick={handleExportCsv}
              disabled={!startDate || !endDate}
            >
              Export CSV
            </Button>
            <Button
              variant="light"
              leftSection={<FileText size={16} strokeWidth={2} />}
              onClick={handleExportPdf}
              disabled={!startDate || !endDate}
            >
              Export PDF
            </Button>
          </Group>
        </Group>
      </Paper>

      <SimpleGrid cols={{ base: 1, md: 4 }} spacing="md">
        <Paper withBorder shadow="sm" radius="lg" p="md">
          <Text size="sm" c="dimmed">
            Income
          </Text>
          <Title order={3}>{formatINR(incomeTotal)}</Title>
          <Badge variant="light" color={incomeChange.color}>
            {incomeChange.label} vs previous
          </Badge>
        </Paper>
        <Paper withBorder shadow="sm" radius="lg" p="md">
          <Text size="sm" c="dimmed">
            Expenses
          </Text>
          <Title order={3}>{formatINR(expenseTotal)}</Title>
          <Badge variant="light" color={expenseChange.color}>
            {expenseChange.label} vs previous
          </Badge>
        </Paper>
        <Paper withBorder shadow="sm" radius="lg" p="md">
          <Text size="sm" c="dimmed">
            Net
          </Text>
          <Title order={3}>{formatINR(netTotal)}</Title>
          <Text size="sm" c="dimmed">
            {netTotal >= 0 ? "Surplus" : "Deficit"}
          </Text>
        </Paper>
        <Paper withBorder shadow="sm" radius="lg" p="md">
          <Text size="sm" c="dimmed">
            Previous range
          </Text>
          <Title order={4}>
            {prevStart && prevEnd
              ? `${dayjs(prevStart).format("DD MMM")} – ${dayjs(prevEnd).format(
                  "DD MMM"
                )}`
              : "-"}
          </Title>
          <Text size="sm" c="dimmed">
            Used for MoM comparison
          </Text>
        </Paper>
      </SimpleGrid>

      <ChartsSection pieData={pieData} dailyData={dailyData} />

      <CategoryTrendChart data={trendData} series={trendSeries} />

      {isLoading ? (
        <Text size="sm" c="dimmed">
          Loading report data...
        </Text>
      ) : null}
    </Stack>
  );
};
