import { Button, Divider, Group, Modal, Stack } from "@mantine/core";
import { useMemo, useState } from "react";
import dayjs from "dayjs";
import { useAddTransactionMutation, useGetRulesQuery } from "../../features/api/apiSlice";
import {
  buildDefaultMapping,
  buildParsedCsv,
  buildInvalidRowsCsv,
  buildInvalidRowsJson,
  isMappingReady,
  parseImportRows,
  type CsvMapping,
  type ParsedCsv,
  type ParsedImportRow,
} from "../../lib/transactionImport";
import type { Account, Category, PaymentMethod } from "../../types/finance";
import { CsvInputSection } from "./import/CsvInputSection";
import { MappingSection } from "./import/MappingSection";
import { PreviewSection } from "./import/PreviewSection";

type TransactionImportModalProps = {
  opened: boolean;
  onClose: () => void;
  categories: Category[];
  paymentMethods: PaymentMethod[];
  accounts: Account[];
};

type ImportPreset = {
  mappingOverrides: Partial<CsvMapping>;
  defaults: {
    category: string;
    payment: string;
    account: string;
    type: "expense" | "income";
    recurring: boolean;
  };
};

const loadPresetFromStorage = (): ImportPreset | null => {
  if (typeof window === "undefined") {
    return null;
  }
  try {
    const raw = localStorage.getItem("cashcove:importPreset");
    if (!raw) return null;
    return JSON.parse(raw) as ImportPreset;
  } catch {
    return null;
  }
};

