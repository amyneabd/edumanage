import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import clsx from "clsx";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import { fetchOwnLinks, requestParentLink } from "../../api/parent";
import { extractErrorMessage } from "../../api/client";
import { Button } from "../../components/Button";
import { Card } from "../../components/Card";
import { Modal } from "../../components/Modal";
import { ClassTypeBadge } from "../../components/Badge";
import { ErrorState, Spinner } from "../../components/Feedback";
import { useSelectedChild } from "./useSelectedChild";

const linkStatusColors: Record<string, string> = {
  PENDING: "bg-warning-100 text-warning-700",
  ACTIVE: "bg-success-50 text-success-600",
  REJECTED: "bg-canvas text-ink-700 border border-border",
};

function AddChildModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [parentCode, setParentCode] = useState("");

  const mutation = useMutation({
    mutationFn: () => requestParentLink(parentCode.trim().toUpperCase()),
    onSuccess: async () => {
      toast.success("Link request sent — waiting on the teacher's approval.");
      setParentCode("");
      await queryClient.invalidateQueries({ queryKey: ["parent", "links"] });
      await queryClient.invalidateQueries({ queryKey: ["parent", "children"] });
      onClose();
    },
  });

  return (
    <Modal open={open} onClose={onClose} title="Link a child">
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          mutation.mutate();
        }}
      >
        <div>
          <label htmlFor="add-child-parent-code" className="text-sm font-medium text-ink-700">Parent Code</label>
          <input
            id="add-child-parent-code"
            required
            aria-required="true"
            value={parentCode}
            onChange={(e) => setParentCode(e.target.value)}
            placeholder="e.g. PFBV9U"
            className="focus-ring mt-1 w-full rounded-sm border border-border-strong bg-surface px-3 py-2 text-sm uppercase tracking-wider text-ink-900"
          />
          <p className="mt-1 text-xs text-ink-400">Ask your child for their Parent Code, shown on their Home page.</p>
        </div>

        {mutation.isError && <ErrorState message={extractErrorMessage(mutation.error)} />}

        <Button type="submit" className="w-full" disabled={mutation.isPending || !parentCode.trim()}>
          {mutation.isPending ? "Sending request…" : "Send request"}
        </Button>
      </form>
    </Modal>
  );
}

export function ChildSwitcher() {
  const { children, isLoading, pupilId, setPupilId } = useSelectedChild();
  const linksQuery = useQuery({ queryKey: ["parent", "links"], queryFn: fetchOwnLinks });
  const [modalOpen, setModalOpen] = useState(false);

  const pendingOrRejected = (linksQuery.data ?? []).filter((l) => l.status !== "ACTIVE");

  if (isLoading) return <Spinner />;

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        {children.map((c) => (
          <button
            key={c.pupilId}
            type="button"
            onClick={() => setPupilId(c.pupilId)}
            className={clsx(
              "focus-ring flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors",
              pupilId === c.pupilId
                ? "border-accent-600 bg-accent-50 text-accent-600"
                : "border-border text-ink-700 hover:bg-canvas"
            )}
          >
            {c.name}
            <ClassTypeBadge type={c.classType} />
          </button>
        ))}
        <button
          type="button"
          onClick={() => setModalOpen(true)}
          className="focus-ring flex items-center gap-1.5 rounded-full border border-dashed border-border-strong px-3 py-1.5 text-sm font-medium text-ink-500 hover:bg-canvas"
        >
          <Plus className="h-3.5 w-3.5" strokeWidth={1.8} aria-hidden="true" />
          Add a child
        </button>
      </div>

      {pendingOrRejected.length > 0 && (
        <Card className="mt-3 p-3">
          <p className="text-xs font-medium uppercase tracking-wide text-ink-400">Link requests</p>
          <ul className="mt-2 space-y-1.5">
            {pendingOrRejected.map((l) => (
              <li key={l.id} className="flex items-center justify-between gap-2 text-sm">
                <span className="text-ink-700">{l.pupilName}</span>
                <span className={clsx("rounded-full px-2 py-0.5 text-xs font-medium", linkStatusColors[l.status])}>
                  {l.status === "PENDING" ? "Awaiting teacher approval" : "Declined"}
                </span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <AddChildModal open={modalOpen} onClose={() => setModalOpen(false)} />
    </div>
  );
}
