import type { FamilyRecommendation } from "@arcadia/contracts";
import { CalendarDotsIcon, CheckIcon, UsersThreeIcon } from "@phosphor-icons/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress, ProgressTrack } from "@/components/ui/progress";
import { AccountAvatar } from "@/features/accounts/account-avatar";
import {
  archiveKeys,
  getFamilyEvents,
  getRecommendations,
  respondRecommendation,
  voteForEventTitle,
} from "./api";
import { FamilyActivityFeed } from "./components/family-activity-feed";
import { Blank, dateTimeFormat, ListSkeleton, PanelTitle } from "./components/shared";

/** The recommendation statuses reach the client as the raw enum; this panel used to render them
 *  straight into an Arabic interface as "accepted"/"deferred"/"dismissed". */
const recommendationStatusLabel = {
  pending: "بانتظار ردّك",
  accepted: "ستشاهده",
  deferred: "أجّلته",
  dismissed: "تجاهلته",
} satisfies Record<FamilyRecommendation["status"], string>;

export function FamilyPanel() {
  const client = useQueryClient();
  const recommendations = useQuery({
    queryKey: archiveKeys.recommendations,
    queryFn: getRecommendations,
  });
  const events = useQuery({ queryKey: archiveKeys.events, queryFn: getFamilyEvents });
  const respond = useMutation({
    mutationFn: ({ id, status }: { id: string; status: "accepted" | "deferred" | "dismissed" }) =>
      respondRecommendation(id, status),
    onSuccess: () => client.invalidateQueries({ queryKey: archiveKeys.recommendations }),
  });
  const vote = useMutation({
    mutationFn: ({ eventId, titleId }: { eventId: string; titleId: string }) =>
      voteForEventTitle(eventId, titleId),
    onSuccess: () => client.invalidateQueries({ queryKey: archiveKeys.events }),
  });

  /* Pending first: the only rows in this list that need a decision should never sit below rows
   * that are already resolved. */
  const sortedRecommendations = (recommendations.data ?? []).toSorted((a, b) =>
    a.status === b.status ? 0 : a.status === "pending" ? -1 : b.status === "pending" ? 1 : 0,
  );

  return (
    <div className="grid gap-10 xl:grid-cols-2">
      <section>
        <PanelTitle title="نشاط العائلة" description="ما اختار أفراد العائلة إظهاره داخل البيت." />
        <FamilyActivityFeed variant="panel" limit={20} />
      </section>

      <div className="flex flex-col gap-10">
        <section>
          <PanelTitle
            title="التوصيات المباشرة"
            description="اقتراحات من شخص إلى شخص، مع قرار واضح."
          />
          {recommendations.isLoading ? (
            <ListSkeleton leading="avatar" />
          ) : sortedRecommendations.length ? (
            <div className="flex flex-col gap-3">
              {sortedRecommendations.map((item) => (
                <Card key={item.id}>
                  <CardContent className="flex flex-col gap-4">
                    <div className="flex gap-3">
                      <AccountAvatar
                        avatarKey={item.sender.avatarKey}
                        label={item.sender.displayName}
                        className="size-10 shrink-0"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm">
                          <strong className="font-medium">{item.sender.displayName}</strong> رشّح لك{" "}
                          <Link
                            to="/titles/$titleId"
                            params={{ titleId: item.title.id }}
                            className="font-medium text-primary hover:underline"
                          >
                            {item.title.title}
                          </Link>
                        </p>
                        <p className="mt-1 text-sm leading-6 text-muted-foreground">
                          {item.reason}
                        </p>
                      </div>
                    </div>
                    {item.status === "pending" ? (
                      <div className="flex flex-wrap gap-2">
                        <Button
                          size="sm"
                          disabled={respond.isPending}
                          onClick={() => respond.mutate({ id: item.id, status: "accepted" })}
                        >
                          سأشاهده
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={respond.isPending}
                          onClick={() => respond.mutate({ id: item.id, status: "deferred" })}
                        >
                          لاحقاً
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="ms-auto text-muted-foreground"
                          disabled={respond.isPending}
                          onClick={() => respond.mutate({ id: item.id, status: "dismissed" })}
                        >
                          تجاهل
                        </Button>
                      </div>
                    ) : (
                      <Badge variant="secondary" className="w-fit">
                        <CheckIcon data-icon="inline-start" />
                        {recommendationStatusLabel[item.status]}
                      </Badge>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <Blank icon={<UsersThreeIcon />} title="لا توصيات بعد">
              أرسل توصية من صفحة أي عمل، وستظهر ردود العائلة هنا.
            </Blank>
          )}
        </section>

        <section>
          <PanelTitle title="ليلة العائلة" description="مواعيد ومقترحات يجري حسمها بالتصويت." />
          {events.isLoading ? (
            <ListSkeleton leading="avatar" rows={2} />
          ) : events.data?.length ? (
            <div className="flex flex-col gap-3">
              {events.data.map((event) => {
                const totalVotes = event.candidates.reduce(
                  (sum, candidate) => sum + candidate.votes,
                  0,
                );
                return (
                  <Card key={event.id}>
                    <CardHeader>
                      <CardTitle>{event.name}</CardTitle>
                      <CardDescription>
                        {event.scheduledFor
                          ? dateTimeFormat.format(new Date(event.scheduledFor))
                          : "الموعد قيد التخطيط"}
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="flex flex-col gap-2">
                      {event.candidates.map((candidate) => (
                        <button
                          type="button"
                          key={candidate.title.id}
                          aria-pressed={candidate.votedByMe}
                          disabled={vote.isPending}
                          onClick={() =>
                            vote.mutate({ eventId: event.id, titleId: candidate.title.id })
                          }
                          className="group/vote relative flex w-full items-center justify-between gap-3 overflow-hidden rounded-xl border p-3 text-start transition-colors hover:bg-muted/40 aria-pressed:border-primary/40"
                        >
                          {/* The tally as a bar behind the row, so the leading candidate is
                           *  readable without comparing numbers one by one. */}
                          <Progress
                            value={totalVotes ? (candidate.votes / totalVotes) * 100 : 0}
                            aria-hidden
                            className="pointer-events-none absolute inset-0 block"
                          >
                            <ProgressTrack className="h-full rounded-none bg-transparent" />
                          </Progress>
                          <span className="relative truncate text-sm">{candidate.title.title}</span>
                          <Badge
                            variant={candidate.votedByMe ? "default" : "outline"}
                            className="relative shrink-0 font-mono tabular-nums"
                          >
                            {candidate.votes}
                          </Badge>
                        </button>
                      ))}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          ) : (
            <Blank icon={<CalendarDotsIcon />} title="لا توجد ليلة مخططة">
              أنشئ موعداً مع قائمة مقترحات، وصوّت العائلة على ما تشاهدونه معاً.
            </Blank>
          )}
        </section>
      </div>
    </div>
  );
}
