export type Role = "ADMIN" | "TEACHER" | "PUPIL" | "PARENT";
export type UserStatus = "PENDING" | "ACTIVE" | "REJECTED";
export type ClassType = "SCIENCE" | "MATH" | "INFO" | "ECO";
export type PaymentStatus = "PAID" | "UNPAID" | "INCOMPLETE";
export type PostType = "TEXT" | "FILE" | "EXAM";
export type NotificationType =
  | "PUPIL_REQUEST"
  | "EXAM_SUBMISSION"
  | "PAYMENT_DUE"
  | "MONTHLY_RECAP"
  | "VISIT_REQUEST"
  | "PARENT_REQUEST"
  | "POST_PUBLISHED"
  | "ABSENCE"
  | "SUBMISSION_MISSING";
export type VisitRequestStatus = "PENDING" | "APPROVED" | "DECLINED";
export type ParentLinkStatus = "PENDING" | "ACTIVE" | "REJECTED";

export interface Me {
  id: string;
  name: string;
  email: string;
  role: Role;
  status: UserStatus;
  emailVerified: boolean;
  emailVerificationRequired: boolean;
  teacherCode: string | null;
  parentCode: string | null;
}

export interface ScheduleSlot {
  id?: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
}

export interface PupilSummary {
  userId: string;
  requestedType: ClassType;
  classId: string | null;
  user: {
    id: string;
    name: string;
    email: string;
    status: UserStatus;
    createdAt: string;
  };
  payments?: { status: PaymentStatus; dueDate: string | null; period: string }[];
}

export interface ClassVisitor {
  id: string;
  pupilId: string;
  sessionDate: string;
  reason: string | null;
  pupil: { user: { name: string; email: string } };
}

export interface ClassSummary {
  id: string;
  teacherId: string;
  name: string;
  type: ClassType;
  monthlyFee: number | null;
  createdAt: string;
  pupils: PupilSummary[];
  scheduleSlots: ScheduleSlot[];
  visitRequests?: ClassVisitor[];
  _count?: { pupils: number };
}

export interface PupilRequest {
  pupilId: string;
  name: string;
  email: string;
  requestedType: ClassType;
  createdAt: string;
}

export type AttendanceStatus = "PRESENT" | "ABSENT";
export type AttendanceDisplay = "FUTURE" | "TODAY" | "PRESENT" | "ABSENT" | "UNMARKED";

export interface PupilDetail {
  userId: string;
  name: string;
  email: string;
  status: UserStatus;
  classId: string | null;
  className: string | null;
  classType: ClassType | null;
  scheduleSlots: ScheduleSlot[];
}

export interface AttendanceDay {
  date: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  display: AttendanceDisplay;
  record: AttendanceStatus | null;
}

export interface AttendanceCalendar {
  period: string;
  className: string | null;
  classType: ClassType | null;
  days: AttendanceDay[];
}

export interface ScheduleEntry {
  classId: string;
  className: string;
  classType: ClassType;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
}

export interface OverviewData {
  teacherCode: string;
  pupilCount: number;
  classCount: number;
  distribution: { classId: string; name: string; type: ClassType; pupilCount: number }[];
  schedule: ScheduleEntry[];
  paymentSummary: Record<PaymentStatus, number>;
  pendingRequests: number;
}

export interface Goal {
  id: string;
  teacherId: string;
  period: string;
  title: string;
  targetCount: number | null;
  currentCount: number;
  achieved: boolean;
  achievedAt: string | null;
  createdAt: string;
}

export interface GoalsResponse {
  period: string;
  isCurrent: boolean;
  goals: Goal[];
  total: number;
  achieved: number;
}

export interface LedgerRow {
  pupilId: string;
  name: string;
  email: string;
  classId: string | null;
  className: string | null;
  classType: ClassType | null;
  status: PaymentStatus;
  amountDue: number | null;
  amountPaid: number;
  dueDate: string | null;
  period: string;
  isOverdue: boolean;
}

export interface LedgerSummary {
  period: string;
  pupilCount: number;
  expected: number;
  collected: number;
  outstanding: number;
  overdueCount: number;
  overdueAmount: number;
  counts: Record<PaymentStatus, number>;
}

export interface PaymentHistoryEntry {
  period: string;
  status: PaymentStatus;
  amountDue: number | null;
  amountPaid: number;
  dueDate: string | null;
  paidAt: string | null;
  isOverdue: boolean;
}

export interface PostSubmissionEntry {
  id: string;
  pupilId: string;
  fileUrl: string;
  fileName: string;
  submittedAt: string;
  grade: number | null;
  feedback: string | null;
  gradedAt: string | null;
  pupil?: { user: { name: string; email: string } };
}

