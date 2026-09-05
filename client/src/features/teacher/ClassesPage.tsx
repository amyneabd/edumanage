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
  approveSwapRequest,
  assignPupilRequest,
  createClass,
  declineParentRequest,
  declineSwapRequest,
  endVacation,
  fetchAllParentRequests,
  fetchClasses,
  fetchCurrentVacation,
  fetchPupilRequests,
  fetchSwapRequests,
  rejectPupilRequest,
  startVacation as startVacationApi,
} from "../../api/teacher";
import { Button } from "../../components/Button";
import { Card } from "../../components/Card";
import { ClassTypeBadge, SwapStatusBadge } from "../../components/Badge";
import { EmptyState, Spinner } from "../../components/Feedback";
import { Input } from "../../components/Input";
import { Modal } from "../../components/Modal";
import type { ClassType, PupilRequest, TeacherParentRequest, TeacherSwapRequest } from "../../api/types";
import { formatDate } from "../../lib/period";
import { CLASS_TYPE_LABELS } from "../../lib/labels";

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
        aria-label={`Faites glisser ${request.name} sur une classe pour l'inscrire, ou utilisez le menu d'affectation ci-dessous`}
      >
        <p className="text-sm font-medium text-ink-900">{request.name}</p>
        <p className="text-xs text-ink-500">{request.email}</p>
        <div className="mt-2">
          <ClassTypeBadge type={request.requestedType} />
        </div>
      </div>
      {classes.length > 0 && (
        <label className="mt-3 block">
          <span className="sr-only">Affecter {request.name} à une classe</span>
          <select
            defaultValue=""
            disabled={isAssigning}
            onChange={(e) => {
              if (e.target.value) onAssign(e.target.value);
            }}
            className="focus-ring w-full rounded-sm border border-border-strong bg-surface px-2 py-1.5 text-xs text-ink-700"
          >
            <option value="" disabled>
              Affecter à une classe…
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
            <p className="text-sm text-ink-500">{pupilCount} élève{pupilCount === 1 ? "" : "s"}</p>
            {monthlyFee != null && <p className="text-sm font-medium text-ink-700">{monthlyFee} TND/mois</p>}
          </div>
        </Card>
      </Link>
    </div>
  );
}

function SwapRequestRow({
  request,
  onApprove,
  onDecline,
  isPending,
}: {
  request: TeacherSwapRequest;
  onApprove: () => void;
  onDecline: () => void;
  isPending: boolean;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-sm border border-border bg-surface px-4 py-3">
      <div>
        <p className="text-sm font-medium text-ink-900">
          {request.pupilName} <span className="font-normal text-ink-400">manque</span> {request.originClassName}{" "}
          <span className="font-normal text-ink-400">le</span>{" "}
          {formatDate(request.originDate, {
            weekday: "short",
            month: "short",
            day: "numeric",
          })}
        </p>
        <p className="mt-0.5 text-xs text-ink-500">
          pour rejoindre {request.targetClassName} le{" "}
          {formatDate(request.targetDate, {
            weekday: "short",
            month: "short",
            day: "numeric",
          })}
        </p>
        {request.reason && <p className="mt-1 text-xs italic text-ink-400">"{request.reason}"</p>}
      </div>
      <div className="flex items-center gap-2">
        <SwapStatusBadge status={request.status} />
        <Button size="sm" variant="secondary" onClick={onDecline} disabled={isPending}>
          Refuser
        </Button>
        <Button size="sm" onClick={onApprove} disabled={isPending}>
          Approuver
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
          {request.parentName} <span className="font-normal text-ink-400">veut se lier à</span> {request.pupilName}
        </p>
        <p className="mt-0.5 text-xs text-ink-500">
          {request.parentEmail} · {request.className ?? "Pas encore affecté à une classe"}
        </p>
      </div>
      <div className="flex items-center gap-2">
        <Button size="sm" variant="secondary" onClick={onDecline} disabled={isPending}>
          Refuser
        </Button>
        <Button size="sm" onClick={onApprove} disabled={isPending}>
          Approuver
        </Button>
      </div>
    </div>
  );
}

