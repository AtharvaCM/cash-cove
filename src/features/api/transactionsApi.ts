import dayjs from "dayjs";
import { apiSlice } from "./baseApi";
import { supabase } from "../../lib/supabaseClient";
import type { Tag, Transaction } from "../../types/finance";
import type { DeleteByIdInput, MonthArgs, RangeArgs, TagsArgs } from "./types";

type TransactionRow = {
  id: string;
  type: "expense" | "income";
  date: string;
  amount: number;
  category_id: string | null;
  payment_method_id: string | null;
  account_id: string | null;
  notes_enc: string | null;
  is_transfer: boolean | null;
  is_reimbursement: boolean | null;
  reimbursement_category_id: string | null;
  is_recurring: boolean;
  transaction_tags?: Array<{ tags: Tag | Tag[] | null }>;
};

type AddTransactionInput = Omit<Transaction, "id" | "tags" | "notes_enc"> & {
  notes?: string | null;
  tags?: string[];
};

type UpdateTransactionInput = Omit<Transaction, "tags" | "notes_enc"> & {
  notes?: string | null;
  tags?: string[];
};

const normalizeTags = (tags: string[]) =>
  tags
    .map((tag) => tag.trim())
    .filter(Boolean)
    .map((tag) => tag.toLowerCase());

const signedAmount = (row: {
  amount: number;
  type: "expense" | "income";
  is_transfer: boolean | null;
  account_id: string | null;
}) => {
  if (!row.account_id || row.is_transfer) return 0;
  const sign = row.type === "income" ? 1 : -1;
  return sign * Number(row.amount ?? 0);
};

const applyAccountDelta = async (accountId: string | null, delta: number) => {
  if (!accountId || delta === 0) return null;
  const { data: account, error: fetchError } = await supabase
    .from("accounts")
    .select("current_balance")
    .eq("id", accountId)
    .single();
  if (fetchError || !account) {
    return fetchError ?? { message: "Account not found" };
  }
  const next = Number(account.current_balance ?? 0) + delta;
  const { error: updateError } = await supabase
    .from("accounts")
    .update({ current_balance: next })
    .eq("id", accountId);
  return updateError ?? null;
};

export const transactionsTestHelpers = {
  signedAmount,
  applyAccountDelta,
};

const mapTransactionRows = async (rows: TransactionRow[]) =>
  Promise.all(
    rows.map(async (row) => {
      const tags = row.transaction_tags
        ? row.transaction_tags.flatMap((link) => {
            if (!link.tags) {
              return [];
            }
            return Array.isArray(link.tags) ? link.tags : [link.tags];
          })
        : [];
      return {
        id: row.id,
        type: row.type,
        date: row.date,
        amount: Number(row.amount),
        category_id: row.category_id,
        reimbursement_category_id: row.reimbursement_category_id,
        payment_method_id: row.payment_method_id,
        account_id: row.account_id,
        notes: row.notes_enc ?? null,
        notes_enc: row.notes_enc,
        is_transfer: Boolean(row.is_transfer),
        is_reimbursement: Boolean(row.is_reimbursement),
        is_recurring: row.is_recurring,
        tags,
      } as Transaction;
    })
  );

