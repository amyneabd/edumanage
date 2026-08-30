import type { ButtonHTMLAttributes } from "react";
import clsx from "clsx";

type Variant = "primary" | "secondary" | "danger" | "ghost";

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: "sm" | "md";
}

const variantClasses: Record<Variant, string> = {
  primary: "bg-success-600 text-ink-900 hover:bg-success-700 disabled:bg-success-600/40",
  secondary: "bg-transparent text-navy border border-navy hover:bg-navy/5",
  danger: "bg-danger-600 text-white hover:bg-danger-700 disabled:bg-danger-600/40",
  ghost: "text-ink-700 hover:bg-canvas",
};

export function Button({
  variant = "primary",
  size = "md",
  type = "button",
  className,
  ...props
}: Props) {
  return (
    <button
      type={type}
      className={clsx(
        "focus-ring inline-flex items-center justify-center gap-1.5 rounded-sm font-medium transition-colors disabled:cursor-not-allowed",
        size === "md" ? "min-h-11 px-4 py-3 text-sm" : "min-h-9 px-2.5 py-1.5 text-xs",
        variantClasses[variant],
        className
      )}
      {...props}
    />
  );
}
