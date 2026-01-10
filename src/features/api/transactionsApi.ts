import dayjs from "dayjs";
import { apiSlice } from "./baseApi";
import { supabase } from "../../lib/supabaseClient";
import type { Tag, Transaction } from "../../types/finance";
import type { DeleteByIdInput, MonthArgs, TagsArgs } from "./types";

type TransactionRow = {
  id: string;
  type: "expense" | "income";
  date: string;
  amount: number;
  category_id: string | null;
  payment_method_id: string | null;
  notes_enc: string | null;
  is_transfer: boolean | null;
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

export const transactionsApi = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    getTransactions: builder.query<Transaction[], MonthArgs>({
      async queryFn({ month }) {
        const start = dayjs(`${month}-01`).startOf("month");
        const end = dayjs(`${month}-01`).endOf("month");

        const { data, error } = await supabase
          .from("transactions")
          .select(
            "id, type, date, amount, category_id, payment_method_id, notes_enc, is_recurring, is_transfer, transaction_tags(tags(id, name))"
          )
          .gte("date", start.format("YYYY-MM-DD"))
          .lte("date", end.format("YYYY-MM-DD"))
          .order("date", { ascending: false })
          .order("created_at", { ascending: false });

        if (error) {
          return { error: { message: error.message } };
        }

        const rows = (data ?? []) as unknown as TransactionRow[];

        const mapped = await Promise.all(
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
              payment_method_id: row.payment_method_id,
              notes: row.notes_enc ?? null,
              notes_enc: row.notes_enc,
              is_transfer: Boolean(row.is_transfer),
              is_recurring: row.is_recurring,
              tags,
            } as Transaction;
          })
        );

        return { data: mapped };
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
          .insert({ ...input, notes_enc, is_transfer: input.is_transfer ?? false })
          .select(
            "id, type, date, amount, category_id, payment_method_id, notes_enc, is_recurring, is_transfer"
          )
          .single();

        if (error) {
          return { error: { message: error.message } };
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
            payment_method_id: inserted.payment_method_id,
            notes: notes ?? null,
            notes_enc: inserted.notes_enc,
            is_transfer: inserted.is_transfer ?? false,
            is_recurring: inserted.is_recurring,
            tags: linkedTags,
          },
        };
      },
      invalidatesTags: ["Transactions"],
    }),
    updateTransaction: builder.mutation<Transaction, UpdateTransactionInput>({
      async queryFn({ id, tags, notes, ...input }) {
        const notes_enc = notes || null;

        const { data: updated, error } = await supabase
          .from("transactions")
          .update({ ...input, notes_enc, is_transfer: input.is_transfer ?? false })
          .eq("id", id)
          .select(
            "id, type, date, amount, category_id, payment_method_id, notes_enc, is_recurring, is_transfer"
          )
          .single();

        if (error) {
          return { error: { message: error.message } };
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
            payment_method_id: updated.payment_method_id,
            notes: notes ?? null,
            notes_enc: updated.notes_enc,
            is_transfer: updated.is_transfer ?? false,
            is_recurring: updated.is_recurring,
            tags: linkedTags,
          },
        };
      },
      invalidatesTags: ["Transactions"],
    }),
    deleteTransaction: builder.mutation<void, DeleteByIdInput>({
      async queryFn({ id }) {
        const { error } = await supabase
          .from("transactions")
          .delete()
          .eq("id", id);

        if (error) {
          return { error: { message: error.message } };
        }

        return { data: undefined };
      },
      invalidatesTags: ["Transactions"],
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
  useAddTransactionMutation,
  useUpdateTransactionMutation,
  useDeleteTransactionMutation,
  useReplaceTransactionTagsMutation,
} = transactionsApi;
