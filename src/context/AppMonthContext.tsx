/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import dayjs from "dayjs";
import { formatMonthLabel } from "../lib/format";

type AppMonthContextValue = {
  month: string;
  setMonth: (value: string) => void;
  monthLabel: string;
};

const AppMonthContext = createContext<AppMonthContextValue | null>(null);
const STORAGE_KEY = "cashcove:month";

const loadInitialMonth = () => {
  if (typeof window === "undefined") {
    return dayjs().format("YYYY-MM");
  }
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored && dayjs(stored + "-01").isValid()) {
      return dayjs(stored + "-01").format("YYYY-MM");
    }
  } catch {
    // ignore storage errors
  }
  return dayjs().format("YYYY-MM");
};

export const AppMonthProvider = ({ children }: { children: ReactNode }) => {
  const [month, setMonthState] = useState(loadInitialMonth);
  const monthLabel = useMemo(() => formatMonthLabel(month), [month]);

  const setMonth = (value: string) => {
    const normalized = dayjs(value + "-01").isValid()
      ? dayjs(value + "-01").format("YYYY-MM")
      : dayjs().format("YYYY-MM");
    setMonthState(normalized);
  };

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, month);
    } catch {
      // ignore storage errors
    }
  }, [month]);

  return (
    <AppMonthContext.Provider value={{ month, setMonth, monthLabel }}>
      {children}
    </AppMonthContext.Provider>
  );
};

export const useAppMonth = () => {
  const context = useContext(AppMonthContext);
  if (!context) {
    throw new Error("useAppMonth must be used within AppMonthProvider");
  }
  return context;
};
