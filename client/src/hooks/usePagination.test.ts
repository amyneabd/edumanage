import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { usePagination } from "./usePagination";

describe("usePagination", () => {
  it("slices the first page by default", () => {
    const rows = Array.from({ length: 25 }, (_, i) => i);
    const { result } = renderHook(() => usePagination(rows, 10));

    expect(result.current.page).toBe(1);
    expect(result.current.totalPages).toBe(3);
    expect(result.current.total).toBe(25);
    expect(result.current.pageRows).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
  });

  it("advances to the requested page via setPage", () => {
    const rows = Array.from({ length: 25 }, (_, i) => i);
    const { result } = renderHook(() => usePagination(rows, 10));

    act(() => result.current.setPage(3));

    expect(result.current.page).toBe(3);
    expect(result.current.pageRows).toEqual([20, 21, 22, 23, 24]);
  });

  it("clamps the page down when the row set shrinks below the current page", () => {
    const { result, rerender } = renderHook(({ rows }) => usePagination(rows, 10), {
      initialProps: { rows: Array.from({ length: 25 }, (_, i) => i) },
    });

    act(() => result.current.setPage(3));
    expect(result.current.page).toBe(3);

    rerender({ rows: Array.from({ length: 5 }, (_, i) => i) });

    expect(result.current.page).toBe(1);
    expect(result.current.totalPages).toBe(1);
    expect(result.current.pageRows).toEqual([0, 1, 2, 3, 4]);
  });

  it("resets to page 1 when resetKey changes", () => {
    const rows = Array.from({ length: 25 }, (_, i) => i);
    const { result, rerender } = renderHook(({ resetKey }) => usePagination(rows, 10, resetKey), {
      initialProps: { resetKey: "all" },
    });

    act(() => result.current.setPage(2));
    expect(result.current.page).toBe(2);

    rerender({ resetKey: "unpaid" });

    expect(result.current.page).toBe(1);
  });

  it("always returns at least 1 total page for an empty row set", () => {
    const { result } = renderHook(() => usePagination<number>([], 10));
    expect(result.current.totalPages).toBe(1);
    expect(result.current.pageRows).toEqual([]);
  });
});