export const TransactionImportModal = ({
  opened,
  onClose,
  categories,
  paymentMethods,
  accounts,
}: TransactionImportModalProps) => {
  const [preset, setPreset] = useState<ImportPreset | null>(() =>
    loadPresetFromStorage()
  );

  const [importFile, setImportFile] = useState<File | null>(null);
  const [importRaw, setImportRaw] = useState("");
  const [importHasHeader, setImportHasHeader] = useState(true);
  const [importDelimiter, setImportDelimiter] = useState("auto");
  const [importDefaultType, setImportDefaultType] = useState<"expense" | "income">(
    () => preset?.defaults.type ?? "expense"
  );
  const [importDefaultCategory, setImportDefaultCategory] = useState(
    () => preset?.defaults.category ?? ""
  );
  const [importDefaultPayment, setImportDefaultPayment] = useState(
    () => preset?.defaults.payment ?? ""
  );
  const [importDefaultAccount, setImportDefaultAccount] = useState(
    () => preset?.defaults.account ?? ""
  );
  const [importRecurring, setImportRecurring] = useState(
    () => preset?.defaults.recurring ?? false
  );
  const [importMappingOverrides, setImportMappingOverrides] = useState<
    Partial<CsvMapping>
  >(() => preset?.mappingOverrides ?? {});
  const [importError, setImportError] = useState<string | null>(null);
  const [importResult, setImportResult] = useState<{
    success: number;
    failed: number;
    errors: string[];
  } | null>(null);
  const [importProgress, setImportProgress] = useState<{
    total: number;
    completed: number;
  } | null>(null);
  const [failedRows, setFailedRows] = useState<ParsedImportRow[]>([]);
  const [hasExportedErrors, setHasExportedErrors] = useState(false);

  const [addTransaction] = useAddTransactionMutation();
  const { data: rules = [] } = useGetRulesQuery();

  const categoryMap = useMemo(
    () => new Map(categories.map((category) => [category.id, category.name])),
    [categories]
  );
  const categoryNameMap = useMemo(
    () =>
      new Map(
        categories.map((category) => [
          category.name.trim().toLowerCase(),
          category.id,
        ])
      ),
    [categories]
  );
  const paymentNameMap = useMemo(
    () =>
      new Map(
        paymentMethods.map((method) => [
          method.name.trim().toLowerCase(),
          method.id,
        ])
      ),
    [paymentMethods]
  );
  const paymentMap = useMemo(
    () => new Map(paymentMethods.map((method) => [method.id, method.name])),
    [paymentMethods]
  );
  const categoryOptions = useMemo(
    () =>
      categories.map((category) => ({
        value: category.id,
        label: category.name,
      })),
    [categories]
  );
  const paymentOptions = useMemo(
    () =>
      paymentMethods.map((method) => ({
        value: method.id,
        label: method.name,
      })),
    [paymentMethods]
  );
  const accountOptions = useMemo(
    () =>
      accounts.map((account) => ({
        value: account.id,
        label: `${account.name} · ${account.type}`,
      })),
    [accounts]
  );

  const parsedCsv = useMemo<ParsedCsv>(
    () => buildParsedCsv(importRaw, importDelimiter, importHasHeader),
    [importRaw, importDelimiter, importHasHeader]
  );

  const defaultMapping = useMemo(
    () => buildDefaultMapping(parsedCsv.headers),
    [parsedCsv.headers]
  );

  const effectiveMapping = useMemo(
    () => ({
      ...defaultMapping,
      ...importMappingOverrides,
    }),
    [defaultMapping, importMappingOverrides]
  );

  const mappingReady = isMappingReady(effectiveMapping);

  const parsedImport = useMemo(
    () =>
      parseImportRows({
        parsedCsv,
        mapping: effectiveMapping,
        hasHeader: importHasHeader,
        defaults: {
          defaultType: importDefaultType,
          defaultCategoryId: importDefaultCategory,
          defaultPaymentId: importDefaultPayment,
          defaultAccountId: importDefaultAccount,
          recurring: importRecurring,
        },
        lookups: {
          categoryByName: categoryNameMap,
          categoryById: categoryMap,
          paymentByName: paymentNameMap,
          paymentById: paymentMap,
          accountByName: new Map(
            accounts.map((acc) => [acc.name.trim().toLowerCase(), acc.id])
          ),
          accountById: new Map(accounts.map((acc) => [acc.id, acc.name])),
        },
        rules,
      }),
    [
      parsedCsv,
      effectiveMapping,
      importHasHeader,
      importDefaultType,
      importDefaultCategory,
      importDefaultPayment,
      importDefaultAccount,
      importRecurring,
      categoryNameMap,
      categoryMap,
      paymentNameMap,
      paymentMap,
      accounts,
      rules,
    ]
  );

  const clearImportFeedback = () => {
    setImportError(null);
    setImportResult(null);
    setFailedRows([]);
  };

  const savePreset = () => {
    try {
      const payload = {
        mappingOverrides: importMappingOverrides,
        defaults: {
          category: importDefaultCategory,
          payment: importDefaultPayment,
          account: importDefaultAccount,
          type: importDefaultType,
          recurring: importRecurring,
        },
      };
      localStorage.setItem("cashcove:importPreset", JSON.stringify(payload));
      setPreset(payload);
    } catch {
      // ignore save errors
    }
  };

  const resetExportState = () => {
    setHasExportedErrors(false);
  };

  const resetFeedbackForInputChange = () => {
    clearImportFeedback();
    resetExportState();
  };

  const resetMappingOverrides = () => {
    setImportMappingOverrides({});
  };

  const resetImportState = () => {
    setImportFile(null);
    setImportRaw("");
    setImportHasHeader(true);
    setImportDelimiter("auto");
    setImportDefaultType(preset?.defaults.type ?? "expense");
    setImportDefaultCategory(preset?.defaults.category ?? "");
    setImportDefaultPayment(preset?.defaults.payment ?? "");
    setImportDefaultAccount(preset?.defaults.account ?? "");
    setImportRecurring(preset?.defaults.recurring ?? false);
    setImportMappingOverrides(preset?.mappingOverrides ?? {});
    clearImportFeedback();
    resetExportState();
    setImportProgress(null);
  };

  const handleClose = () => {
    resetImportState();
    onClose();
  };


  const handleImportFileChange = (file: File | null) => {
    setImportFile(file);
    if (!file) {
      setImportRaw("");
      resetMappingOverrides();
      resetFeedbackForInputChange();
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const content = typeof reader.result === "string" ? reader.result : "";
      setImportRaw(content);
    };
    reader.readAsText(file);
    setImportRaw("");
    resetMappingOverrides();
    resetFeedbackForInputChange();
  };

  const handleImportRawChange = (value: string) => {
    setImportRaw(value);
    if (importFile) {
      setImportFile(null);
    }
    resetMappingOverrides();
    resetFeedbackForInputChange();
  };

  const handleImportDelimiterChange = (value: string | null) => {
    setImportDelimiter(value ?? "auto");
    resetMappingOverrides();
    resetFeedbackForInputChange();
  };

  const handleImportHasHeaderChange = (checked: boolean) => {
    setImportHasHeader(checked);
    resetMappingOverrides();
    resetFeedbackForInputChange();
  };

  const handleImportDefaultTypeChange = (value: string | null) => {
    setImportDefaultType((value ?? "expense") as "expense" | "income");
    resetFeedbackForInputChange();
  };

  const handleImportDefaultCategoryChange = (value: string | null) => {
    setImportDefaultCategory(value ?? "");
    resetFeedbackForInputChange();
  };

  const handleImportDefaultPaymentChange = (value: string | null) => {
    setImportDefaultPayment(value ?? "");
    resetFeedbackForInputChange();
  };
  const handleImportDefaultAccountChange = (value: string | null) => {
    setImportDefaultAccount(value ?? "");
    resetFeedbackForInputChange();
  };

  const handleImportRecurringChange = (checked: boolean) => {
    setImportRecurring(checked);
    resetFeedbackForInputChange();
  };

  const handleMappingChange = (field: keyof CsvMapping, value: string | null) => {
    setImportMappingOverrides((prev) => ({
      ...prev,
      [field]: value ?? "",
    }));
    resetFeedbackForInputChange();
  };

  const importRows = async (
    rows: ParsedImportRow[]
  ): Promise<{ success: number; failed: number }> => {
    const total = rows.length;
    setImportProgress({ total, completed: 0 });

    let success = 0;
    const failures: ParsedImportRow[] = [];

    for (const row of rows) {
      try {
        await addTransaction(row.data).unwrap();
        success += 1;
      } catch {
        failures.push(row);
      }
      setImportProgress({ total, completed: success + failures.length });
    }

    setImportProgress(null);
    setFailedRows(failures);
    setImportResult({
      success,
      failed: failures.length,
      errors: failures
        .slice(0, 5)
        .map((row) => `Row ${row.rowNumber}: failed to import.`),
    });

    return { success, failed: failures.length };
  };

  const handleImportTransactions = async () => {
    clearImportFeedback();

    if (!mappingReady) {
      setImportError("Map at least the date and amount columns.");
      return;
    }

    if (parsedImport.validRows.length === 0) {
      setImportError("No valid rows to import.");
      return;
    }

    const result = await importRows(parsedImport.validRows);
    if (result.failed === 0 && result.success > 0) {
      savePreset();
      handleClose();
    }
  };

  const handleRetryFailedRows = async () => {
    if (failedRows.length === 0) {
      return;
    }
    const rowsToRetry = [...failedRows];
    clearImportFeedback();
    await importRows(rowsToRetry);
  };

  const handleExportErrors = (format: "csv" | "json") => {
    if (parsedImport.invalidRows.length === 0) {
      return;
    }

    const content =
      format === "csv"
        ? buildInvalidRowsCsv(parsedCsv.headers, parsedImport.invalidRows)
        : buildInvalidRowsJson(parsedCsv.headers, parsedImport.invalidRows);

    if (!content) {
      return;
    }

    const mimeType =
      format === "csv" ? "text/csv;charset=utf-8;" : "application/json";
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `sanchay-import-errors-${dayjs().format(
      "YYYYMMDD-HHmm"
    )}.${format}`;
    link.click();
    URL.revokeObjectURL(url);
    setHasExportedErrors(true);
  };

  const canRetryFailedRows =
    failedRows.length > 0 &&
    (parsedImport.invalidRows.length === 0 || hasExportedErrors);
  const showRetryHint =
    failedRows.length > 0 &&
    parsedImport.invalidRows.length > 0 &&
    !hasExportedErrors;

  return (
    <Modal opened={opened} onClose={handleClose} title="Import CSV" size="xl">
      <Stack gap="md">
        <CsvInputSection
          importFile={importFile}
          importRaw={importRaw}
          importDelimiter={importDelimiter}
          importHasHeader={importHasHeader}
          importDefaultType={importDefaultType}
          detectedDelimiter={parsedCsv.delimiter}
          onFileChange={handleImportFileChange}
          onRawChange={handleImportRawChange}
          onDelimiterChange={handleImportDelimiterChange}
          onHasHeaderChange={handleImportHasHeaderChange}
          onDefaultTypeChange={handleImportDefaultTypeChange}
        />

        <Divider />

        <MappingSection
          headers={parsedCsv.headers}
          effectiveMapping={effectiveMapping}
          categoryOptions={categoryOptions}
          paymentOptions={paymentOptions}
          accountOptions={accountOptions}
          importDefaultCategory={importDefaultCategory}
          importDefaultPayment={importDefaultPayment}
          importDefaultAccount={importDefaultAccount}
          importRecurring={importRecurring}
          onMappingChange={handleMappingChange}
          onDefaultCategoryChange={handleImportDefaultCategoryChange}
          onDefaultPaymentChange={handleImportDefaultPaymentChange}
          onDefaultAccountChange={handleImportDefaultAccountChange}
          onRecurringChange={handleImportRecurringChange}
        />

        <Divider />

        <PreviewSection
          parsedRowCount={parsedCsv.rows.length}
          validRows={parsedImport.validRows}
          invalidRows={parsedImport.invalidRows}
          warnings={parsedImport.warnings}
          importError={importError}
          importResult={importResult}
          importProgress={importProgress}
          onExportErrors={handleExportErrors}
          onRetryFailedRows={handleRetryFailedRows}
          canRetryFailedRows={canRetryFailedRows}
          showRetryHint={showRetryHint}
        />

        <Group justify="flex-end">
          <Button variant="subtle" color="gray" onClick={handleClose}>
            Close
          </Button>
          <Button
            color="green"
            onClick={handleImportTransactions}
            disabled={!mappingReady || parsedImport.validRows.length === 0}
            loading={Boolean(importProgress)}
          >
            Import {parsedImport.validRows.length} rows
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
};
