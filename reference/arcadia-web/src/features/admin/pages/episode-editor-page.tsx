import {
  ArrowDownIcon,
  ArrowUpIcon,
  CloudArrowDownIcon,
  FloppyDiskIcon,
  PlusIcon,
  TrashIcon,
} from "@phosphor-icons/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { getTitle } from "@/lib/api";
import { cn } from "@/lib/utils";
import { AdminPageHeader } from "../components/admin-page-header";
import {
  type EpisodeDraft,
  episodeKeys,
  newDraft,
  saveSeasonEpisodes,
  seasonEpisodesQueryOptions,
  toDraft,
  toInput,
} from "../episodes/api";
import { TmdbImportDialog } from "../episodes/tmdb-dialog";

/**
 * `/admin/catalog/$workId/episodes` — every field the `episodes` table has (number, title,
 * summary, air date, runtime, still), edited in place per season. Saves go through
 * `PUT /admin/installments/:id/episodes`, which never rebuilds ids, so watched flags and resume
 * positions survive. "جلب من TMDB" fills the same rows from `/tv/{id}/season/{n}`.
 */
export function EpisodeEditorPage({
  workId,
  installmentId: requestedInstallmentId,
}: {
  workId: string;
  installmentId: string | null;
}) {
  const title = useQuery({
    queryKey: ["admin-title-detail", workId],
    queryFn: () => getTitle(workId),
  });
  const seasons = useMemo(
    () =>
      (title.data?.installments ?? [])
        .filter((installment) => installment.kind === "season")
        .toSorted((a, b) => a.position - b.position),
    [title.data],
  );
  const installmentId = requestedInstallmentId ?? seasons[0]?.id ?? null;
  const selected = seasons.find((season) => season.id === installmentId) ?? null;

  return (
    <div className="flex min-w-0 flex-col gap-8">
      <AdminPageHeader
        title="تحرير الحلقات"
        description={
          title.data
            ? `${title.data.titleAr || title.data.canonicalTitle} — كل حقول الحلقة كما في قاعدة البيانات: الرقم، العنوان، الملخص، تاريخ العرض، المدة، والصورة.`
            : "…"
        }
        actions={
          <Button
            variant="outline"
            size="sm"
            nativeButton={false}
            render={<Link to="/admin/catalog/$workId" params={{ workId }} />}
          >
            العودة إلى نموذج العمل
          </Button>
        }
      />
      {seasons.length > 0 && (
        <div className="px-5 sm:px-6">
          <ToggleGroup
            value={[installmentId ?? ""]}
            multiple={false}
            variant="outline"
            size="sm"
            spacing={0}
            aria-label="الموسم"
            onValueChange={() => {}}
          >
            {seasons.map((season, index) => (
              <ToggleGroupItem
                key={season.id}
                value={season.id}
                nativeButton={false}
                render={
                  <Link
                    to="/admin/catalog/$workId/episodes"
                    params={{ workId }}
                    search={{ installment: season.id }}
                  />
                }
              >
                {season.title || `الموسم ${index + 1}`}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </div>
      )}
      {title.data && seasons.length === 0 && (
        <p className="px-5 text-sm text-muted-foreground sm:px-6">
          هذا العمل لا يحتوي مواسم؛ أضف موسماً من «تعديل البنية» أولاً.
        </p>
      )}
      {selected && installmentId && (
        <SeasonEditor
          key={installmentId}
          installmentId={installmentId}
          seasonTitle={selected.title || "الموسم"}
        />
      )}
    </div>
  );
}

function SeasonEditor({
  installmentId,
  seasonTitle,
}: {
  installmentId: string;
  seasonTitle: string;
}) {
  const queryClient = useQueryClient();
  const season = useQuery(seasonEpisodesQueryOptions(installmentId));
  // Until the first edit the rows *are* the server's; an edit snapshots them into local state,
  // which wins until saved ("dirty") or discarded — no effect needed to keep the two in step.
  const [edits, setEdits] = useState<{ drafts: EpisodeDraft[]; removeIds: string[] } | null>(null);
  const [tmdbOpen, setTmdbOpen] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const baseline = useMemo(() => (season.data?.episodes ?? []).map(toDraft), [season.data]);
  const drafts = edits?.drafts ?? baseline;
  const removeIds = edits?.removeIds ?? [];
  const dirty = edits !== null;

  const edit = (
    change: (current: { drafts: EpisodeDraft[]; removeIds: string[] }) => {
      drafts: EpisodeDraft[];
      removeIds: string[];
    },
  ) => setEdits((current) => change(current ?? { drafts: baseline, removeIds: [] }));

  const update = (localKey: string, patch: Partial<EpisodeDraft>) =>
    edit((current) => ({
      ...current,
      drafts: current.drafts.map((draft) =>
        draft.localKey === localKey ? { ...draft, ...patch } : draft,
      ),
    }));
  const move = (index: number, direction: -1 | 1) =>
    edit((current) => {
      const next = [...current.drafts];
      const target = index + direction;
      const a = next[index];
      const b = next[target];
      if (!a || !b) return current;
      next[index] = { ...b, position: a.position };
      next[target] = { ...a, position: b.position };
      return { ...current, drafts: next };
    });
  const remove = (draft: EpisodeDraft) =>
    edit((current) => ({
      drafts: current.drafts.filter((entry) => entry.localKey !== draft.localKey),
      removeIds: draft.id ? [...current.removeIds, draft.id] : current.removeIds,
    }));

  const save = useMutation({
    mutationFn: () =>
      saveSeasonEpisodes(
        installmentId,
        drafts.map(toInput),
        removeIds.filter((id) => id.length > 0),
      ),
    onSuccess: (result) => {
      queryClient.setQueryData(episodeKeys.season(installmentId), result);
      setEdits(null);
      setMessage(`حُفظت ${result.episodes.length} حلقة.`);
    },
    onError: (error) => setMessage(error instanceof Error ? error.message : "تعذّر الحفظ."),
  });

  const duplicateNumbers = new Set(
    drafts
      .map((draft) => draft.number)
      .filter((number, index, all) => all.indexOf(number) !== index),
  );

  return (
    <Card className="mx-5 mb-6 min-w-0 sm:mx-6">
      <CardHeader className="gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <CardTitle>{seasonTitle}</CardTitle>
            <CardDescription>
              {drafts.length} حلقة
              {season.data ? ` · الموسم رقم ${season.data.seasonNumber} على TMDB` : ""}
              {season.data?.tmdbId === null ? " · لا معرّف TMDB للعنوان" : ""}
            </CardDescription>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setTmdbOpen(true)}
              disabled={!season.data}
            >
              <CloudArrowDownIcon data-icon="inline-start" /> جلب من TMDB
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                edit((current) => ({
                  ...current,
                  drafts: [...current.drafts, newDraft(current.drafts)],
                }))
              }
            >
              <PlusIcon data-icon="inline-start" /> إضافة حلقة
            </Button>
            <Button
              size="sm"
              disabled={!dirty || save.isPending || duplicateNumbers.size > 0}
              onClick={() => save.mutate()}
            >
              <FloppyDiskIcon data-icon="inline-start" /> {save.isPending ? "جارٍ الحفظ…" : "حفظ"}
            </Button>
            {dirty && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setEdits(null);
                  setMessage(null);
                }}
              >
                تراجع
              </Button>
            )}
          </div>
        </div>
        {duplicateNumbers.size > 0 && (
          <p className="text-xs text-destructive">
            رقم الحلقة مكرّر: {[...duplicateNumbers].join("، ")}.
          </p>
        )}
        {message && <p className="text-xs text-muted-foreground">{message}</p>}
      </CardHeader>
      <CardContent className="min-w-0">
        {drafts.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            لا حلقات بعد — أضف واحدة أو اجلبها من TMDB.
          </p>
        ) : (
          <ol className="flex flex-col gap-3">
            {drafts.map((draft, index) => (
              <li
                key={draft.localKey}
                className={cn(
                  "grid gap-3 rounded-xl border border-border p-3 md:grid-cols-[auto_5rem_1fr_auto]",
                  draft.id === null && "border-primary/40 bg-primary/5",
                )}
              >
                <div className="flex flex-row gap-1 md:flex-col">
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    aria-label="أعلى"
                    disabled={index === 0}
                    onClick={() => move(index, -1)}
                  >
                    <ArrowUpIcon />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    aria-label="أسفل"
                    disabled={index === drafts.length - 1}
                    onClick={() => move(index, 1)}
                  >
                    <ArrowDownIcon />
                  </Button>
                </div>
                <div className="flex flex-col gap-1 text-xs text-muted-foreground">
                  <label htmlFor={`ep-${draft.localKey}-number`}>الرقم</label>
                  <Input
                    id={`ep-${draft.localKey}-number`}
                    dir="ltr"
                    inputMode="decimal"
                    value={String(draft.number)}
                    aria-invalid={duplicateNumbers.has(draft.number) || undefined}
                    onChange={(event) => {
                      const value = Number.parseFloat(event.target.value);
                      if (Number.isFinite(value) && value >= 0)
                        update(draft.localKey, { number: value });
                    }}
                    className="h-8 font-mono"
                  />
                </div>
                <div className="grid min-w-0 gap-2 md:grid-cols-[1fr_9rem_5rem]">
                  <div className="flex flex-col gap-1 text-xs text-muted-foreground md:col-span-1">
                    <label htmlFor={`ep-${draft.localKey}-title`}>العنوان</label>
                    <Input
                      id={`ep-${draft.localKey}-title`}
                      value={draft.title ?? ""}
                      onChange={(event) => update(draft.localKey, { title: event.target.value })}
                      className="h-8"
                    />
                  </div>
                  <div className="flex flex-col gap-1 text-xs text-muted-foreground">
                    <label htmlFor={`ep-${draft.localKey}-date`}>تاريخ العرض</label>
                    <Input
                      id={`ep-${draft.localKey}-date`}
                      dir="ltr"
                      type="date"
                      value={draft.releaseDate ?? ""}
                      onChange={(event) =>
                        update(draft.localKey, { releaseDate: event.target.value || null })
                      }
                      className="h-8 font-mono"
                    />
                  </div>
                  <div className="flex flex-col gap-1 text-xs text-muted-foreground">
                    <label htmlFor={`ep-${draft.localKey}-runtime`}>المدة (د)</label>
                    <Input
                      id={`ep-${draft.localKey}-runtime`}
                      dir="ltr"
                      inputMode="numeric"
                      value={draft.runtimeMinutes ?? ""}
                      onChange={(event) => {
                        const value = Number.parseInt(event.target.value, 10);
                        update(draft.localKey, {
                          runtimeMinutes: Number.isInteger(value) && value >= 0 ? value : null,
                        });
                      }}
                      className="h-8 font-mono"
                    />
                  </div>
                  <div className="flex flex-col gap-1 text-xs text-muted-foreground md:col-span-3">
                    <label htmlFor={`ep-${draft.localKey}-summary`}>الملخص</label>
                    <Textarea
                      id={`ep-${draft.localKey}-summary`}
                      value={draft.summary}
                      rows={2}
                      onChange={(event) => update(draft.localKey, { summary: event.target.value })}
                      className="min-h-0 text-sm"
                    />
                  </div>
                  <div className="flex flex-col gap-1 text-xs text-muted-foreground md:col-span-3">
                    <label htmlFor={`ep-${draft.localKey}-poster`}>
                      الصورة — مسار /media/… أو رابط https:// (يُنزَّل عند الحفظ)
                    </label>
                    <span className="flex items-center gap-2">
                      {draft.posterPath && (
                        <img
                          src={draft.posterPath}
                          alt=""
                          width={64}
                          height={36}
                          loading="lazy"
                          decoding="async"
                          className="h-9 w-16 shrink-0 rounded object-cover"
                        />
                      )}
                      <Input
                        id={`ep-${draft.localKey}-poster`}
                        dir="ltr"
                        value={draft.posterPath ?? ""}
                        placeholder="—"
                        onChange={(event) =>
                          update(draft.localKey, {
                            posterPath: event.target.value || null,
                            posterChanged: true,
                          })
                        }
                        className="h-8 font-mono text-xs"
                      />
                    </span>
                  </div>
                </div>
                <div className="flex items-start">
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label="حذف الحلقة"
                    onClick={() => remove(draft)}
                  >
                    <TrashIcon className="text-destructive" />
                  </Button>
                </div>
              </li>
            ))}
          </ol>
        )}
      </CardContent>
      {season.data && (
        <TmdbImportDialog
          installmentId={installmentId}
          defaultSeason={season.data.seasonNumber}
          tmdbId={season.data.tmdbId}
          open={tmdbOpen}
          onOpenChange={(open) => {
            setTmdbOpen(open);
            // The import wrote to the server; local edits would now be stale.
            if (!open) setEdits(null);
          }}
        />
      )}
    </Card>
  );
}
