import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { CheckCircle2, ClipboardList, Hourglass, Sigma } from "lucide-react";
import { fetchClasses, fetchGradebook } from "../../api/teacher";
import { Card } from "../../components/Card";
import { Button } from "../../components/Button";
import { EmptyState, Spinner } from "../../components/Feedback";
import { StatCard } from "../../components/StatCard";
import { Pagination } from "../../components/Pagination";
import { usePagination } from "../../hooks/usePagination";
import type { GradebookPupilRow } from "../../api/types";

const PAGE_SIZE = 20;

// Shared chart chrome — token hex values only (recharts props can't take Tailwind classes).
const CHART_GRID_STROKE = "#E5EAF0"; // border
const CHART_TICK_STYLE = { fontSize: 12, fill: "#98A2B3" }; // ink-400 / text muted
const CHART_TOOLTIP_STYLE = {
  backgroundColor: "#FFFFFF", // surface
  border: "1px solid #CBD5E1", // border-strong
  borderRadius: 12, // radius-sm
  fontSize: 12,
  color: "#172033", // text primary
};
const CHART_CURSOR_FILL = { fill: "rgba(23, 32, 51, 0.04)" }; // text primary @ 4%
// Royal Blue — neutral data-bar fill (Emerald is reserved for success/CTA, not general chart fill).
const CHART_BAR_FILL = "#2563EB";

function percentTone(percent: number | null): string {
  if (percent === null) return "border border-border bg-canvas text-ink-400";
  if (percent >= 80) return "bg-success-50 text-success-600";
  if (percent >= 50) return "bg-accent-100 text-accent-600";
  return "bg-danger-50 text-danger-600";
}

function truncate(text: string | null, n = 24): string {
  if (!text) return "Exam";
  return text.length > n ? `${text.slice(0, n)}…` : text;
}

