import { useEffect, useMemo, useState } from "react";

/**
 * Client-side pagination over an already-fetched array. Tables in this app
 * are fed by react-query results that are also used to compute charts/KPIs
 * from the *full* filtered set, so pagination only slices what's rendered
 * in the table — it doesn't change what's fetched or aggregated.
 *
 * `resetKey` should change whenever filters change (e.g. a search string or
 * status filter), so the page resets to 1 instead of showing an empty page.
 */
export function usePagination<T>(rows: T[], pageSize: number, resetKey?: unknown) {
  const [page, setPage] = useState(1);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => setPage(1), [resetKey]);

  const totalPages = Math.max(1, Math.ceil(rows.length / pageSize));
  const safePage = Math.min(page, totalPages);

  const pageRows = useMemo(
    () => rows.slice((safePage - 1) * pageSize, safePage * pageSize),
    [rows, safePage, pageSize]
  );

  return {
    page: safePage,
    setPage,
    totalPages,
    pageRows,
    total: rows.length,
  };
}
