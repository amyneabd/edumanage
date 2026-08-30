import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from "recharts";
import { Users2, BookOpen, Clock, Wallet } from "lucide-react";
import { fetchOverview } from "../../api/teacher";
import { Card } from "../../components/Card";
import { StatCard } from "../../components/StatCard";
import { Spinner } from "../../components/Feedback";
import { UpcomingSchedule } from "./UpcomingSchedule";
import { PaymentHealthCard } from "./PaymentHealthCard";
import { RecentActivityCard } from "./RecentActivityCard";
import { GoalsPanel } from "./GoalsPanel";

// Mirrors index.css tokens: --color-navy, --color-accent-600, --color-success-600, --color-ink-400.
// Recharts needs literal hex (SVG fill, not a className), so these are copied verbatim rather than
// introducing new colors. Full chart chrome theming (gridlines/tooltip/legend) is Phase 4 scope.
const COLORS = ["#102A56", "#2563EB", "#20B26B", "#98A2B3"];

export function OverviewPage() {
  const { data, isLoading } = useQuery({ queryKey: ["teacher", "overview"], queryFn: fetchOverview });
  const [copied, setCopied] = useState(false);

  if (isLoading || !data) return <Spinner />;

  const chartData = data.distribution.map((d) => ({ name: d.name, value: d.pupilCount }));

  return (
    <div>
      <h1 className="text-2xl font-semibold text-ink-900">Overview</h1>
      <p className="mt-1 text-sm text-ink-500">A snapshot of your classes and pupils.</p>

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Active pupils" value={data.pupilCount} icon={<Users2 className="h-[18px] w-[18px]" />} />
        <StatCard label="Classes" value={data.classCount} icon={<BookOpen className="h-[18px] w-[18px]" />} />
        <StatCard
          label="Pending requests"
          value={data.pendingRequests}
          hint="Waiting to be assigned"
          icon={<Clock className="h-[18px] w-[18px]" />}
        />
        <StatCard label="Paid this month" value={data.paymentSummary.PAID} icon={<Wallet className="h-[18px] w-[18px]" />} />
      </div>

      <div className="mt-6">
        <GoalsPanel />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <UpcomingSchedule schedule={data.schedule} />
        <RecentActivityCard />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <PaymentHealthCard summary={data.paymentSummary} />
        <Card className="p-6">
          <h2 className="text-sm font-medium text-ink-700">Class distribution</h2>
          {chartData.length === 0 ? (
            <p className="mt-8 text-center text-sm text-ink-400">Create a class to see distribution.</p>
          ) : (
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={chartData} dataKey="value" nameKey="name" innerRadius={45} outerRadius={75} paddingAngle={3}>
                    {chartData.map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </Card>
      </div>

      <div className="mt-6">
        <Card className="p-6">
          <h2 className="text-sm font-medium text-ink-700">Teacher ID</h2>
          <p className="mt-1 text-xs text-ink-400">Share this with pupils so they can request to join your classes.</p>
          <div className="mt-4 flex items-center gap-3">
            <span className="rounded-sm border border-border bg-canvas px-4 py-2 font-mono text-lg tracking-widest text-ink-900">
              {data.teacherCode}
            </span>
            <button
              onClick={() => {
                navigator.clipboard.writeText(data.teacherCode);
                setCopied(true);
                setTimeout(() => setCopied(false), 1500);
              }}
              className="focus-ring rounded-sm text-sm font-medium text-accent-600 hover:text-accent-700"
            >
              {copied ? "Copied!" : "Copy"}
            </button>
          </div>
        </Card>
      </div>
    </div>
  );
}
