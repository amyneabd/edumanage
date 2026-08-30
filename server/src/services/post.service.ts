import { prisma } from "../utils/prisma.js";
import { createNotification, notifyParentsOfPupil } from "./notification.service.js";
import type { PostType } from "@prisma/client";

export class PostError extends Error {
  constructor(message: string, public status = 400) {
    super(message);
  }
}

export function listPostsForClass(classId: string) {
  return prisma.post.findMany({
    where: { classId },
    include: {
      submissions: {
        include: { pupil: { include: { user: { select: { name: true, email: true } } } } },
        orderBy: { submittedAt: "desc" },
      },
    },
    orderBy: { createdAt: "desc" },
  });
}

/** All posts across every class owned by this teacher, newest first (used by the admin dossier view). */
export function listPostsForTeacher(teacherId: string, take = 30) {
  return prisma.post.findMany({
    where: { class: { teacherId } },
    include: {
      class: { select: { id: true, name: true, type: true } },
      submissions: {
        include: { pupil: { include: { user: { select: { name: true, email: true } } } } },
        orderBy: { submittedAt: "desc" },
      },
    },
    orderBy: { createdAt: "desc" },
    take,
  });
}

async function getOwnedPost(postId: string, teacherId: string) {
  const post = await prisma.post.findUnique({ where: { id: postId }, include: { class: true } });
  if (!post || post.class.teacherId !== teacherId) throw new PostError("Post not found.", 404);
  return post;
}

export async function updatePost(
  postId: string,
  teacherId: string,
  input: { content?: string; dueDate?: string; fileUrl?: string; fileName?: string; maxGrade?: number | null }
) {
  await getOwnedPost(postId, teacherId);

  const data: {
    content?: string | null;
    dueDate?: Date | null;
    fileUrl?: string;
    fileName?: string;
    maxGrade?: number | null;
    editedAt: Date;
  } = { editedAt: new Date() };

  if (input.content !== undefined) data.content = input.content === "" ? null : input.content;
  if (input.dueDate !== undefined) data.dueDate = input.dueDate === "" ? null : new Date(input.dueDate);
  if (input.fileUrl !== undefined) {
    data.fileUrl = input.fileUrl;
    data.fileName = input.fileName;
  }
  if (input.maxGrade !== undefined) data.maxGrade = input.maxGrade;

  return prisma.post.update({ where: { id: postId }, data });
}

export async function deletePost(postId: string, teacherId: string) {
  const post = await getOwnedPost(postId, teacherId);
  await prisma.post.delete({ where: { id: postId } });
  return post;
}

export async function createPost(input: {
  classId: string;
  authorId: string;
  type: PostType;
  content?: string;
  fileUrl?: string;
  fileName?: string;
  dueDate?: string;
  maxGrade?: number | null;
}) {
  const post = await prisma.post.create({
    data: {
      classId: input.classId,
      authorId: input.authorId,
      type: input.type,
      content: input.content ?? null,
      fileUrl: input.fileUrl ?? null,
      fileName: input.fileName ?? null,
      dueDate: input.dueDate ? new Date(input.dueDate) : null,
      maxGrade: input.type === "EXAM" ? input.maxGrade ?? null : null,
    },
  });

  const pupils = await prisma.pupilProfile.findMany({
    where: { classId: input.classId, user: { status: "ACTIVE" } },
    include: { user: { select: { name: true } } },
  });
  const kind = input.type === "EXAM" ? "a new exam" : input.type === "FILE" ? "a new file" : "a new post";
  for (const pupil of pupils) {
    await notifyParentsOfPupil(pupil.userId, {
      type: "POST_PUBLISHED",
      title: "New class post",
      body: `${pupil.user.name}'s teacher shared ${kind}${input.content ? `: "${input.content.slice(0, 60)}"` : "."}`,
      link: "/parent/feed",
      dedupeKey: `post-published:${pupil.userId}:${post.id}`,
    });
  }

  return post;
}

export async function submitToExam(input: {
  postId: string;
  pupilId: string;
  fileUrl: string;
  fileName: string;
}) {
  const post = await prisma.post.findUnique({ where: { id: input.postId }, include: { class: true } });
  if (!post || post.type !== "EXAM") throw new PostError("Exam post not found.", 404);

  const isResubmission = await prisma.postSubmission.findUnique({
    where: { postId_pupilId: { postId: input.postId, pupilId: input.pupilId } },
  });

  const submission = await prisma.postSubmission.upsert({
    where: { postId_pupilId: { postId: input.postId, pupilId: input.pupilId } },
    create: {
      postId: input.postId,
      pupilId: input.pupilId,
      fileUrl: input.fileUrl,
      fileName: input.fileName,
    },
    update: {
      fileUrl: input.fileUrl,
      fileName: input.fileName,
      submittedAt: new Date(),
      // A resubmitted file invalidates any prior grade until the teacher re-reviews it.
      grade: null,
      feedback: null,
      gradedAt: null,
    },
  });

  const pupil = await prisma.pupilProfile.findUnique({
    where: { userId: input.pupilId },
    include: { user: true },
  });

  await createNotification({
    teacherId: post.class.teacherId,
    type: "EXAM_SUBMISSION",
    title: isResubmission ? "Exam resubmitted" : "Exam submitted",
    body: `${pupil?.user.name ?? "A pupil"} ${isResubmission ? "resubmitted" : "submitted"} "${
      post.content?.slice(0, 60) ?? "an exam"
    }".`,
    link: "/teacher/feed",
  });

  return submission;
}

