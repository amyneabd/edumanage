import { useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  DndContext,
  useDraggable,
  useDroppable,
  type DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import clsx from "clsx";
import { Plus, X } from "lucide-react";
import {
  approveParentRequest,
  approveVisitRequest,
  assignPupilRequest,
  createClass,
  declineParentRequest,
  declineVisitRequest,
  fetchAllParentRequests,
  fetchClasses,
  fetchPupilRequests,
  fetchVisitRequests,
  rejectPupilRequest,
} from "../../api/teacher";
import { Button } from "../../components/Button";
import { Card } from "../../components/Card";
import { ClassTypeBadge } from "../../components/Badge";
import { EmptyState, Spinner } from "../../components/Feedback";
import { Input } from "../../components/Input";
import { Modal } from "../../components/Modal";
import type { ClassType, PupilRequest, TeacherParentRequest, TeacherVisitRequest } from "../../api/types";

const CLASS_TYPES: ClassType[] = ["SCIENCE", "MATH", "INFO", "ECO"];

function RequestCard({
  request,
  classes,
  onAssign,
  isAssigning,
}: {
  request: PupilRequest;
  classes: { id: string; name: string }[];
  onAssign: (classId: string) => void;
  isAssigning: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: request.pupilId,
  });

  const style = transform
    ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` }
    : undefined;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={clsx(
        "rounded-sm border border-border bg-surface px-4 py-3",
        isDragging && "z-10 opacity-70"
      )}
    >
      <div
        {...listeners}
        {...attributes}
        className="focus-ring cursor-grab touch-none rounded-sm active:cursor-grabbing"
        aria-label={`Drag ${request.name} onto a class to enroll, or use the assign menu below`}
      >
        <p className="text-sm font-medium text-ink-900">{request.name}</p>
        <p className="text-xs text-ink-500">{request.email}</p>
        <div className="mt-2">
          <ClassTypeBadge type={request.requestedType} />
        </div>
      </div>
      {classes.length > 0 && (
        <label className="mt-3 block">
          <span className="sr-only">Assign {request.name} to a class</span>
          <select
            defaultValue=""
            disabled={isAssigning}
            onChange={(e) => {
              if (e.target.value) onAssign(e.target.value);
            }}
            className="focus-ring w-full rounded-sm border border-border-strong bg-surface px-2 py-1.5 text-xs text-ink-700"
          >
            <option value="" disabled>
              Assign to class…
            </option>
            {classes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
      )}
    </div>
  );
}

function ClassCard({
  id,
  name,
  type,
  pupilCount,
  monthlyFee,
}: {
  id: string;
  name: string;
  type: ClassType;
  pupilCount: number;
  monthlyFee: number | null;
}) {
  const { setNodeRef, isOver } = useDroppable({ id });

  return (
    <div ref={setNodeRef}>
      <Link to={`/teacher/classes/${id}`} className="focus-ring block rounded-lg">
        <Card
          className={clsx(
            "p-5 transition-colors hover:border-border-strong",
            isOver && "border-accent-600 bg-accent-50 ring-2 ring-accent-100"
          )}
        >
          <div className="flex items-center justify-between">
            <h3 className="font-medium text-ink-900">{name}</h3>
            <ClassTypeBadge type={type} />
          </div>
          <div className="mt-3 flex items-center justify-between">
            <p className="text-sm text-ink-500">{pupilCount} pupil{pupilCount === 1 ? "" : "s"}</p>
            {monthlyFee != null && <p className="text-sm font-medium text-ink-700">${monthlyFee}/mo</p>}
          </div>
        </Card>
      </Link>
    </div>
  );
}

function VisitRequestRow({
  request,
  onApprove,
  onDecline,
  isPending,
}: {
  request: TeacherVisitRequest;
  onApprove: () => void;
  onDecline: () => void;
  isPending: boolean;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-sm border border-border bg-surface px-4 py-3">
      <div>
        <p className="text-sm font-medium text-ink-900">
          {request.pupilName} <span className="font-normal text-ink-400">wants to visit</span> {request.className}
        </p>
        <p className="mt-0.5 text-xs text-ink-500">
          {request.pupilEmail} ·{" "}
          {new Date(request.sessionDate).toLocaleDateString(undefined, {
            weekday: "short",
            month: "short",
            day: "numeric",
          })}
        </p>
        {request.reason && <p className="mt-1 text-xs italic text-ink-400">"{request.reason}"</p>}
      </div>
      <div className="flex items-center gap-2">
        <Button size="sm" variant="secondary" onClick={onDecline} disabled={isPending}>
          Decline
        </Button>
        <Button size="sm" onClick={onApprove} disabled={isPending}>
          Approve
        </Button>
      </div>
    </div>
  );
}

function ParentRequestRow({
  request,
  onApprove,
  onDecline,
  isPending,
}: {
  request: TeacherParentRequest;
  onApprove: () => void;
  onDecline: () => void;
  isPending: boolean;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-sm border border-border bg-surface px-4 py-3">
      <div>
        <p className="text-sm font-medium text-ink-900">
          {request.parentName} <span className="font-normal text-ink-400">wants to link to</span> {request.pupilName}
        </p>
        <p className="mt-0.5 text-xs text-ink-500">
          {request.parentEmail} · {request.className ?? "Not yet assigned to a class"}
        </p>
      </div>
      <div className="flex items-center gap-2">
        <Button size="sm" variant="secondary" onClick={onDecline} disabled={isPending}>
          Decline
        </Button>
        <Button size="sm" onClick={onApprove} disabled={isPending}>
          Approve
        </Button>
      </div>
    </div>
  );
}

export function ClassesPage() {
  const queryClient = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);
  const [name, setName] = useState("");
  const [type, setType] = useState<ClassType>("MATH");
  const [monthlyFee, setMonthlyFee] = useState("");

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor)
  );

  const classesQuery = useQuery({ queryKey: ["teacher", "classes"], queryFn: fetchClasses });
  const requestsQuery = useQuery({ queryKey: ["teacher", "pupil-requests"], queryFn: fetchPupilRequests });
  const visitRequestsQuery = useQuery({
    queryKey: ["teacher", "visit-requests", "PENDING"],
    queryFn: () => fetchVisitRequests("PENDING"),
  });
  const parentRequestsQuery = useQuery({
    queryKey: ["teacher", "parent-requests"],
    queryFn: fetchAllParentRequests,
  });

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: ["teacher", "classes"] });
    queryClient.invalidateQueries({ queryKey: ["teacher", "pupil-requests"] });
    queryClient.invalidateQueries({ queryKey: ["teacher", "overview"] });
  };

  const invalidateVisitRequests = () => {
    queryClient.invalidateQueries({ queryKey: ["teacher", "visit-requests"] });
    queryClient.invalidateQueries({ queryKey: ["teacher", "classes"] });
  };

  const approveVisitMutation = useMutation({
    mutationFn: (id: string) => approveVisitRequest(id),
    onSuccess: () => {
      toast.success("Visit request approved.");
      invalidateVisitRequests();
    },
  });

  const declineVisitMutation = useMutation({
    mutationFn: (id: string) => declineVisitRequest(id),
    onSuccess: invalidateVisitRequests,
  });

  const invalidateParentRequests = () => {
    queryClient.invalidateQueries({ queryKey: ["teacher", "parent-requests"] });
    queryClient.invalidateQueries({ queryKey: ["teacher", "classes"] });
    queryClient.invalidateQueries({ queryKey: ["teacher", "notifications"] });
  };

  const approveParentMutation = useMutation({
    mutationFn: (id: string) => approveParentRequest(id),
    onSuccess: () => {
      toast.success("Parent link approved.");
      invalidateParentRequests();
    },
  });

  const declineParentMutation = useMutation({
    mutationFn: (id: string) => declineParentRequest(id),
    onSuccess: invalidateParentRequests,
  });

  const createMutation = useMutation({
    mutationFn: () => createClass(name, type, monthlyFee === "" ? null : Number(monthlyFee)),
    onSuccess: () => {
      toast.success("Class created.");
      setModalOpen(false);
      setName("");
      setMonthlyFee("");
      invalidateAll();
    },
  });

  const assignMutation = useMutation({
    mutationFn: ({ pupilId, classId }: { pupilId: string; classId: string }) => assignPupilRequest(pupilId, classId),
    onSuccess: () => {
      toast.success("Pupil enrolled.");
      invalidateAll();
    },
  });

  const rejectMutation = useMutation({
    mutationFn: (pupilId: string) => rejectPupilRequest(pupilId),
    onSuccess: invalidateAll,
  });

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over) return;
    assignMutation.mutate({ pupilId: String(active.id), classId: String(over.id) });
  }

  if (classesQuery.isLoading || requestsQuery.isLoading) return <Spinner />;

  const classes = classesQuery.data ?? [];
  const requests = requestsQuery.data ?? [];
  const visitRequests = visitRequestsQuery.data ?? [];
  const parentRequests = parentRequestsQuery.data ?? [];

  return (
    <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
      <div>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-ink-900">Class management</h1>
            <p className="mt-1 text-sm text-ink-500">
            Drag a pupil request onto a class to enroll them, or use the assign menu on each card.
          </p>
          </div>
          <Button onClick={() => setModalOpen(true)}>
            <Plus className="h-4 w-4" strokeWidth={1.8} aria-hidden="true" />
            New class
          </Button>
        </div>

        <section className="mt-6">
          <h2 className="text-sm font-medium text-ink-700">Pending requests</h2>
          {requests.length === 0 ? (
            <div className="mt-2">
              <EmptyState title="No pending pupil requests" description="New sign-ups will appear here." />
            </div>
          ) : (
            <div className="mt-2 flex flex-wrap gap-3">
              {requests.map((r) => (
                <div key={r.pupilId} className="group relative">
                  <RequestCard
                    request={r}
                    classes={classes.map((c) => ({ id: c.id, name: c.name }))}
                    isAssigning={assignMutation.isPending}
                    onAssign={(classId) => assignMutation.mutate({ pupilId: r.pupilId, classId })}
                  />
                  <button
                    onClick={() => rejectMutation.mutate(r.pupilId)}
                    className="focus-ring absolute -right-1.5 -top-1.5 hidden h-5 w-5 items-center justify-center rounded-full bg-danger-600 text-white hover:bg-danger-700 group-hover:flex"
                    title="Reject request"
                    aria-label={`Reject ${r.name}'s request`}
                  >
                    <X className="h-3 w-3" strokeWidth={1.8} aria-hidden="true" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="mt-8">
          <h2 className="text-sm font-medium text-ink-700">Session visit requests</h2>
          {visitRequestsQuery.isLoading ? (
            <Spinner />
          ) : visitRequests.length === 0 ? (
            <div className="mt-2">
              <EmptyState
                title="No pending visit requests"
                description="Pupils requesting to sit in on another class's session will appear here."
              />
            </div>
          ) : (
            <div className="mt-2 space-y-2">
              {visitRequests.map((r) => (
                <VisitRequestRow
                  key={r.id}
                  request={r}
                  isPending={approveVisitMutation.isPending || declineVisitMutation.isPending}
                  onApprove={() => approveVisitMutation.mutate(r.id)}
                  onDecline={() => declineVisitMutation.mutate(r.id)}
                />
              ))}
            </div>
          )}
        </section>

        <section className="mt-8">
          <h2 className="text-sm font-medium text-ink-700">Parent link requests</h2>
          {parentRequestsQuery.isLoading ? (
            <Spinner />
          ) : parentRequests.length === 0 ? (
            <div className="mt-2">
              <EmptyState
                title="No pending parent requests"
                description="Parents requesting to link to a pupil account will appear here."
              />
            </div>
          ) : (
            <div className="mt-2 space-y-2">
              {parentRequests.map((r) => (
                <ParentRequestRow
                  key={r.id}
                  request={r}
                  isPending={approveParentMutation.isPending || declineParentMutation.isPending}
                  onApprove={() => approveParentMutation.mutate(r.id)}
                  onDecline={() => declineParentMutation.mutate(r.id)}
                />
              ))}
            </div>
          )}
        </section>

        <section className="mt-8">
          <h2 className="text-sm font-medium text-ink-700">Classes</h2>
          {classes.length === 0 ? (
            <div className="mt-2">
              <EmptyState title="No classes yet" description="Create your first class to get started." />
            </div>
          ) : (
            <div className="mt-2 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {classes.map((c) => (
                <ClassCard
                  key={c.id}
                  id={c.id}
                  name={c.name}
                  type={c.type}
                  pupilCount={c._count?.pupils ?? c.pupils.length}
                  monthlyFee={c.monthlyFee}
                />
              ))}
            </div>
          )}
        </section>
      </div>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="New class">
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            createMutation.mutate();
          }}
        >
          <div>
            <label htmlFor="new-class-name" className="text-sm font-medium text-ink-700">Class name</label>
            <Input
              id="new-class-name"
              required
              aria-required="true"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Math A - Evenings"
            />
          </div>
          <div>
            <label htmlFor="new-class-type" className="text-sm font-medium text-ink-700">Type</label>
            <select
              id="new-class-type"
              value={type}
              onChange={(e) => setType(e.target.value as ClassType)}
              className="focus-ring mt-1 w-full rounded-sm border border-border-strong bg-surface px-3 py-3 text-sm text-ink-900"
            >
              {CLASS_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="new-class-monthly-fee" className="text-sm font-medium text-ink-700">Monthly fee (optional)</label>
            <Input
              id="new-class-monthly-fee"
              type="number"
              min={0}
              value={monthlyFee}
              onChange={(e) => setMonthlyFee(e.target.value)}
              placeholder="e.g. 150"
            />
            <p className="mt-1 text-xs text-ink-400">Used as the default amount due each month in the Ledger.</p>
          </div>
          <Button type="submit" className="w-full" disabled={createMutation.isPending}>
            {createMutation.isPending ? "Creating…" : "Create class"}
          </Button>
        </form>
      </Modal>
    </DndContext>
  );
}
