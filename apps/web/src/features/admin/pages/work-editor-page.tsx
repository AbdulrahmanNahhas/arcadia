import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { WorkEditorPage } from "@/features/admin/components/editor-form";
import { getAdminEntities, getAdminWorks } from "@/server/library.functions";

export function AdminWorkEditorPage({ workId }: { workId: string }) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { data: works } = useSuspenseQuery({
    queryKey: ["admin-works"],
    queryFn: () => getAdminWorks(),
  });
  const { data: entities } = useSuspenseQuery({
    queryKey: ["admin-entities"],
    queryFn: () => getAdminEntities(),
  });
  const work = works.find((item) => item.id === workId);
  if (!work) return <p>تعذر العثور على العمل.</p>;
  return (
    <div className="mx-auto w-full max-w-7xl">
      <WorkEditorPage
        work={work}
        works={works}
        entities={entities}
        onSaved={async () => {
          await queryClient.invalidateQueries({ queryKey: ["admin-works"] });
          await navigate({ to: "/admin/catalog/$workId", params: { workId } });
        }}
      />
    </div>
  );
}
