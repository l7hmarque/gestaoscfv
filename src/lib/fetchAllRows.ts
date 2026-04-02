import { supabase } from "@/integrations/supabase/client";

/**
 * Fetches ALL rows from a Supabase table, bypassing the 1000-row default limit.
 * Uses range-based pagination internally.
 */
export async function fetchAllRows<T = any>(
  table: string,
  options?: {
    select?: string;
    order?: { column: string; ascending?: boolean };
    filters?: Array<{ column: string; op: "eq" | "neq" | "in"; value: any }>;
    pageSize?: number;
  }
): Promise<T[]> {
  const pageSize = options?.pageSize || 1000;
  const allRows: T[] = [];
  let from = 0;
  let hasMore = true;

  while (hasMore) {
    let query = supabase.from(table).select(options?.select || "*");

    if (options?.filters) {
      for (const f of options.filters) {
        if (f.op === "eq") query = query.eq(f.column, f.value);
        else if (f.op === "neq") query = query.neq(f.column, f.value);
        else if (f.op === "in") query = query.in(f.column, f.value);
      }
    }

    if (options?.order) {
      query = query.order(options.order.column, { ascending: options.order.ascending ?? true });
    }

    query = query.range(from, from + pageSize - 1);

    const { data, error } = await query;
    if (error) throw error;

    const rows = (data || []) as T[];
    allRows.push(...rows);

    if (rows.length < pageSize) {
      hasMore = false;
    } else {
      from += pageSize;
    }
  }

  return allRows;
}
