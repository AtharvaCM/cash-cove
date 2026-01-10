import { apiSlice } from "./baseApi";
import { supabase } from "../../lib/supabaseClient";
import type { Fund, FundContribution } from "../../types/finance";
import type { DeleteByIdInput } from "./types";

type FundContributionRow = {
  id: string;
  fund_id: string;
  date: string;
  amount: number;
  note: string | null;
  funds?: { name: string } | { name: string }[] | null;
};

type AddFundInput = Omit<Fund, "id">;
type UpdateFundInput = Fund;

type AddFundContributionInput = {
  fund_id: string;
  date: string;
  amount: number;
  note?: string | null;
};

type UpdateFundContributionInput = {
  id: string;
  fund_id: string;
  date: string;
  amount: number;
  note?: string | null;
};

export const fundsApi = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    getFunds: builder.query<Fund[], void>({
      async queryFn() {
        const { data, error } = await supabase
          .from("funds")
          .select(
            "id, name, type, target_amount, current_amount, monthly_contribution, target_date, notes"
          )
          .order("created_at", { ascending: false });

        if (error) {
          return { error: { message: error.message } };
        }

        const mapped = (data ?? []).map((row) => ({
          ...row,
          target_amount: Number(row.target_amount ?? 0),
          current_amount: Number(row.current_amount ?? 0),
          monthly_contribution:
            row.monthly_contribution === null ||
            row.monthly_contribution === undefined
              ? null
              : Number(row.monthly_contribution),
        })) as Fund[];

        return { data: mapped };
      },
      providesTags: (result) =>
        result
          ? [
              "Funds",
              ...result.map((fund) => ({
                type: "Funds" as const,
                id: fund.id,
              })),
            ]
          : ["Funds"],
    }),
    addFund: builder.mutation<Fund, AddFundInput>({
      async queryFn(input) {
        const payload = {
          ...input,
          monthly_contribution:
            input.monthly_contribution === null ||
            input.monthly_contribution === undefined ||
            Number.isNaN(Number(input.monthly_contribution))
              ? null
              : Number(input.monthly_contribution),
          target_amount: Number(input.target_amount),
          current_amount: Number(input.current_amount),
        };

        const { data, error } = await supabase
          .from("funds")
          .insert(payload)
          .select(
            "id, name, type, target_amount, current_amount, monthly_contribution, target_date, notes"
          )
          .single();

        if (error) {
          return { error: { message: error.message } };
        }

        return {
          data: {
            ...data,
            target_amount: Number(data.target_amount ?? 0),
            current_amount: Number(data.current_amount ?? 0),
            monthly_contribution:
              data.monthly_contribution === null ||
              data.monthly_contribution === undefined
                ? null
                : Number(data.monthly_contribution),
          } as Fund,
        };
      },
      invalidatesTags: ["Funds"],
    }),
    updateFund: builder.mutation<Fund, UpdateFundInput>({
      async queryFn(input) {
        const { id, ...rest } = input;
        const payload = {
          ...rest,
          monthly_contribution:
            rest.monthly_contribution === null ||
            rest.monthly_contribution === undefined ||
            Number.isNaN(Number(rest.monthly_contribution))
              ? null
              : Number(rest.monthly_contribution),
          target_amount: Number(rest.target_amount),
          current_amount: Number(rest.current_amount),
        };

        const { data, error } = await supabase
          .from("funds")
          .update(payload)
          .eq("id", id)
          .select(
            "id, name, type, target_amount, current_amount, monthly_contribution, target_date, notes"
          )
          .single();

        if (error) {
          return { error: { message: error.message } };
        }

        return {
          data: {
            ...data,
            target_amount: Number(data.target_amount ?? 0),
            current_amount: Number(data.current_amount ?? 0),
            monthly_contribution:
              data.monthly_contribution === null ||
              data.monthly_contribution === undefined
                ? null
                : Number(data.monthly_contribution),
          } as Fund,
        };
      },
      invalidatesTags: ["Funds"],
    }),
    deleteFund: builder.mutation<void, DeleteByIdInput>({
      async queryFn({ id }) {
        const { error } = await supabase.from("funds").delete().eq("id", id);

        if (error) {
          return { error: { message: error.message } };
        }

        return { data: undefined };
      },
      invalidatesTags: ["Funds", "FundContributions"],
    }),
    getFundContributions: builder.query<FundContribution[], void>({
      async queryFn() {
        const { data, error } = await supabase
          .from("fund_contributions")
          .select("id, fund_id, date, amount, note, funds(name)")
          .order("date", { ascending: false });

        if (error) {
          return { error: { message: error.message } };
        }

        const rows = (data ?? []) as FundContributionRow[];
        const mapped = rows.map((row) => {
          const fund =
            row.funds && Array.isArray(row.funds) ? row.funds[0] : row.funds;
          return {
            id: row.id,
            fund_id: row.fund_id,
            date: row.date,
            amount: Number(row.amount ?? 0),
            note: row.note ?? null,
            fund_name: fund?.name ?? null,
          } as FundContribution;
        });

        return { data: mapped };
      },
      providesTags: (result) =>
        result
          ? [
              "FundContributions",
              ...result.map((contribution) => ({
                type: "FundContributions" as const,
                id: contribution.id,
              })),
            ]
          : ["FundContributions"],
    }),
    addFundContribution: builder.mutation<
      FundContribution,
      AddFundContributionInput
    >({
      async queryFn(input) {
        const { data: inserted, error } = await supabase
          .from("fund_contributions")
          .insert({
            ...input,
            amount: Number(input.amount),
            note: input.note?.trim() ? input.note.trim() : null,
          })
          .select("id, fund_id, date, amount, note")
          .single();

        if (error) {
          return { error: { message: error.message } };
        }

        const { data: current, error: currentError } = await supabase
          .from("funds")
          .select("current_amount")
          .eq("id", input.fund_id)
          .single();

        if (currentError) {
          return { error: { message: currentError.message } };
        }

        const nextAmount =
          Number(current?.current_amount ?? 0) + Number(inserted.amount ?? 0);

        const { error: updateError } = await supabase
          .from("funds")
          .update({ current_amount: nextAmount })
          .eq("id", input.fund_id);

        if (updateError) {
          return { error: { message: updateError.message } };
        }

        return {
          data: {
            id: inserted.id,
            fund_id: inserted.fund_id,
            date: inserted.date,
            amount: Number(inserted.amount ?? 0),
            note: inserted.note ?? null,
          },
        };
      },
      invalidatesTags: ["Funds", "FundContributions"],
    }),
    updateFundContribution: builder.mutation<
      FundContribution,
      UpdateFundContributionInput
    >({
      async queryFn({ id, fund_id, date, amount, note }) {
        const { data: existing, error: existingError } = await supabase
          .from("fund_contributions")
          .select("fund_id, amount")
          .eq("id", id)
          .single();

        if (existingError) {
          return { error: { message: existingError.message } };
        }

        const { data: updated, error } = await supabase
          .from("fund_contributions")
          .update({
            fund_id,
            date,
            amount: Number(amount),
            note: note?.trim() ? note.trim() : null,
          })
          .eq("id", id)
          .select("id, fund_id, date, amount, note")
          .single();

        if (error) {
          return { error: { message: error.message } };
        }

        const previousFundId = existing?.fund_id ?? fund_id;
        const previousAmount = Number(existing?.amount ?? 0);
        const nextAmount = Number(updated.amount ?? 0);

        if (previousFundId === fund_id) {
          const delta = nextAmount - previousAmount;
          if (delta !== 0) {
            const { data: current, error: currentError } = await supabase
              .from("funds")
              .select("current_amount")
              .eq("id", fund_id)
              .single();

            if (currentError) {
              return { error: { message: currentError.message } };
            }

            const nextCurrent = Number(current?.current_amount ?? 0) + delta;

            const { error: updateError } = await supabase
              .from("funds")
              .update({ current_amount: nextCurrent })
              .eq("id", fund_id);

            if (updateError) {
              return { error: { message: updateError.message } };
            }
          }
        } else {
          const { data: prevFund, error: prevFundError } = await supabase
            .from("funds")
            .select("current_amount")
            .eq("id", previousFundId)
            .single();

          if (prevFundError) {
            return { error: { message: prevFundError.message } };
          }

          const { data: nextFund, error: nextFundError } = await supabase
            .from("funds")
            .select("current_amount")
            .eq("id", fund_id)
            .single();

          if (nextFundError) {
            return { error: { message: nextFundError.message } };
          }

          const prevNextAmount =
            Number(prevFund?.current_amount ?? 0) - previousAmount;
          const nextNextAmount =
            Number(nextFund?.current_amount ?? 0) + nextAmount;

          const { error: updatePrevError } = await supabase
            .from("funds")
            .update({ current_amount: prevNextAmount })
            .eq("id", previousFundId);

          if (updatePrevError) {
            return { error: { message: updatePrevError.message } };
          }

          const { error: updateNextError } = await supabase
            .from("funds")
            .update({ current_amount: nextNextAmount })
            .eq("id", fund_id);

          if (updateNextError) {
            return { error: { message: updateNextError.message } };
          }
        }

        return {
          data: {
            id: updated.id,
            fund_id: updated.fund_id,
            date: updated.date,
            amount: Number(updated.amount ?? 0),
            note: updated.note ?? null,
          },
        };
      },
      invalidatesTags: ["Funds", "FundContributions"],
    }),
    deleteFundContribution: builder.mutation<void, DeleteByIdInput>({
      async queryFn({ id }) {
        const { data: existing, error: existingError } = await supabase
          .from("fund_contributions")
          .select("fund_id, amount")
          .eq("id", id)
          .single();

        if (existingError) {
          return { error: { message: existingError.message } };
        }

        const { error: deleteError } = await supabase
          .from("fund_contributions")
          .delete()
          .eq("id", id);

        if (deleteError) {
          return { error: { message: deleteError.message } };
        }

        const fundId = existing?.fund_id;
        if (!fundId) {
          return { data: undefined };
        }

        const { data: current, error: currentError } = await supabase
          .from("funds")
          .select("current_amount")
          .eq("id", fundId)
          .single();

        if (currentError) {
          return { error: { message: currentError.message } };
        }

        const nextAmount =
          Number(current?.current_amount ?? 0) - Number(existing?.amount ?? 0);

        const { error: updateError } = await supabase
          .from("funds")
          .update({ current_amount: nextAmount })
          .eq("id", fundId);

        if (updateError) {
          return { error: { message: updateError.message } };
        }

        return { data: undefined };
      },
      invalidatesTags: ["Funds", "FundContributions"],
    }),
  }),
  overrideExisting: false,
});

export const {
  useGetFundsQuery,
  useAddFundMutation,
  useUpdateFundMutation,
  useDeleteFundMutation,
  useGetFundContributionsQuery,
  useAddFundContributionMutation,
  useUpdateFundContributionMutation,
  useDeleteFundContributionMutation,
} = fundsApi;