export function VacationBanner() {
  const queryClient = useQueryClient();
  const [pickerOpen, setPickerOpen] = useState(false);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const vacationQuery = useQuery({ queryKey: ["teacher", "vacation"], queryFn: fetchCurrentVacation });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["teacher", "vacation"] });
    queryClient.invalidateQueries({ queryKey: ["teacher", "overview"] });
  };

  const startMutation = useMutation({
    mutationFn: () => startVacationApi(startDate, endDate),
    onSuccess: () => {
      toast.success("Mode vacances activé.");
      setPickerOpen(false);
      setStartDate("");
      setEndDate("");
      invalidate();
    },
  });

  const endMutation = useMutation({
    mutationFn: () => endVacation(),
    onSuccess: () => {
      toast.success("Mode vacances désactivé. Les emplois du temps hebdomadaires ont repris.");
      invalidate();
    },
  });

  if (vacationQuery.isLoading) return null;
  const period = vacationQuery.data;

  return (
    <Card className="mb-6 p-5">
      {period ? (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-medium text-ink-700">Mode vacances actif</h2>
            <p className="mt-1 text-xs text-ink-500">
              {formatDate(`${period.startDate.slice(0, 10)}T00:00:00`, {
                month: "short",
                day: "numeric",
              })}{" "}
              –{" "}
              {formatDate(`${period.endDate.slice(0, 10)}T00:00:00`, {
                month: "short",
                day: "numeric",
              })}
            </p>
          </div>
          <Button size="sm" variant="secondary" onClick={() => endMutation.mutate()} disabled={endMutation.isPending}>
            {endMutation.isPending ? "Désactivation…" : "Désactiver le mode vacances"}
          </Button>
        </div>
      ) : pickerOpen ? (
        <form
          className="flex flex-wrap items-end gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            startMutation.mutate();
          }}
        >
          <div>
            <label htmlFor="vacation-start" className="text-xs font-medium text-ink-700">
              Date de début
            </label>
            <input
              id="vacation-start"
              type="date"
              required
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="focus-ring mt-1 rounded-sm border border-border-strong bg-surface px-2 py-1.5 text-xs text-ink-700"
            />
          </div>
          <div>
            <label htmlFor="vacation-end" className="text-xs font-medium text-ink-700">
              Date de fin
            </label>
            <input
              id="vacation-end"
              type="date"
              required
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="focus-ring mt-1 rounded-sm border border-border-strong bg-surface px-2 py-1.5 text-xs text-ink-700"
            />
          </div>
          <Button size="sm" type="submit" disabled={startMutation.isPending}>
            {startMutation.isPending ? "Activation…" : "Activer"}
          </Button>
          <Button size="sm" variant="secondary" type="button" onClick={() => setPickerOpen(false)}>
            Annuler
          </Button>
        </form>
      ) : (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-medium text-ink-700">Mode vacances</h2>
            <p className="mt-1 text-xs text-ink-500">
              Suspendez l'emploi du temps hebdomadaire pour une période donnée et choisissez des séances ponctuelles pour chaque classe à la place.
            </p>
          </div>
          <Button size="sm" variant="secondary" onClick={() => setPickerOpen(true)}>
            Activer le mode vacances
          </Button>
        </div>
      )}
    </Card>
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
  const swapRequestsQuery = useQuery({
    queryKey: ["teacher", "swap-requests", "PENDING"],
    queryFn: () => fetchSwapRequests("PENDING"),
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

  const invalidateSwapRequests = () => {
    queryClient.invalidateQueries({ queryKey: ["teacher", "swap-requests"] });
    queryClient.invalidateQueries({ queryKey: ["teacher", "classes"] });
  };

  const approveSwapMutation = useMutation({
    mutationFn: (id: string) => approveSwapRequest(id),
    onSuccess: () => {
      toast.success("Demande d'échange approuvée.");
      invalidateSwapRequests();
    },
  });

  const declineSwapMutation = useMutation({
    mutationFn: (id: string) => declineSwapRequest(id),
    onSuccess: invalidateSwapRequests,
  });

  const invalidateParentRequests = () => {
    queryClient.invalidateQueries({ queryKey: ["teacher", "parent-requests"] });
    queryClient.invalidateQueries({ queryKey: ["teacher", "classes"] });
    queryClient.invalidateQueries({ queryKey: ["teacher", "notifications"] });
  };

  const approveParentMutation = useMutation({
    mutationFn: (id: string) => approveParentRequest(id),
    onSuccess: () => {
      toast.success("Lien parent approuvé.");
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
      toast.success("Classe créée.");
      setModalOpen(false);
      setName("");
      setMonthlyFee("");
      invalidateAll();
    },
  });

  const assignMutation = useMutation({
    mutationFn: ({ pupilId, classId }: { pupilId: string; classId: string }) => assignPupilRequest(pupilId, classId),
    onSuccess: () => {
      toast.success("Élève inscrit.");
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
  const swapRequests = swapRequestsQuery.data ?? [];
  const parentRequests = parentRequestsQuery.data ?? [];

  return (
    <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
      <div>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-ink-900">Gestion des classes</h1>
            <p className="mt-1 text-sm text-ink-500">
            Faites glisser une demande d'élève sur une classe pour l'inscrire, ou utilisez le menu d'affectation sur chaque carte.
          </p>
          </div>
          <Button onClick={() => setModalOpen(true)}>
            <Plus className="h-4 w-4" strokeWidth={1.8} aria-hidden="true" />
            Nouvelle classe
          </Button>
        </div>

        <VacationBanner />

        <section className="mt-6">
          <h2 className="text-sm font-medium text-ink-700">Demandes en attente</h2>
          {requests.length === 0 ? (
            <div className="mt-2">
              <EmptyState title="Aucune demande d'élève en attente" description="Les nouvelles inscriptions apparaîtront ici." />
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
                    title="Rejeter la demande"
                    aria-label={`Rejeter la demande de ${r.name}`}
                  >
                    <X className="h-3 w-3" strokeWidth={1.8} aria-hidden="true" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="mt-8">
          <h2 className="text-sm font-medium text-ink-700">Demandes d'échange de séance</h2>
          {swapRequestsQuery.isLoading ? (
            <Spinner />
          ) : swapRequests.length === 0 ? (
            <div className="mt-2">
              <EmptyState
                title="Aucune demande d'échange en attente"
                description="Les élèves demandant à échanger vers la séance d'une autre classe apparaîtront ici."
              />
            </div>
          ) : (
            <div className="mt-2 space-y-2">
              {swapRequests.map((r) => (
                <SwapRequestRow
                  key={r.id}
                  request={r}
                  isPending={approveSwapMutation.isPending || declineSwapMutation.isPending}
                  onApprove={() => approveSwapMutation.mutate(r.id)}
                  onDecline={() => declineSwapMutation.mutate(r.id)}
                />
              ))}
            </div>
          )}
        </section>

        <section className="mt-8">
          <h2 className="text-sm font-medium text-ink-700">Demandes de lien parent</h2>
          {parentRequestsQuery.isLoading ? (
            <Spinner />
          ) : parentRequests.length === 0 ? (
            <div className="mt-2">
              <EmptyState
                title="Aucune demande de parent en attente"
                description="Les parents demandant à se lier à un compte élève apparaîtront ici."
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
              <EmptyState title="Aucune classe pour le moment" description="Créez votre première classe pour commencer." />
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

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Nouvelle classe">
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            createMutation.mutate();
          }}
        >
          <div>
            <label htmlFor="new-class-name" className="text-sm font-medium text-ink-700">Nom de la classe</label>
            <Input
              id="new-class-name"
              required
              aria-required="true"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="ex. Maths A - Soirs"
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
                  {CLASS_TYPE_LABELS[t]}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="new-class-monthly-fee" className="text-sm font-medium text-ink-700">Frais mensuels (facultatif)</label>
            <Input
              id="new-class-monthly-fee"
              type="number"
              min={0}
              value={monthlyFee}
              onChange={(e) => setMonthlyFee(e.target.value)}
              placeholder="ex. 150"
            />
            <p className="mt-1 text-xs text-ink-400">Utilisé comme montant dû par défaut chaque mois dans le Registre.</p>
          </div>
          <Button type="submit" className="w-full" disabled={createMutation.isPending}>
            {createMutation.isPending ? "Création…" : "Créer la classe"}
          </Button>
        </form>
      </Modal>
    </DndContext>
  );
}