export const transactionsApi = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    getTransactions: builder.query<Transaction[], MonthArgs>({
      async queryFn({ month }) {
        const start = dayjs(`${month}-01`).startOf("month");
        const end = dayjs(`${month}-01`).endOf("month");

        const { data, error } = await supabase
          .from("transactions")
          .select(
            "id, type, date, amount, category_id, reimbursement_category_id, payment_method_id, account_id, notes_enc, is_recurring, is_transfer, is_reimbursement, transaction_tags(tags(id, name))"
          )
          .gte("date", start.format("YYYY-MM-DD"))
          .lte("date", end.format("YYYY-MM-DD"))
          .order("date", { ascending: false })
          .order("created_at", { ascending: false });

        if (error) {
          return { error: { message: error.message } };
        }

        const rows = (data ?? []) as unknown as TransactionRow[];

        return { data: await mapTransactionRows(rows) };
      },
      providesTags: (result) =>
        result
          ? [
              "Transactions",
              ...result.map((transaction) => ({
                type: "Transactions" as const,
                id: transaction.id,
              })),
            ]
          : ["Transactions"],
    }),
    getTransactionsByRange: builder.query<Transaction[], RangeArgs>({
      async queryFn({ start, end }) {
        const { data, error } = await supabase
          .from("transactions")
          .select(
            "id, type, date, amount, category_id, reimbursement_category_id, payment_method_id, account_id, notes_enc, is_recurring, is_transfer, is_reimbursement, transaction_tags(tags(id, name))"
          )
          .gte("date", start)
          .lte("date", end)
          .order("date", { ascending: false })
          .order("created_at", { ascending: false });

        if (error) {
          return { error: { message: error.message } };
        }

        const rows = (data ?? []) as unknown as TransactionRow[];
        return { data: await mapTransactionRows(rows) };
      },
      providesTags: (result) =>
        result
          ? [
              "Transactions",
              ...result.map((transaction) => ({
                type: "Transactions" as const,
                id: transaction.id,
              })),
            ]
          : ["Transactions"],
    }),
    addTransaction: builder.mutation<Transaction, AddTransactionInput>({
      async queryFn({ tags, notes, ...input }) {
        const notes_enc = notes || null;

        const { data: inserted, error } = await supabase
          .from("transactions")
          .insert({
            ...input,
            notes_enc,
            is_transfer: input.is_transfer ?? false,
            is_reimbursement: input.is_reimbursement ?? false,
            reimbursement_category_id: input.reimbursement_category_id ?? null,
          })
          .select(
            "id, type, date, amount, category_id, reimbursement_category_id, payment_method_id, account_id, notes_enc, is_recurring, is_transfer, is_reimbursement"
          )
          .single();

        if (error) {
          return { error: { message: error.message } };
        }

        const accountUpdateError = await applyAccountDelta(
          inserted.account_id,
          signedAmount(inserted)
        );
        if (accountUpdateError) {
          return { error: { message: accountUpdateError.message } };
        }

        let linkedTags: Tag[] = [];
        const tagList = tags ? normalizeTags(tags) : [];

        if (tagList.length > 0) {
          const { data: tagRows, error: tagError } = await supabase
            .from("tags")
            .upsert(
              tagList.map((name) => ({ name })),
              { onConflict: "user_id,name" }
            )
            .select("id, name");

          if (tagError) {
            return { error: { message: tagError.message } };
          }

          linkedTags = (tagRows ?? []) as Tag[];

          if (linkedTags.length > 0) {
            const linkRows = linkedTags.map((tag) => ({
              tag_id: tag.id,
              transaction_id: inserted.id,
            }));
            const { error: linkError } = await supabase
              .from("transaction_tags")
              .insert(linkRows);

            if (linkError) {
              return { error: { message: linkError.message } };
            }
          }
        }

        return {
          data: {
            id: inserted.id,
            type: inserted.type,
            date: inserted.date,
            amount: Number(inserted.amount),
            category_id: inserted.category_id,
            reimbursement_category_id: inserted.reimbursement_category_id,
            payment_method_id: inserted.payment_method_id,
            account_id: inserted.account_id,
            notes: notes ?? null,
            notes_enc: inserted.notes_enc,
            is_transfer: inserted.is_transfer ?? false,
            is_reimbursement: inserted.is_reimbursement ?? false,
            is_recurring: inserted.is_recurring,
            tags: linkedTags,
          },
        };
      },
      invalidatesTags: ["Transactions", "Accounts"],
    }),
    updateTransaction: builder.mutation<Transaction, UpdateTransactionInput>({
      async queryFn({ id, tags, notes, ...input }) {
        const notes_enc = notes || null;

        const { data: existing } = await supabase
          .from("transactions")
          .select("account_id, amount, type, is_transfer")
          .eq("id", id)
          .single();

        const { data: updated, error } = await supabase
          .from("transactions")
          .update({
            ...input,
            notes_enc,
            is_transfer: input.is_transfer ?? false,
            is_reimbursement: input.is_reimbursement ?? false,
            reimbursement_category_id: input.reimbursement_category_id ?? null,
          })
          .eq("id", id)
          .select(
            "id, type, date, amount, category_id, reimbursement_category_id, payment_method_id, account_id, notes_enc, is_recurring, is_transfer, is_reimbursement"
          )
          .single();

        if (error) {
          return { error: { message: error.message } };
        }

        if (existing) {
          const oldSigned = signedAmount(existing as TransactionRow);
          const newSigned = signedAmount(updated);
          if ((existing as TransactionRow).account_id === updated.account_id) {
            const accountUpdateError = await applyAccountDelta(
              updated.account_id,
              newSigned - oldSigned
            );
            if (accountUpdateError) {
              return { error: { message: accountUpdateError.message } };
            }
          } else {
            if ((existing as TransactionRow).account_id) {
              const accountUpdateError = await applyAccountDelta(
                (existing as TransactionRow).account_id,
                -oldSigned
              );
              if (accountUpdateError) {
                return { error: { message: accountUpdateError.message } };
              }
            }
            const accountUpdateError = await applyAccountDelta(
              updated.account_id,
              newSigned
            );
            if (accountUpdateError) {
              return { error: { message: accountUpdateError.message } };
            }
          }
        }

        const { error: deleteError } = await supabase
          .from("transaction_tags")
          .delete()
          .eq("transaction_id", id);

        if (deleteError) {
          return { error: { message: deleteError.message } };
        }

        let linkedTags: Tag[] = [];
        const tagList = tags ? normalizeTags(tags) : [];

        if (tagList.length > 0) {
          const { data: tagRows, error: tagError } = await supabase
            .from("tags")
            .upsert(
              tagList.map((name) => ({ name })),
              { onConflict: "user_id,name" }
            )
            .select("id, name");

          if (tagError) {
            return { error: { message: tagError.message } };
          }

          linkedTags = (tagRows ?? []) as Tag[];

          if (linkedTags.length > 0) {
            const linkRows = linkedTags.map((tag) => ({
              tag_id: tag.id,
              transaction_id: updated.id,
            }));

            const { error: linkError } = await supabase
              .from("transaction_tags")
              .insert(linkRows);

            if (linkError) {
              return { error: { message: linkError.message } };
            }
          }
        }

        return {
          data: {
            id: updated.id,
            type: updated.type,
            date: updated.date,
            amount: Number(updated.amount),
            category_id: updated.category_id,
            reimbursement_category_id: updated.reimbursement_category_id,
            payment_method_id: updated.payment_method_id,
            account_id: updated.account_id,
            notes: notes ?? null,
            notes_enc: updated.notes_enc,
            is_transfer: updated.is_transfer ?? false,
            is_reimbursement: updated.is_reimbursement ?? false,
            is_recurring: updated.is_recurring,
            tags: linkedTags,
          },
        };
      },
      invalidatesTags: ["Transactions", "Accounts"],
    }),
    deleteTransaction: builder.mutation<void, DeleteByIdInput>({
      async queryFn({ id }) {
        const { data: existing, error: fetchError } = await supabase
          .from("transactions")
          .select("account_id, amount, type, is_transfer")
          .eq("id", id)
          .single();
        if (fetchError) {
          return { error: { message: fetchError.message } };
        }

        const { error } = await supabase
          .from("transactions")
          .delete()
          .eq("id", id);

        if (error) {
          return { error: { message: error.message } };
        }

        if (existing) {
          const delta = -signedAmount(existing as TransactionRow);
          const accountUpdateError = await applyAccountDelta(
            (existing as TransactionRow).account_id,
            delta
          );
          if (accountUpdateError) {
            return { error: { message: accountUpdateError.message } };
          }
        }

        return { data: undefined };
      },
      invalidatesTags: ["Transactions", "Accounts"],
    }),
    replaceTransactionTags: builder.mutation<void, TagsArgs>({
      async queryFn({ transactionId, tags }) {
        const normalized = normalizeTags(tags);

        const { error: deleteError } = await supabase
          .from("transaction_tags")
          .delete()
          .eq("transaction_id", transactionId);

        if (deleteError) {
          return { error: { message: deleteError.message } };
        }

        if (normalized.length === 0) {
          return { data: undefined };
        }

        const { data: tagRows, error: tagError } = await supabase
          .from("tags")
          .upsert(
            normalized.map((name) => ({ name })),
            {
              onConflict: "user_id,name",
            }
          )
          .select("id, name");

        if (tagError) {
          return { error: { message: tagError.message } };
        }

        const linkRows = (tagRows ?? []).map((tag) => ({
          tag_id: tag.id,
          transaction_id: transactionId,
        }));

        const { error: linkError } = await supabase
          .from("transaction_tags")
          .insert(linkRows);

        if (linkError) {
          return { error: { message: linkError.message } };
        }

        return { data: undefined };
      },
      invalidatesTags: ["Transactions"],
    }),
  }),
  overrideExisting: false,
});

export const {
  useGetTransactionsQuery,
  useGetTransactionsByRangeQuery,
  useAddTransactionMutation,
  useUpdateTransactionMutation,
  useDeleteTransactionMutation,
  useReplaceTransactionTagsMutation,
} = transactionsApi;
