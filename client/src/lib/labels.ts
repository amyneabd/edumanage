import type {
  ClassType,
  PaymentStatus,
  UserStatus,
  Role,
  SwapRequestStatus,
  ParentLinkStatus,
  AttendanceDisplay,
} from "../api/types";

export const CLASS_TYPE_LABELS: Record<ClassType, string> = {
  SCIENCE: "Sciences",
  MATH: "Mathématiques",
  INFO: "Informatique",
  ECO: "Économie",
};

export const PAYMENT_STATUS_LABELS: Record<PaymentStatus, string> = {
  PAID: "Payé",
  UNPAID: "Non payé",
  INCOMPLETE: "Incomplet",
};

export const USER_STATUS_LABELS: Record<UserStatus, string> = {
  PENDING: "En attente",
  ACTIVE: "Actif",
  REJECTED: "Rejeté",
};

export const ROLE_LABELS: Record<Role, string> = {
  ADMIN: "Administrateur",
  TEACHER: "Enseignant",
  PUPIL: "Élève",
  PARENT: "Parent",
};

export const SWAP_REQUEST_STATUS_LABELS: Record<SwapRequestStatus, string> = {
  PENDING: "En attente",
  APPROVED: "Approuvée",
  DECLINED: "Refusée",
};

export const PARENT_LINK_STATUS_LABELS: Record<ParentLinkStatus, string> = {
  PENDING: "En attente",
  ACTIVE: "Active",
  REJECTED: "Rejetée",
};

export const ATTENDANCE_DISPLAY_LABELS: Record<AttendanceDisplay, string> = {
  FUTURE: "À venir",
  TODAY: "Aujourd'hui",
  PRESENT: "Présent",
  ABSENT: "Absent",
  EXCUSED: "Excusé",
  UNMARKED: "Non marqué",
};
