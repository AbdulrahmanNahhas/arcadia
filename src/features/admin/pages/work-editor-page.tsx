import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { WorkEditorPage } from "@/features/admin/components/editor-form";
import { getEntities, getWorks } from "@/server/library.functions";

export function AdminWorkEditorPage({ workId }: { workId: string }) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { data: works } = useSuspenseQuery({ queryKey: ["works"], queryFn: () => getWorks() });
  const { data: entities } = useSuspenseQuery({
    queryKey: ["entities"],
    queryFn: () => getEntities(),
  });
  const work = works.find((item) => item.id === workId);
  if (!work) return <p>تعذر العثور على العمل.</p>;
  return (
    <WorkEditorPage
      work={work}
      works={works}
      entities={entities}
      onSaved={async () => {
        await queryClient.invalidateQueries({ queryKey: ["works"] });
        await navigate({ to: "/admin/catalog" });
      }}
    />
  );
}
