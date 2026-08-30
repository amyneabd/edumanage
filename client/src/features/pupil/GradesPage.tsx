import { useQuery } from "@tanstack/react-query";
import clsx from "clsx";
import { Sigma, CheckCircle2, Hourglass } from "lucide-react";
import { fetchPupilGrades } from "../../api/pupil";
import { Card } from "../../components/Card";
import { StatCard } from "../../components/StatCard";
import { EmptyState, Spinner } from "../../components/Feedback";

function percentTone(percent: number | null): string {
  if (percent === null) return "bg-canvas text-ink-400";
  if (percent >= 80) return "bg-success-50 text-success-600";
  if (percent >= 50) return "bg-accent-100 text-accent-600";
  return "bg-danger-50 text-danger-600";
}

export function PupilGradesPage() {
  const { data, isLoading } = useQuery({ queryKey: ["pupil", "grades"], queryFn: fetchPupilGrades });

  if (isLoading) return <Spinner />;

  const grades = data?.grades ?? [];

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="text-2xl font-semibold text-ink-900">Grades</h1>
      <p className="mt-1 text-sm text-ink-500">Your exam results and teacher feedback.</p>

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard
          label="Average score"
          value={data?.average !== null && data?.average !== undefined ? `${data.average.toFixed(1)}%` : "—"}
          icon={<Sigma className="h-[18px] w-[18px]" strokeWidth={1.8} />}
          accent="bg-accent-50 text-accent-600"
        />
        <StatCard
          label="Graded exams"
          value={data?.gradedCount ?? 0}
          icon={<CheckCircle2 className="h-[18px] w-[18px]" strokeWidth={1.8} />}
          accent="bg-success-50 text-success-600"
        />
        <StatCard
          label="Awaiting grade"
          value={data?.pendingCount ?? 0}
          icon={<Hourglass className="h-[18px] w-[18px]" strokeWidth={1.8} />}
          accent={(data?.pendingCount ?? 0) > 0 ? "bg-accent-50 text-accent-600" : "bg-canvas text-ink-400"}
        />
      </div>

      <Card className="mt-4 p-5">
        <h2 className="text-sm font-medium text-ink-700">Graded exams</h2>
        {grades.length === 0 ? (
          <div className="mt-3">
            <EmptyState title="No grades yet" description="Your submitted exams will show grades here once your teacher reviews them." />
          </div>
        ) : (
          <ul className="mt-3 space-y-3">
            {grades.map((g) => (
              <li key={g.submissionId} className="rounded-sm bg-canvas p-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-medium text-ink-900">{g.examTitle ?? "Exam"}</p>
                    <p className="text-xs text-ink-500">
                      {g.className}
                      {g.gradedAt && <span> · Graded {new Date(g.gradedAt).toLocaleDateString()}</span>}
                    </p>
                  </div>
                  <span className={clsx("inline-flex rounded-full px-2.5 py-1 text-xs font-semibold", percentTone(g.percent))}>
                    {g.grade}
                    {g.maxGrade != null ? `/${g.maxGrade}` : ""}
                    {g.percent !== null && <span className="ml-1 opacity-70">({g.percent.toFixed(0)}%)</span>}
                  </span>
                </div>
                {g.feedback && <p className="mt-2 whitespace-pre-wrap text-xs text-ink-700">"{g.feedback}"</p>}
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
