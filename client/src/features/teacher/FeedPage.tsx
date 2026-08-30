import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import clsx from "clsx";
import { toast } from "sonner";
import { ClipboardList, FileText, Paperclip } from "lucide-react";
import { createPost, deletePost, fetchClasses, fetchPosts, gradeSubmission, updatePost } from "../../api/teacher";
import { Button } from "../../components/Button";
import { Card } from "../../components/Card";
import { ConfirmDialog } from "../../components/ConfirmDialog";
import { EmptyState, Spinner } from "../../components/Feedback";
import type { ClassSummary, Post, PostType } from "../../api/types";

const TYPE_LABELS: Record<PostType, string> = { TEXT: "Post", FILE: "File", EXAM: "Exam" };
const TYPE_FILTERS: { value: PostType | "ALL"; label: string }[] = [
  { value: "ALL", label: "All" },
  { value: "TEXT", label: "Posts" },
  { value: "FILE", label: "Files" },
  { value: "EXAM", label: "Exams" },
];

function toDateInputValue(iso: string | null): string {
  return iso ? iso.slice(0, 10) : "";
}

export function FeedPage() {
  const queryClient = useQueryClient();
  const classesQuery = useQuery({ queryKey: ["teacher", "classes"], queryFn: fetchClasses });
  const [classId, setClassId] = useState("");
  const [content, setContent] = useState("");
  const [isExam, setIsExam] = useState(false);
  const [dueDate, setDueDate] = useState("");
  const [maxGrade, setMaxGrade] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<PostType | "ALL">("ALL");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Post | null>(null);

  useEffect(() => {
    if (!classId && classesQuery.data?.length) setClassId(classesQuery.data[0].id);
  }, [classesQuery.data, classId]);

  const postsQuery = useQuery({
    queryKey: ["teacher", "posts", classId],
    queryFn: () => fetchPosts(classId),
    enabled: !!classId,
  });

  const invalidatePosts = () => queryClient.invalidateQueries({ queryKey: ["teacher", "posts", classId] });

  const createMutation = useMutation({
    mutationFn: () =>
      createPost({
        classId,
        type: isExam ? "EXAM" : file ? "FILE" : "TEXT",
        content: content || undefined,
        dueDate: isExam && dueDate ? dueDate : undefined,
        maxGrade: isExam && maxGrade ? Number(maxGrade) : undefined,
        file,
      }),
    onSuccess: () => {
      toast.success(isExam ? "Exam posted." : "Posted to class feed.");
      setContent("");
      setFile(null);
      setIsExam(false);
      setDueDate("");
      setMaxGrade("");
      if (fileInputRef.current) fileInputRef.current.value = "";
      invalidatePosts();
    },
  });

  const updateMutation = useMutation({
    mutationFn: (input: {
      id: string;
      content?: string;
      dueDate?: string | null;
      maxGrade?: number | null;
      file?: File | null;
    }) =>
      updatePost(input.id, {
        content: input.content,
        dueDate: input.dueDate,
        maxGrade: input.maxGrade,
        file: input.file,
      }),
    onSuccess: () => {
      setEditingId(null);
      invalidatePosts();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deletePost(id),
    onSuccess: () => {
      toast.success("Post deleted.");
      setDeleteTarget(null);
      invalidatePosts();
    },
  });

  if (classesQuery.isLoading) return <Spinner />;

  const classes = classesQuery.data ?? [];
  const activeClass = classes.find((c) => c.id === classId);

  if (classes.length === 0) {
    return (
      <div>
        <h1 className="text-2xl font-semibold text-ink-900">Communication</h1>
        <div className="mt-6">
          <EmptyState title="Create a class first" description="Posts and exams live inside a class channel." />
        </div>
      </div>
    );
  }

  const posts = postsQuery.data ?? [];
  const filteredPosts = posts.filter((post) => {
    if (typeFilter !== "ALL" && post.type !== typeFilter) return false;
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      const haystack = `${post.content ?? ""} ${post.fileName ?? ""}`.toLowerCase();
      if (!haystack.includes(q)) return false;
    }
    return true;
  });

  return (
    <div className="mx-auto max-w-2xl">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-ink-900">Communication</h1>
        <select
          value={classId}
          onChange={(e) => {
            setClassId(e.target.value);
            setEditingId(null);
            setExpandedId(null);
          }}
          className="focus-ring rounded-sm border border-border-strong bg-surface px-3 py-2 text-sm text-ink-900"
        >
          {classes.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>

      <Card className="mt-5 p-4">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            createMutation.mutate();
          }}
        >
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder={`Post something to ${classes.find((c) => c.id === classId)?.name ?? "this class"}…`}
            rows={3}
            className="w-full resize-none rounded-sm border border-border px-3 py-2 text-sm focus-ring"
          />
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <input
              ref={fileInputRef}
              type="file"
              accept="application/pdf,image/*"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="rounded-sm text-xs text-ink-500 focus-ring"
            />
            <label className="flex items-center gap-1.5 text-xs font-medium text-ink-700">
              <input
                type="checkbox"
                checked={isExam}
                onChange={(e) => setIsExam(e.target.checked)}
                className="rounded-sm focus-ring"
              />
              This is an exam
            </label>
            {isExam && (
              <>
                <input
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  className="rounded-sm border border-border-strong px-2 py-1 text-xs focus-ring"
                />
                <input
                  type="number"
                  min={1}
                  step="any"
                  value={maxGrade}
                  onChange={(e) => setMaxGrade(e.target.value)}
                  placeholder="Max grade"
                  className="w-24 rounded-sm border border-border-strong px-2 py-1 text-xs focus-ring"
                />
              </>
            )}
            <div className="ml-auto">
              <Button type="submit" size="sm" disabled={createMutation.isPending || (!content && !file)}>
                {createMutation.isPending ? "Posting…" : "Post"}
              </Button>
            </div>
          </div>
        </form>
      </Card>

      <div className="mt-5 flex flex-wrap items-center gap-2">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search posts…"
          className="min-w-[10rem] flex-1 rounded-sm border border-border-strong px-3 py-1.5 text-sm focus-ring"
        />
        <div className="flex items-center gap-1 rounded-sm border border-border p-0.5">
          {TYPE_FILTERS.map((f) => (
            <button
              key={f.value}
              type="button"
              onClick={() => setTypeFilter(f.value)}
              className={clsx(
                "rounded-sm px-2.5 py-1 text-xs font-medium transition-colors focus-ring",
                typeFilter === f.value ? "bg-accent-600 text-white" : "text-ink-500 hover:bg-canvas"
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-4 space-y-4">
        {postsQuery.isLoading ? (
          <Spinner />
        ) : !filteredPosts.length ? (
          <EmptyState title={posts.length ? "No posts match your filters" : "No posts yet"} />
        ) : (
          filteredPosts.map((post) => (
            <PostCard
              key={post.id}
              post={post}
              isEditing={editingId === post.id}
              onEdit={() => setEditingId(post.id)}
              onCancelEdit={() => setEditingId(null)}
              onSave={(input) => updateMutation.mutate({ id: post.id, ...input })}
              saving={updateMutation.isPending && updateMutation.variables?.id === post.id}
              onDelete={() => setDeleteTarget(post)}
              deleting={deleteMutation.isPending && deleteMutation.variables === post.id}
              expanded={expandedId === post.id}
              onToggleExpand={() => setExpandedId(expandedId === post.id ? null : post.id)}
              rosterPupils={activeClass?.pupils ?? []}
            />
          ))
        )}
      </div>

      <ConfirmDialog
        open={!!deleteTarget}
        title="Delete this post?"
        description={
          deleteTarget?.type === "EXAM"
            ? "This exam and every pupil submission and grade attached to it will be permanently deleted."
            : "This can't be undone."
        }
        confirmLabel="Delete"
        isPending={deleteMutation.isPending}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
      />
    </div>
  );
}

function PostCard({
  post,
  isEditing,
  onEdit,
  onCancelEdit,
  onSave,
  saving,
  onDelete,
  deleting,
  expanded,
  onToggleExpand,
  rosterPupils,
}: {
  post: Post;
  isEditing: boolean;
  onEdit: () => void;
  onCancelEdit: () => void;
  onSave: (input: { content?: string; dueDate?: string | null; maxGrade?: number | null; file?: File | null }) => void;
  saving: boolean;
  onDelete: () => void;
  deleting: boolean;
  expanded: boolean;
  onToggleExpand: () => void;
  rosterPupils: ClassSummary["pupils"];
}) {
  return (
    <Card className="p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="flex items-center gap-1 text-xs font-medium uppercase tracking-wide text-ink-400">
            {post.type === "FILE" && <FileText className="h-3.5 w-3.5" strokeWidth={1.8} aria-hidden="true" />}
            {post.type === "EXAM" && <ClipboardList className="h-3.5 w-3.5" strokeWidth={1.8} aria-hidden="true" />}
            {TYPE_LABELS[post.type]}
          </span>
          {post.editedAt && (
            <span className="text-xs italic text-ink-400" title={`Edited ${new Date(post.editedAt).toLocaleString()}`}>
              · edited
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-ink-400">{new Date(post.createdAt).toLocaleString()}</span>
          {!isEditing && (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onEdit}
                className="rounded-sm text-xs font-medium text-accent-600 hover:text-accent-700 focus-ring"
              >
                Edit
              </button>
              <button
                type="button"
                onClick={onDelete}
                disabled={deleting}
                className="rounded-sm text-xs font-medium text-danger-600 hover:text-danger-700 focus-ring disabled:opacity-50"
              >
                {deleting ? "Deleting…" : "Delete"}
              </button>
            </div>
          )}
        </div>
      </div>

      {isEditing ? (
        <div className="mt-2">
          <PostEditForm post={post} saving={saving} onCancel={onCancelEdit} onSave={onSave} />
        </div>
      ) : (
        <>
          {post.content && <p className="mt-2 whitespace-pre-wrap text-sm text-ink-900">{post.content}</p>}
          {post.fileUrl && (
            <a
              href={post.fileUrl}
              target="_blank"
              rel="noreferrer"
              className="mt-2 inline-flex items-center gap-1.5 rounded-sm text-sm font-medium text-accent-600 hover:text-accent-700 focus-ring"
            >
              <Paperclip className="h-3.5 w-3.5" strokeWidth={1.8} aria-hidden="true" />
              {post.fileName}
            </a>
          )}
          {post.type === "EXAM" && (
            <ExamSubmissions post={post} expanded={expanded} onToggleExpand={onToggleExpand} rosterPupils={rosterPupils} />
          )}
        </>
      )}
    </Card>
  );
}

function PostEditForm({
  post,
  saving,
  onCancel,
  onSave,
}: {
  post: Post;
  saving: boolean;
  onCancel: () => void;
  onSave: (input: { content?: string; dueDate?: string | null; maxGrade?: number | null; file?: File | null }) => void;
}) {
  const [content, setContent] = useState(post.content ?? "");
  const [dueDate, setDueDate] = useState(toDateInputValue(post.dueDate));
  const [maxGrade, setMaxGrade] = useState(post.maxGrade != null ? String(post.maxGrade) : "");
  const [file, setFile] = useState<File | null>(null);

  return (
    <div>
      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        rows={3}
        className="w-full resize-none rounded-sm border border-border px-3 py-2 text-sm focus-ring"
        autoFocus
      />
      <div className="mt-2 flex flex-wrap items-center gap-3">
        {post.type === "EXAM" && (
          <>
            <input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="rounded-sm border border-border-strong px-2 py-1 text-xs focus-ring"
            />
            <input
              type="number"
              min={1}
              step="any"
              value={maxGrade}
              onChange={(e) => setMaxGrade(e.target.value)}
              placeholder="Max grade"
              className="w-24 rounded-sm border border-border-strong px-2 py-1 text-xs focus-ring"
            />
          </>
        )}
        {post.type !== "TEXT" && (
          <label className="flex items-center gap-1 text-xs text-ink-500">
            Replace file
            <input
              type="file"
              accept="application/pdf,image/*"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="rounded-sm text-xs text-ink-500 focus-ring"
            />
          </label>
        )}
        <div className="ml-auto flex items-center gap-2">
          <Button type="button" variant="ghost" size="sm" onClick={onCancel} disabled={saving}>
            Cancel
          </Button>
          <Button
            type="button"
            size="sm"
            disabled={saving}
            onClick={() =>
              onSave({
                content,
                dueDate: post.type === "EXAM" ? dueDate || null : undefined,
                maxGrade: post.type === "EXAM" ? (maxGrade ? Number(maxGrade) : null) : undefined,
                file,
              })
            }
          >
            {saving ? "Saving…" : "Save"}
          </Button>
        </div>
      </div>
    </div>
  );
}

function ExamSubmissions({
  post,
  expanded,
  onToggleExpand,
  rosterPupils,
}: {
  post: Post;
  expanded: boolean;
  onToggleExpand: () => void;
  rosterPupils: ClassSummary["pupils"];
}) {
  const queryClient = useQueryClient();
  const submissions = post.submissions ?? [];
  const submittedIds = new Set(submissions.map((s) => s.pupilId));
  const activeRoster = rosterPupils.filter((p) => p.user.status === "ACTIVE");
  const missing = activeRoster.filter((p) => !submittedIds.has(p.userId));
  const gradedCount = submissions.filter((s) => s.grade !== null).length;

  const gradeMutation = useMutation({
    mutationFn: (input: { submissionId: string; grade: number | null; feedback?: string | null }) =>
      gradeSubmission(input.submissionId, { grade: input.grade, feedback: input.feedback }),
    onSuccess: () => {
      toast.success("Grade saved.");
      queryClient.invalidateQueries({ queryKey: ["teacher", "posts", post.classId] });
    },
  });

  return (
    <div className="mt-3 border-t border-border pt-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-xs text-ink-500">
          {post.dueDate && <span>Due {new Date(post.dueDate).toLocaleDateString()} · </span>}
          {submissions.length} of {activeRoster.length} submitted
          {submissions.length > 0 && <span> · {gradedCount} of {submissions.length} graded</span>}
          {post.maxGrade != null && <span> · out of {post.maxGrade}</span>}
        </div>
        <button
          type="button"
          onClick={onToggleExpand}
          className="rounded-sm text-xs font-medium text-accent-600 hover:text-accent-700 focus-ring"
        >
          {expanded ? "Hide roster" : "View & grade"}
        </button>
      </div>

      {expanded && (
        <div className="mt-3 space-y-4">
          <div>
            <p className="text-xs font-medium text-ink-500">Submitted ({submissions.length})</p>
            {submissions.length === 0 ? (
              <p className="mt-1 text-xs text-ink-400">No submissions yet.</p>
            ) : (
              <ul className="mt-2 space-y-2">
                {submissions.map((s) => (
                  <SubmissionGradeRow
                    key={s.id}
                    submission={s}
                    maxGrade={post.maxGrade}
                    onSave={(grade, feedback) => gradeMutation.mutate({ submissionId: s.id, grade, feedback })}
                    saving={gradeMutation.isPending && gradeMutation.variables?.submissionId === s.id}
                  />
                ))}
              </ul>
            )}
          </div>
          <div>
            <p className="text-xs font-medium text-ink-500">Missing ({missing.length})</p>
            {missing.length === 0 ? (
              <p className="mt-1 text-xs text-ink-400">Everyone has submitted.</p>
            ) : (
              <ul className="mt-1 space-y-1">
                {missing.map((p) => (
                  <li key={p.userId} className="text-xs text-ink-700">
                    {p.user.name}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function SubmissionGradeRow({
  submission,
  maxGrade,
  onSave,
  saving,
}: {
  submission: NonNullable<Post["submissions"]>[number];
  maxGrade: number | null;
  onSave: (grade: number | null, feedback?: string | null) => void;
  saving: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [grade, setGrade] = useState(submission.grade != null ? String(submission.grade) : "");
  const [feedback, setFeedback] = useState(submission.feedback ?? "");
  const isGraded = submission.grade !== null;

  if (!editing) {
    return (
      <li className="rounded-sm bg-canvas px-3 py-2 text-xs">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <a
              href={submission.fileUrl}
              target="_blank"
              rel="noreferrer"
              className="rounded-sm font-medium text-accent-600 hover:text-accent-700 focus-ring"
            >
              {submission.pupil?.user.name ?? "Pupil"}
            </a>
            <span className="text-ink-400"> · {new Date(submission.submittedAt).toLocaleDateString()}</span>
          </div>
          <div className="flex items-center gap-2">
            {isGraded ? (
              <span className="rounded-full bg-success-50 px-2 py-0.5 font-semibold text-success-600">
                {submission.grade}{maxGrade != null ? `/${maxGrade}` : ""}
              </span>
            ) : (
              <span className="rounded-full bg-accent-100 px-2 py-0.5 font-semibold text-accent-600">Ungraded</span>
            )}
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="rounded-sm font-medium text-accent-600 hover:text-accent-700 focus-ring"
            >
              {isGraded ? "Edit grade" : "Grade"}
            </button>
          </div>
        </div>
        {submission.feedback && <p className="mt-1 whitespace-pre-wrap text-ink-700">"{submission.feedback}"</p>}
      </li>
    );
  }

  return (
    <li className="rounded-sm bg-accent-50 px-3 py-2 text-xs" style={{ boxShadow: "inset 3px 0 0 #2563EB" }}>
      <div className="flex items-center justify-between gap-2">
        <span className="font-medium text-ink-900">{submission.pupil?.user.name ?? "Pupil"}</span>
        <a
          href={submission.fileUrl}
          target="_blank"
          rel="noreferrer"
          className="rounded-sm text-accent-600 hover:text-accent-700 focus-ring"
        >
          View file
        </a>
      </div>
      <div className="mt-2 flex items-center gap-2">
        <input
          type="number"
          min={0}
          max={maxGrade ?? undefined}
          step="any"
          value={grade}
          onChange={(e) => setGrade(e.target.value)}
          placeholder="Grade"
          className="w-20 rounded-sm border border-border-strong px-2 py-1 focus-ring"
          autoFocus
        />
        {maxGrade != null && <span className="text-ink-400">/ {maxGrade}</span>}
      </div>
      <textarea
        value={feedback}
        onChange={(e) => setFeedback(e.target.value)}
        placeholder="Feedback (optional)"
        rows={2}
        className="mt-2 w-full resize-none rounded-sm border border-border-strong px-2 py-1 text-xs focus-ring"
      />
      <div className="mt-2 flex justify-end gap-2">
        <Button type="button" variant="ghost" size="sm" onClick={() => setEditing(false)} disabled={saving}>
          Cancel
        </Button>
        <Button
          type="button"
          size="sm"
          disabled={saving || grade === ""}
          onClick={() => {
            onSave(grade === "" ? null : Number(grade), feedback || null);
            setEditing(false);
          }}
        >
          {saving ? "Saving…" : "Save grade"}
        </Button>
      </div>
    </li>
  );
}
