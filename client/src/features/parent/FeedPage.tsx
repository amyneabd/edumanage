import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import clsx from "clsx";
import { Paperclip } from "lucide-react";
import { fetchChildPosts } from "../../api/parent";
import { Card } from "../../components/Card";
import { EmptyState, Spinner } from "../../components/Feedback";
import { useSelectedChild } from "./useSelectedChild";
import { ChildSwitcher } from "./ChildSwitcher";
import type { PostType } from "../../api/types";

const TYPE_LABELS: Record<PostType, string> = { TEXT: "Post", FILE: "File", EXAM: "Exam" };
const TYPE_FILTERS: { value: PostType | "ALL"; label: string }[] = [
  { value: "ALL", label: "All" },
  { value: "TEXT", label: "Posts" },
  { value: "FILE", label: "Files" },
  { value: "EXAM", label: "Exams" },
];

function daysUntil(dueDate: string): number {
  const due = new Date(dueDate);
  due.setHours(0, 0, 0, 0);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.round((due.getTime() - today.getTime()) / 86_400_000);
}

function DueBadge({ dueDate }: { dueDate: string }) {
  const diff = daysUntil(dueDate);
  const overdue = diff < 0;
  const label = overdue ? "Overdue" : diff === 0 ? "Due today" : diff === 1 ? "Due tomorrow" : `Due in ${diff}d`;
  return (
    <span
      className={clsx(
        "rounded-full px-2 py-0.5 text-xs font-medium",
        overdue
          ? "bg-danger-50 text-danger-600"
          : diff <= 2
            ? "bg-accent-100 text-accent-600"
            : "border border-border bg-canvas text-ink-500"
      )}
    >
      {label}
    </span>
  );
}

export function ParentFeedPage() {
  const { pupilId, isLoading: childrenLoading } = useSelectedChild();
  const { data, isLoading } = useQuery({
    queryKey: ["parent", "posts", pupilId],
    queryFn: () => fetchChildPosts(pupilId!),
    enabled: !!pupilId,
  });
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<PostType | "ALL">("ALL");

  if (childrenLoading) return <Spinner />;

  const posts = data ?? [];
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
      <h1 className="text-2xl font-semibold text-ink-900">Class feed</h1>
      <div className="mt-4">
        <ChildSwitcher />
      </div>

      {!pupilId ? (
        <Card className="mt-6 p-5">
          <EmptyState title="No linked children yet" description="Add a child using their Parent Code to get started." />
        </Card>
      ) : isLoading ? (
        <Spinner />
      ) : (
        <>
          {posts.length > 0 && (
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
          )}

          <div className="mt-4 space-y-4">
            {!posts.length ? (
              <EmptyState title="No posts yet" description="The teacher hasn't posted anything." />
            ) : !filteredPosts.length ? (
              <EmptyState title="No posts match your filters" />
            ) : (
              filteredPosts.map((post) => (
                <Card key={post.id} className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium uppercase tracking-wide text-ink-400">
                        {TYPE_LABELS[post.type]}
                      </span>
                      {post.editedAt && (
                        <span
                          className="text-xs italic text-ink-400"
                          title={`Edited ${new Date(post.editedAt).toLocaleString()}`}
                        >
                          · edited
                        </span>
                      )}
                      {post.type === "EXAM" && !post.mySubmission && post.dueDate && <DueBadge dueDate={post.dueDate} />}
                    </div>
                    <span className="text-xs text-ink-400">{new Date(post.createdAt).toLocaleString()}</span>
                  </div>
                  {post.content && <p className="mt-2 whitespace-pre-wrap text-sm text-ink-900">{post.content}</p>}
                  {post.fileUrl && (
                    <a
                      href={post.fileUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-2 inline-flex items-center gap-1.5 rounded-sm text-sm font-medium text-accent-600 hover:text-accent-700 focus-ring"
                    >
                      <Paperclip className="h-3.5 w-3.5" strokeWidth={1.8} aria-hidden="true" /> {post.fileName}
                    </a>
                  )}
                  {post.type === "EXAM" && (
                    <div className="mt-2 border-t border-border pt-3">
                      {post.dueDate && (
                        <p className="text-xs text-ink-500">Due {new Date(post.dueDate).toLocaleDateString()}</p>
                      )}
                      {post.mySubmission ? (
                        <div>
                          <p className="mt-1 text-xs font-medium text-success-600">
                            Submitted: {post.mySubmission.fileName} on{" "}
                            {new Date(post.mySubmission.submittedAt).toLocaleDateString()}
                          </p>
                          {post.mySubmission.grade !== null ? (
                            <div className="mt-2 rounded-sm bg-canvas px-3 py-2">
                              <span
                                className={clsx(
                                  "inline-flex rounded-full px-2.5 py-1 text-xs font-semibold",
                                  post.maxGrade && post.mySubmission.grade / post.maxGrade >= 0.8
                                    ? "bg-success-50 text-success-600"
                                    : post.maxGrade && post.mySubmission.grade / post.maxGrade >= 0.5
                                      ? "bg-accent-100 text-accent-600"
                                      : "bg-danger-50 text-danger-600"
                                )}
                              >
                                {post.mySubmission.grade}
                                {post.maxGrade != null ? `/${post.maxGrade}` : ""}
                              </span>
                              {post.mySubmission.feedback && (
                                <p className="mt-1.5 whitespace-pre-wrap text-xs text-ink-700">
                                  "{post.mySubmission.feedback}"
                                </p>
                              )}
                            </div>
                          ) : (
                            <p className="mt-1 text-xs text-ink-400">Awaiting grade</p>
                          )}
                        </div>
                      ) : (
                        <p className="mt-1 text-xs text-ink-400">Not yet submitted</p>
                      )}
                    </div>
                  )}
                </Card>
              ))
            )}
          </div>
        </>
      )}
    </div>
  );
}
