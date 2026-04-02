import { supabase } from "@/integrations/supabase/client";

/**
 * Fetches ALL rows from a Supabase table, bypassing the 1000-row default limit.
 * Uses range-based pagination internally.
 */
export async function fetchAllRows(
  table: string,
  options?: {
    select?: string;
    order?: { column: string; ascending?: boolean };
    pageSize?: number;
  }
): Promise<any[]> {
  const pageSize = options?.pageSize || 1000;
  const allRows: any[] = [];
  let from = 0;
  let hasMore = true;

  while (hasMore) {
    let query = (supabase.from as any)(table).select(options?.select || "*");

    if (options?.order) {
      query = query.order(options.order.column, { ascending: options.order.ascending ?? true });
    }

    query = query.range(from, from + pageSize - 1);

    const { data, error } = await query;
    if (error) throw error;

    const rows = data || [];
    allRows.push(...rows);

    if (rows.length < pageSize) {
      hasMore = false;
    } else {
      from += pageSize;
    }
  }

  return allRows;
}
