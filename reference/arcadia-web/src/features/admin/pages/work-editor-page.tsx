import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { WorkEditorPage } from "@/features/admin/components/editor-form";
import { getAdminEntities, getAdminWorkDetail, getAdminWorks } from "@/server/library.functions";

export function AdminWorkEditorPage({ workId }: { workId: string }) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  // The bulk `works` list is only for cross-title context here (tag suggestions, relation/award
  // pickers) — it's `TitleSummary`-shaped and never carries the title's own external ids. The
  // work actually being edited is fetched separately, full-detail, so `tmdbId`/`imdbId`/etc. are
  // real instead of always null (see `getAdminWorkDetail`).
  const { data: works } = useSuspenseQuery({
    queryKey: ["admin-works"],
    queryFn: () => getAdminWorks(),
  });
  const { data: work } = useSuspenseQuery({
    queryKey: ["admin-work-detail", workId],
    queryFn: () => getAdminWorkDetail({ data: { workId } }),
  });
  const { data: entities } = useSuspenseQuery({
    queryKey: ["admin-entities"],
    queryFn: () => getAdminEntities(),
  });
  if (!work) return <p>تعذر العثور على العمل.</p>;
  return (
    <div className="mx-auto w-full max-w-7xl">
      <WorkEditorPage
        work={work}
        works={works}
        entities={entities}
        onSaved={async () => {
          await queryClient.invalidateQueries({ queryKey: ["admin-works"] });
          await queryClient.invalidateQueries({ queryKey: ["admin-work-detail", workId] });
          await navigate({ to: "/admin/catalog/$workId", params: { workId } });
        }}
      />
    </div>
  );
}
