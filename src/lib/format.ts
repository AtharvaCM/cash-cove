export const formatINR = (value: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(value);

export const formatMonthLabel = (month: string) => {
  const [year, mon] = month.split("-").map(Number);
  if (!year || !mon) {
    return month;
  }
  const date = new Date(Date.UTC(year, mon - 1, 1));
  return date.toLocaleString("en-IN", { month: "long", year: "numeric" });
};
