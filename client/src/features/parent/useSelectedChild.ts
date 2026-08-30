import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchChildren } from "../../api/parent";

const STORAGE_KEY = "edumanage:selectedChildId";

/**
 * Tracks which linked child is currently selected across the parent panel.
 * Persisted to localStorage so it survives navigation between pages, and
 * automatically falls back to the first linked child if none is selected
 * (or the stored id is no longer valid, e.g. after a link is removed).
 */
export function useSelectedChild() {
  const childrenQuery = useQuery({ queryKey: ["parent", "children"], queryFn: fetchChildren });
  const children = childrenQuery.data ?? [];

  const [pupilId, setPupilIdState] = useState<string | null>(() => localStorage.getItem(STORAGE_KEY));

  useEffect(() => {
    if (children.length === 0) return;
    const stillValid = children.some((c) => c.pupilId === pupilId);
    if (!stillValid) {
      const first = children[0]!.pupilId;
      setPupilIdState(first);
      localStorage.setItem(STORAGE_KEY, first);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [children.map((c) => c.pupilId).join(","), pupilId]);

  function setPupilId(id: string) {
    setPupilIdState(id);
    localStorage.setItem(STORAGE_KEY, id);
  }

  const selectedChild = children.find((c) => c.pupilId === pupilId) ?? null;

  return {
    children,
    isLoading: childrenQuery.isLoading,
    pupilId: selectedChild?.pupilId ?? null,
    selectedChild,
    setPupilId,
  };
}
