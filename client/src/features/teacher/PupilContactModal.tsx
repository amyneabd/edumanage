import { Modal } from "../../components/Modal";
import { ClassTypeBadge } from "../../components/Badge";
import type { PupilDetail } from "../../api/types";

export function PupilContactModal({ pupil, onClose }: { pupil: PupilDetail | null; onClose: () => void }) {
  return (
    <Modal open={!!pupil} onClose={onClose} title="Contact info" maxWidthClassName="max-w-sm">
      {pupil && (
        <dl className="space-y-4 text-sm">
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-ink-400">Full name</dt>
            <dd className="mt-0.5 text-ink-900">{pupil.name}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-ink-400">Class</dt>
            <dd className="mt-0.5 flex items-center gap-2 text-ink-900">
              {pupil.classType && <ClassTypeBadge type={pupil.classType} />}
              <span>{pupil.className ?? "Not assigned yet"}</span>
            </dd>
          </div>
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-ink-400">Email</dt>
            <dd className="mt-0.5 text-ink-900">{pupil.email}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-ink-400">Phone</dt>
            <dd className="mt-0.5 text-ink-900">{pupil.phone || "—"}</dd>
          </div>
          <div className="border-t border-border pt-4">
            <dt className="text-xs font-medium uppercase tracking-wide text-ink-400">Parent</dt>
            {pupil.parentName ? (
              <dd className="mt-0.5 text-ink-900">{pupil.parentName}</dd>
            ) : (
              <dd className="mt-0.5 text-ink-400">No linked parent account</dd>
            )}
            <dd className="mt-0.5 text-ink-900">{pupil.parentPhone || "—"}</dd>
          </div>
        </dl>
      )}
    </Modal>
  );
}
