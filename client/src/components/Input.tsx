import { forwardRef, type InputHTMLAttributes } from "react";
import clsx from "clsx";

interface Props extends InputHTMLAttributes<HTMLInputElement> {
  invalid?: boolean;
}

export const Input = forwardRef<HTMLInputElement, Props>(function Input(
  { invalid, className, ...props },
  ref
) {
  return (
    <input
      ref={ref}
      aria-invalid={invalid ?? props["aria-invalid"]}
      className={clsx(
        "focus-ring mt-1 w-full rounded-sm border bg-surface px-3 py-3 text-sm text-ink-900 transition-colors placeholder:text-ink-400 disabled:cursor-not-allowed disabled:bg-canvas disabled:text-ink-400",
        invalid ? "border-danger-600" : "border-border-strong",
        className
      )}
      {...props}
    />
  );
});