export interface Post {
  id: string;
  classId: string;
  authorId: string;
  type: PostType;
  content: string | null;
  fileUrl: string | null;
  fileName: string | null;
  dueDate: string | null;
  maxGrade: number | null;
  createdAt: string;
  editedAt: string | null;
  class?: { id: string; name: string; type: ClassType };
  submissions?: PostSubmissionEntry[];
  mySubmission?: {
    pupilId: string;
    fileUrl: string;
    fileName: string;
    submittedAt: string;
    grade: number | null;
    feedback: string | null;
    gradedAt: string | null;
  } | null;
}

export interface PendingTeacher {
  id: string;
  name: string;
  email: string;
  teacherCode: string;
  createdAt: string;
}

export interface AdminTeacherSummary {
  id: string;
  name: string;
  email: string;
  status: UserStatus;
  createdAt: string;
  teacherCode: string | null;
  classCount: number;
  pupilCount: number;
  pendingPupilRequests: number;
  expected: number;
  collected: number;
  outstanding: number;
  overdueCount: number;
}

export interface AdminAttendanceOverview {
  period: string;
  present: number;
  absent: number;
  total: number;
  rate: number | null;
}

export interface AdminTeacherDetail {
  id: string;
  name: string;
  email: string;
  status: UserStatus;
  createdAt: string;
  teacherCode: string;
  classes: ClassSummary[];
  ledger: LedgerRow[];
  ledgerSummary: LedgerSummary;
  posts: Post[];
  attendance: AdminAttendanceOverview;
  pendingPupilRequests: number;
  pendingVisitRequests: number;
}

export interface NotificationItem {
  id: string;
  type: NotificationType;
  title: string;
  body: string;
  link: string | null;
  read: boolean;
  createdAt: string;
}

export interface NotificationsResponse {
  items: NotificationItem[];
  unreadCount: number;
}

export interface PupilHome {
  className: string;
  classType: ClassType;
  teacherName: string;
  scheduleSlots: ScheduleSlot[];
  payment: {
    status: PaymentStatus;
    dueDate: string | null;
    period: string;
    amountDue: number | null;
    amountPaid: number;
  };
  nextSession: { dayOfWeek: number; startTime: string; endTime: string; daysUntil: number } | null;
  attendance: { present: number; absent: number; unmarked: number; rate: number | null; period: string };
  upcomingExams: { id: string; content: string | null; dueDate: string | null; isOverdue: boolean }[];
  recentPosts: Post[];
}

export interface GradeEntry {
  postId: string;
  maxGrade: number | null;
  submitted: boolean;
  submissionId: string | null;
  grade: number | null;
  feedback: string | null;
  gradedAt: string | null;
  submittedAt: string | null;
}

export interface GradebookExam {
  id: string;
  content: string | null;
  dueDate: string | null;
  maxGrade: number | null;
  submissionCount: number;
  gradedCount: number;
  average: number | null;
}

export interface GradebookPupilRow {
  pupilId: string;
  name: string;
  email: string;
  grades: GradeEntry[];
  gradedCount: number;
  percentAverage: number | null;
}

export interface Gradebook {
  classId: string;
  className: string;
  exams: GradebookExam[];
  pupils: GradebookPupilRow[];
}

export interface PupilGradeEntry {
  submissionId: string;
  postId: string;
  classId: string;
  className: string;
  examTitle: string | null;
  dueDate: string | null;
  grade: number | null;
  maxGrade: number | null;
  percent: number | null;
  feedback: string | null;
  gradedAt: string | null;
  submittedAt: string;
}

export interface PupilGrades {
  average: number | null;
  gradedCount: number;
  pendingCount: number;
  grades: PupilGradeEntry[];
}

export interface OtherClass {
  id: string;
  name: string;
  type: ClassType;
  scheduleSlots: ScheduleSlot[];
}

export interface PupilVisitRequest {
  id: string;
  classId: string;
  className: string;
  classType: ClassType;
  sessionDate: string;
  reason: string | null;
  status: VisitRequestStatus;
  createdAt: string;
  respondedAt: string | null;
}

export interface TeacherVisitRequest {
  id: string;
  classId: string;
  className: string;
  classType: ClassType;
  pupilId: string;
  pupilName: string;
  pupilEmail: string;
  sessionDate: string;
  reason: string | null;
  status: VisitRequestStatus;
  createdAt: string;
  respondedAt: string | null;
}

export interface ParentChild {
  pupilId: string;
  name: string;
  className: string | null;
  classType: ClassType;
}

export interface ParentLink {
  id: string;
  pupilId: string;
  pupilName: string;
  status: ParentLinkStatus;
  requestedAt: string;
  respondedAt: string | null;
}

export interface TeacherParentRequest {
  id: string;
  parentId: string;
  parentName: string;
  parentEmail: string;
  pupilId: string;
  pupilName: string;
  className?: string | null;
  requestedAt: string;
}
