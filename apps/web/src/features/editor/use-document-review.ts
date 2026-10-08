import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useBlocker } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";

import { databaseKeys } from "@/features/database/database.queries";

import type { DocumentReview, WorkSnapshot } from "./document-model";
import { reviewNewWork, reviewWorks, saveWorkReview } from "./document.functions";

export function useDocumentReview(
  snapshots: WorkSnapshot[],
  json: string,
  dirty: boolean,
  create = false,
) {
  const client = useQueryClient();
  const navigate = useNavigate();
  const latest = useRef(json);
  const committed = useRef(false);
  useEffect(() => {
    latest.current = json;
  }, [json]);
  const [review, setReview] = useState<DocumentReview | null>(null);
  const [saved, setSaved] = useState(false);
  useBlocker({
    shouldBlockFn: ({ current, next }) =>
      current.pathname !== next.pathname &&
      dirty &&
      !committed.current &&
      !window.confirm("لديك تغييرات غير محفوظة. هل تريد مغادرة المحرر؟"),
    enableBeforeUnload: dirty && !saved,
  });
  const prepare = useMutation({
    mutationFn: (draft: string) =>
      create
        ? reviewNewWork({ data: { json: draft } })
        : reviewWorks({
            data: {
              json: draft,
              originals: snapshots.map(({ document, revision }) => ({
                id: document.id ?? "",
                revision,
              })),
            },
          }),
    onSuccess: (result, draft) => {
      if (draft === latest.current) setReview(result);
    },
  });
  const save = useMutation({
    mutationFn: (ticket: string) => saveWorkReview({ data: { ticket } }),
    onSuccess: async (result) => {
      committed.current = true;
      setSaved(true);
      setReview(null);
      await client.invalidateQueries({ queryKey: databaseKeys.all });
      if (result.createdId)
        await navigate({
          to: "/database/works/$workId",
          params: { workId: result.createdId },
          search: {},
        });
    },
  });
  function changed() {
    committed.current = false;
    setReview(null);
    setSaved(false);
    prepare.reset();
    save.reset();
  }
  return {
    review,
    prepare,
    save,
    saved,
    changed,
    back: () => setReview(null),
    busy: prepare.isPending || save.isPending,
  };
}