export async function gradeSubmission(
  teacherId: string,
  submissionId: string,
  input: { grade: number | null; feedback?: string | null }
) {
  const submission = await prisma.postSubmission.findUnique({
    where: { id: submissionId },
    include: { post: { include: { class: true } }, pupil: { include: { user: true } } },
  });
  if (!submission || submission.post.class.teacherId !== teacherId) {
    throw new PostError("Submission not found.", 404);
  }
  if (submission.post.type !== "EXAM") throw new PostError("Only exam submissions can be graded.", 400);

  if (input.grade !== null) {
    if (Number.isNaN(input.grade) || input.grade < 0) {
      throw new PostError("Grade must be a non-negative number.", 400);
    }
    if (submission.post.maxGrade !== null && input.grade > submission.post.maxGrade) {
      throw new PostError(`Grade cannot exceed the maximum of ${submission.post.maxGrade}.`, 400);
    }
  }

  return prisma.postSubmission.update({
    where: { id: submissionId },
    data: {
      grade: input.grade,
      feedback: input.feedback === undefined ? undefined : input.feedback === "" ? null : input.feedback,
      gradedAt: input.grade === null ? null : new Date(),
    },
  });
}

export async function getGradebook(teacherId: string, classId: string) {
  const klass = await prisma.class.findFirst({ where: { id: classId, teacherId } });
  if (!klass) throw new PostError("Class not found.", 404);

  const [exams, pupils] = await Promise.all([
    prisma.post.findMany({
      where: { classId, type: "EXAM" },
      include: { submissions: true },
      orderBy: { createdAt: "asc" },
    }),
    prisma.pupilProfile.findMany({
      where: { classId, user: { status: "ACTIVE" } },
      include: { user: true },
      orderBy: { user: { name: "asc" } },
    }),
  ]);

  const examSummaries = exams.map((e) => {
    const graded = e.submissions.filter((s) => s.grade !== null);
    const average =
      graded.length > 0 ? graded.reduce((sum, s) => sum + (s.grade ?? 0), 0) / graded.length : null;
    return {
      id: e.id,
      content: e.content,
      dueDate: e.dueDate,
      maxGrade: e.maxGrade,
      submissionCount: e.submissions.length,
      gradedCount: graded.length,
      average,
    };
  });

  const rows = pupils.map((p) => {
    const grades = exams.map((e) => {
      const submission = e.submissions.find((s) => s.pupilId === p.userId);
      return {
        postId: e.id,
        maxGrade: e.maxGrade,
        submitted: !!submission,
        submissionId: submission?.id ?? null,
        grade: submission?.grade ?? null,
        feedback: submission?.feedback ?? null,
        gradedAt: submission?.gradedAt ?? null,
        submittedAt: submission?.submittedAt ?? null,
      };
    });

    const gradedEntries = grades.filter((g) => g.grade !== null && g.maxGrade);
    const percentAverage =
      gradedEntries.length > 0
        ? (gradedEntries.reduce((sum, g) => sum + (g.grade! / g.maxGrade!) * 100, 0) / gradedEntries.length)
        : null;

    return {
      pupilId: p.userId,
      name: p.user.name,
      email: p.user.email,
      grades,
      gradedCount: grades.filter((g) => g.grade !== null).length,
      percentAverage,
    };
  });

  return {
    classId,
    className: klass.name,
    exams: examSummaries,
    pupils: rows,
  };
}

export async function getOwnGrades(pupilId: string) {
  const submissions = await prisma.postSubmission.findMany({
    where: { pupilId, grade: { not: null } },
    include: { post: { include: { class: true } } },
    orderBy: { gradedAt: "desc" },
  });

  const graded = submissions.map((s) => ({
    submissionId: s.id,
    postId: s.postId,
    classId: s.post.classId,
    className: s.post.class.name,
    examTitle: s.post.content,
    dueDate: s.post.dueDate,
    grade: s.grade,
    maxGrade: s.post.maxGrade,
    percent: s.grade !== null && s.post.maxGrade ? (s.grade / s.post.maxGrade) * 100 : null,
    feedback: s.feedback,
    gradedAt: s.gradedAt,
    submittedAt: s.submittedAt,
  }));

  const withPercent = graded.filter((g) => g.percent !== null);
  const average = withPercent.length > 0 ? withPercent.reduce((sum, g) => sum + g.percent!, 0) / withPercent.length : null;

  const pendingCount = await prisma.postSubmission.count({
    where: { pupilId, grade: null },
  });

  return {
    average,
    gradedCount: graded.length,
    pendingCount,
    grades: graded,
  };
}