function exportCsv(rows: GradebookPupilRow[], examLabels: string[], className: string) {
  const header = ["Pupil", "Email", ...examLabels, "Average %"];
  const lines = rows.map((r) =>
    [
      r.name,
      r.email,
      ...r.grades.map((g) => (g.grade !== null ? g.grade : g.submitted ? "Ungraded" : "—")),
      r.percentAverage !== null ? r.percentAverage.toFixed(1) : "—",
    ]
      .map((v) => `"${String(v).replace(/"/g, '""')}"`)
      .join(",")
  );
  const csv = [header.join(","), ...lines].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `gradebook-${className.replace(/\s+/g, "-").toLowerCase()}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export function GradebookPage() {
  const [classId, setClassId] = useState("");
  const classesQuery = useQuery({ queryKey: ["teacher", "classes"], queryFn: fetchClasses });

  useEffect(() => {
    if (!classId && classesQuery.data?.length) setClassId(classesQuery.data[0].id);
  }, [classesQuery.data, classId]);

  const gradebookQuery = useQuery({
    queryKey: ["teacher", "gradebook", classId],
    queryFn: () => fetchGradebook(classId),
    enabled: !!classId,
  });

  const classes = classesQuery.data ?? [];
  const gradebook = gradebookQuery.data;

  const chartData = useMemo(
    () =>
      (gradebook?.exams ?? []).map((e) => ({
        name: truncate(e.content, 14),
        average: e.average !== null && e.maxGrade ? Math.round((e.average / e.maxGrade) * 1000) / 10 : 0,
        graded: e.gradedCount,
        submitted: e.submissionCount,
      })),
    [gradebook]
  );

  const classAverage = useMemo(() => {
    const withAvg = (gradebook?.pupils ?? []).filter((p) => p.percentAverage !== null);
    if (!withAvg.length) return null;
    return withAvg.reduce((sum, p) => sum + (p.percentAverage ?? 0), 0) / withAvg.length;
  }, [gradebook]);

  const totalGraded = gradebook?.exams.reduce((sum, e) => sum + e.gradedCount, 0) ?? 0;
  const totalSubmitted = gradebook?.exams.reduce((sum, e) => sum + e.submissionCount, 0) ?? 0;
  const pendingGrading = totalSubmitted - totalGraded;

  const pupilRows = gradebook?.pupils ?? [];
  const { page, setPage, totalPages, pageRows } = usePagination(pupilRows, PAGE_SIZE, classId);

  if (classesQuery.isLoading) return <Spinner />;

  if (classes.length === 0) {
    return (
      <div>
        <h1 className="text-2xl font-semibold text-ink-900">Gradebook</h1>
        <div className="mt-6">
          <EmptyState title="Create a class first" description="Grades appear here once you post exams to a class." />
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-ink-900">Gradebook</h1>
          <p className="mt-1 text-sm text-ink-500">Track exam grades across every pupil in a class.</p>
        </div>
        <select
          value={classId}
          onChange={(e) => setClassId(e.target.value)}
          aria-label="Select class"
          className="focus-ring rounded-sm border border-border-strong bg-surface px-3 py-2 text-sm text-ink-900"
        >
          {classes.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>

      {gradebookQuery.isLoading ? (
        <div className="mt-6">
          <Spinner />
        </div>
      ) : !gradebook || gradebook.exams.length === 0 ? (
        <div className="mt-6">
          <EmptyState
            title="No exams yet"
            description="Create an exam post with a max grade in Communication to start tracking grades."
          />
        </div>
      ) : (
        <>
          <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              label="Class average"
              value={classAverage !== null ? `${classAverage.toFixed(1)}%` : "—"}
              hint={`${gradebook.pupils.length} pupil${gradebook.pupils.length === 1 ? "" : "s"} tracked`}
              icon={<Sigma className="h-[18px] w-[18px]" strokeWidth={1.8} />}
            />
            <StatCard
              label="Exams tracked"
              value={gradebook.exams.length}
              hint="Posts of type exam"
              icon={<ClipboardList className="h-[18px] w-[18px]" strokeWidth={1.8} />}
            />
            <StatCard
              label="Graded"
              value={totalGraded}
              hint={`out of ${totalSubmitted} submissions`}
              icon={<CheckCircle2 className="h-[18px] w-[18px]" strokeWidth={1.8} />}
            />
            <StatCard
              label="Pending grading"
              value={pendingGrading}
              hint="Submitted but not yet graded"
              icon={<Hourglass className="h-[18px] w-[18px]" strokeWidth={1.8} />}
            />
          </div>

          <Card className="mt-6 p-5">
            <h2 className="text-sm font-medium text-ink-700">Average score per exam</h2>
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={CHART_GRID_STROKE} />
                  <XAxis dataKey="name" tick={CHART_TICK_STYLE} />
                  <YAxis domain={[0, 100]} tickFormatter={(v) => `${v}%`} tick={CHART_TICK_STYLE} />
                  <Tooltip formatter={(value) => [`${value}%`, "Average"]} contentStyle={CHART_TOOLTIP_STYLE} cursor={CHART_CURSOR_FILL} />
                  <Bar dataKey="average" fill={CHART_BAR_FILL} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>

          <div className="mt-6 flex justify-end">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => exportCsv(gradebook.pupils, gradebook.exams.map((e) => truncate(e.content, 20)), gradebook.className)}
              disabled={gradebook.pupils.length === 0}
            >
              Export CSV
            </Button>
          </div>

          <Card className="mt-4 overflow-x-auto p-5">
            {gradebook.pupils.length === 0 ? (
              <EmptyState title="No active pupils in this class" />
            ) : (
              <table className="w-full min-w-[720px] text-sm">
                <thead>
                  <tr className="text-left text-xs uppercase tracking-wide text-ink-400">
                    <th scope="col" className="pb-2 pr-3 font-medium">Pupil</th>
                    {gradebook.exams.map((e) => (
                      <th key={e.id} scope="col" className="pb-2 px-2 font-medium" title={e.content ?? "Exam"}>
                        {truncate(e.content, 16)}
                        {e.maxGrade != null && <span className="ml-1 text-ink-400">/{e.maxGrade}</span>}
                      </th>
                    ))}
                    <th scope="col" className="pb-2 pl-2 text-right font-medium">Average</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {pageRows.map((p) => (
                    <tr key={p.pupilId}>
                      <td className="py-3 pr-3">
                        <p className="font-medium text-ink-900">{p.name}</p>
                        <p className="text-xs text-ink-500">{p.email}</p>
                      </td>
                      {p.grades.map((g) => {
                        const percent = g.grade !== null && g.maxGrade ? (g.grade / g.maxGrade) * 100 : null;
                        return (
                          <td key={g.postId} className="py-3 px-2">
                            {g.grade !== null ? (
                              <span className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${percentTone(percent)}`}>
                                {g.grade}
                                {g.maxGrade != null ? `/${g.maxGrade}` : ""}
                              </span>
                            ) : g.submitted ? (
                              <span className="inline-flex rounded-full bg-accent-100 px-2 py-1 text-xs font-semibold text-accent-600">
                                Ungraded
                              </span>
                            ) : (
                              <span className="text-xs text-ink-400">—</span>
                            )}
                          </td>
                        );
                      })}
                      <td className="py-3 pl-2 text-right">
                        <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${percentTone(p.percentAverage)}`}>
                          {p.percentAverage !== null ? `${p.percentAverage.toFixed(1)}%` : "—"}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            <Pagination page={page} totalPages={totalPages} total={pupilRows.length} pageSize={PAGE_SIZE} onPageChange={setPage} />
          </Card>
        </>
      )}
    </div>
  );
}
