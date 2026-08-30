import { Button } from "./Button";

export function Spinner() {
  return (
    <div className="flex items-center justify-center p-8">
      <div className="h-6 w-6 animate-spin rounded-full border-2 border-border-strong border-t-success-600" />
    </div>
  );
}

export function EmptyState({
  title,
  description,
  actionLabel,
  onAction,
}: {
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <div className="rounded-lg border border-dashed border-border-strong bg-canvas p-8 text-center">
      <p className="font-medium text-ink-700">{title}</p>
      {description && <p className="mt-1 text-sm text-ink-500">{description}</p>}
      {actionLabel && onAction && (
        <Button size="sm" className="mt-4" onClick={onAction}>
          {actionLabel}
        </Button>
      )}
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div role="alert" className="rounded-lg border border-danger-600/20 bg-danger-50 p-4 text-sm text-danger-700">
      <p>{message}</p>
      {onRetry && (
        <button type="button" onClick={onRetry} className="focus-ring mt-2 font-medium underline">
          Retry
        </button>
      )}
    </div>
  );
}
