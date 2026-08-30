import type { NotificationType } from "../api/types";
import { UserPlus, FileText, CreditCard, Trophy, CalendarClock, Users, BookOpen, UserX, AlertTriangle } from "lucide-react";
import type { ComponentType } from "react";

export const NOTIFICATION_META: Record<NotificationType, { Icon: ComponentType<{ className?: string }>; color: string }> = {
  PUPIL_REQUEST: { Icon: UserPlus, color: "bg-accent-50 text-accent-600" },
  EXAM_SUBMISSION: { Icon: FileText, color: "bg-success-50 text-success-600" },
  PAYMENT_DUE: { Icon: CreditCard, color: "bg-warning-100 text-warning-700" },
  MONTHLY_RECAP: { Icon: Trophy, color: "bg-navy/10 text-navy" },
  VISIT_REQUEST: { Icon: CalendarClock, color: "bg-accent-50 text-accent-600" },
  PARENT_REQUEST: { Icon: Users, color: "bg-accent-50 text-accent-600" },
  POST_PUBLISHED: { Icon: BookOpen, color: "bg-accent-50 text-accent-600" },
  ABSENCE: { Icon: UserX, color: "bg-danger-100 text-danger-700" },
  SUBMISSION_MISSING: { Icon: AlertTriangle, color: "bg-warning-100 text-warning-700" },
};
