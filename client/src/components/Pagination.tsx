interface Props {
  page: number;
  totalPages: number;
  total: number;
  pageSize: number;
  onPageChange: (page: number) => void;
}

export function Pagination({ page, totalPages, total, pageSize, onPageChange }: Props) {
  if (totalPages <= 1) return null;

  const start = (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, total);

  return (
    <div className="mt-4 flex items-center justify-between gap-3 border-t border-border pt-4 text-sm">
      <p className="text-ink-500">
        Showing <span className="font-medium text-ink-700">{start}–{end}</span> of{" "}
        <span className="font-medium text-ink-700">{total}</span>
      </p>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1}
          className="focus-ring min-h-11 rounded-sm border border-border-strong px-3.5 text-xs font-medium text-ink-700 hover:bg-canvas disabled:cursor-not-allowed disabled:opacity-40"
        >
          Previous
        </button>
        <span className="text-xs text-ink-500">
          Page {page} of {totalPages}
        </span>
        <button
          type="button"
          onClick={() => onPageChange(page + 1)}
          disabled={page >= totalPages}
          className="focus-ring min-h-11 rounded-sm border border-border-strong px-3.5 text-xs font-medium text-ink-700 hover:bg-canvas disabled:cursor-not-allowed disabled:opacity-40"
        >
          Next
        </button>
      </div>
    </div>
  );
}
