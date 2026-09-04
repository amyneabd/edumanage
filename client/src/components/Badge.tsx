import clsx from "clsx";
import type { PaymentStatus, ClassType, UserStatus, SwapRequestStatus } from "../api/types";

const paymentColors: Record<PaymentStatus, string> = {
  PAID: "bg-success-50 text-success-700",
  UNPAID: "bg-danger-50 text-danger-600",
  INCOMPLETE: "bg-warning-100 text-warning-700",
};

const paymentLabels: Record<PaymentStatus, string> = {
  PAID: "Paid",
  UNPAID: "Unpaid",
  INCOMPLETE: "Sessions incomplete",
};

export function PaymentBadge({ status }: { status: PaymentStatus }) {
  return (
    <span className={clsx("inline-flex rounded-sm px-2.5 py-1 text-xs font-medium", paymentColors[status])}>
      {paymentLabels[status]}
    </span>
  );
}

const classTypeColors: Record<ClassType, string> = {
  SCIENCE: "bg-canvas text-ink-700 border border-border",
  MATH: "bg-canvas text-ink-700 border border-border",
  INFO: "bg-canvas text-ink-700 border border-border",
  ECO: "bg-canvas text-ink-700 border border-border",
};

export function ClassTypeBadge({ type }: { type: ClassType }) {
  return (
    <span className={clsx("inline-flex rounded-sm px-2.5 py-1 text-xs font-medium", classTypeColors[type])}>
      {type}
    </span>
  );
}

const statusColors: Record<UserStatus, string> = {
  PENDING: "bg-warning-100 text-warning-700",
  ACTIVE: "bg-success-50 text-success-700",
  REJECTED: "bg-canvas text-ink-700 border border-border",
};

export function StatusBadge({ status }: { status: UserStatus }) {
  return (
    <span className={clsx("inline-flex rounded-sm px-2.5 py-1 text-xs font-medium", statusColors[status])}>
      {status}
    </span>
  );
}

const swapStatusColors: Record<SwapRequestStatus, string> = {
  PENDING: "bg-warning-100 text-warning-700",
  APPROVED: "bg-success-50 text-success-700",
  DECLINED: "bg-danger-50 text-danger-600",
};

const swapStatusLabels: Record<SwapRequestStatus, string> = {
  PENDING: "Pending",
  APPROVED: "Approved",
  DECLINED: "Declined",
};

export function SwapStatusBadge({ status }: { status: SwapRequestStatus }) {
  return (
    <span className={clsx("inline-flex rounded-sm px-2.5 py-1 text-xs font-medium", swapStatusColors[status])}>
      {swapStatusLabels[status]}
    </span>
  );
}
