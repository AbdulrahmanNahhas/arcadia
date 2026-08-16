import type { TitleComment, TitleReview } from "@arcadia/contracts";
import { ar } from "@arcadia/i18n";
import { ChatCircleDotsIcon, HeartIcon, SparkleIcon, StarIcon } from "@phosphor-icons/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { AccountAvatar } from "@/features/accounts/account-avatar";
import { useCurrentAccount } from "@/features/accounts/api";
import {
  getTitleSocial,
  saveComment,
  saveReview,
  socialKeys,
  toggleReaction,
  updateTitleState,
} from "./api";

const statuses = [
  ["planned", "أخطط له"],
  ["watching", "أشاهده الآن"],
  ["completed", "أكملته"],
  ["paused", "متوقف مؤقتاً"],
  ["dropped", "تركته"],
] as const;
const reactions = [
  ["heart", "♥", "أحببته"],
  ["clap", "👏", "أحسنت"],
  ["laugh", "😄", "أضحكني"],
  ["wow", "✨", "مذهل"],
  ["think", "🤔", "يدعو للتفكير"],
] as const;

export function TitleSocialSection({
  titleId,
  mode = "all",
}: {
  titleId: string;
  mode?: "all" | "quick" | "reviews" | "discussion";
}) {
  const queryClient = useQueryClient();
  const current = useCurrentAccount();
  const social = useQuery({
    queryKey: socialKeys.title(titleId),
    queryFn: () => getTitleSocial(titleId),
  });
  const invalidate = () => queryClient.invalidateQueries({ queryKey: socialKeys.title(titleId) });
  const stateMutation = useMutation({
    mutationFn: (input: Parameters<typeof updateTitleState>[1]) => updateTitleState(titleId, input),
    onSuccess: invalidate,
  });
  const ownReview = social.data?.reviews.find(
    (review) => review.author.id === current.data?.account.id,
  );
  const [reviewRating, setReviewRating] = useState(0);
  const [reviewBody, setReviewBody] = useState("");
  const [reviewSpoiler, setReviewSpoiler] = useState(false);
  const [commentBody, setCommentBody] = useState("");
  const [commentSpoiler, setCommentSpoiler] = useState(false);
  const [replyTo, setReplyTo] = useState<TitleComment | null>(null);
  useEffect(() => {
    if (!ownReview) return;
    setReviewRating(ownReview.rating);
    setReviewBody(ownReview.body);
    setReviewSpoiler(ownReview.containsSpoilers);
  }, [ownReview]);
  const reviewMutation = useMutation({
    mutationFn: () =>
      saveReview(titleId, {
        rating: reviewRating,
        body: reviewBody,
        containsSpoilers: reviewSpoiler,
      }),
    onSuccess: invalidate,
  });
  const commentMutation = useMutation({
    mutationFn: () =>
      saveComment(titleId, {
        parentId: replyTo?.id ?? null,
        body: commentBody,
        containsSpoilers: commentSpoiler,
      }),
    onSuccess: async () => {
      setCommentBody("");
      setCommentSpoiler(false);
      setReplyTo(null);
      await invalidate();
    },
  });

  if (social.isLoading) return <p className="py-12 text-muted-foreground">جارٍ جمع حديث العائلة…</p>;
  if (!social.data) return <p className="py-12 text-muted-foreground">تعذّر تحميل مساحة العائلة.</p>;
  const state = social.data.state;

  return (
    <div className="space-y-8">
      {(mode === "all" || mode === "quick") && (
        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>مكتبتي الشخصية</CardTitle>
              <CardDescription>هذه الخيارات لك وحدك ولا تغيّر التقييم التحريري.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Field>
                <FieldLabel>حالة المشاهدة</FieldLabel>
                <Select
                  value={state?.status ?? null}
                  onValueChange={(status) =>
                    stateMutation.mutate({ status: status as NonNullable<typeof state>["status"] })
                  }
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="اختر الحالة" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      {statuses.map(([value, label]) => (
                        <SelectItem key={value} value={value}>
                          {label}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </Field>
              <Button
                variant={state?.isFavorite ? "default" : "outline"}
                onClick={() => stateMutation.mutate({ isFavorite: !state?.isFavorite })}
              >
                <HeartIcon
                  data-icon="inline-start"
                  weight={state?.isFavorite ? "fill" : "regular"}
                />
                {state?.isFavorite ? "في المفضلة" : "أضف إلى المفضلة"}
              </Button>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>تقييمي الشخصي</CardTitle>
              <CardDescription>من نجمة إلى خمس، منفصل تماماً عن معايير أركاديا.</CardDescription>
            </CardHeader>
            <CardContent>
              <StarPicker
                value={state?.personalRating ?? 0}
                onChange={(personalRating) => stateMutation.mutate({ personalRating })}
              />
            </CardContent>
          </Card>
        </div>
      )}

      {(mode === "all" || mode === "reviews") && (
        <>
          <Card>
            <CardHeader>
              <CardTitle>{ownReview ? "عدّل مراجعتك" : "اكتب مراجعتك"}</CardTitle>
              <CardDescription>مراجعة واحدة قصيرة لكل حساب، تنشر فوراً للعائلة.</CardDescription>
            </CardHeader>
            <CardContent>
              <FieldGroup>
                <Field>
                  <FieldLabel>التقييم</FieldLabel>
                  <StarPicker value={reviewRating} onChange={setReviewRating} />
                </Field>
                <Field>
                  <FieldLabel htmlFor="family-review">انطباعك</FieldLabel>
                  <Textarea
                    id="family-review"
                    rows={4}
                    maxLength={1200}
                    value={reviewBody}
                    onChange={(event) => setReviewBody(event.target.value)}
                    placeholder="ما الذي يستحق أن تعرفه العائلة عن هذا العمل؟"
                  />
                  <FieldDescription>{reviewBody.length} / 1200</FieldDescription>
                </Field>
                <SpoilerCheck checked={reviewSpoiler} onChange={setReviewSpoiler} />
                <Button
                  className="self-start"
                  disabled={!reviewRating || reviewMutation.isPending}
                  onClick={() => reviewMutation.mutate()}
                >
                  <SparkleIcon data-icon="inline-start" />
                  {reviewMutation.isPending ? ar.common.loading : ar.social.publish}
                </Button>
              </FieldGroup>
            </CardContent>
          </Card>

          <section>
            <div className="mb-4 flex items-end justify-between gap-4">
              <div>
                <h2 className="font-heading text-2xl font-semibold">مراجعات العائلة</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  {social.data.reviews.length} مراجعة شخصية
                </p>
              </div>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              {social.data.reviews.map((item) => (
                <ReviewCard
                  key={item.id}
                  review={item}
                  spoilerMode={current.data?.account.preferences.spoilerMode ?? "cover"}
                  onChanged={invalidate}
                />
              ))}
            </div>
          </section>
        </>
      )}

      {(mode === "all" || mode === "discussion") && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ChatCircleDotsIcon /> {ar.social.discussion}
            </CardTitle>
            <CardDescription>
              حديث عام واحد حول العمل، مع ردود خفيفة وتفاعلات ثابتة.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <FieldGroup>
              {replyTo ? (
                <Badge variant="secondary" className="self-start">
                  رد على {replyTo.author.displayName}
                  <button type="button" onClick={() => setReplyTo(null)} className="ms-2">
                    ×
                  </button>
                </Badge>
              ) : null}
              <Textarea
                rows={3}
                maxLength={1200}
                value={commentBody}
                onChange={(event) => setCommentBody(event.target.value)}
                placeholder="شارك فكرة أو سؤالاً مع العائلة…"
              />
              <SpoilerCheck checked={commentSpoiler} onChange={setCommentSpoiler} />
              <Button
                className="self-start"
                disabled={!commentBody.trim() || commentMutation.isPending}
                onClick={() => commentMutation.mutate()}
              >
                {commentMutation.isPending ? ar.common.loading : ar.social.publish}
              </Button>
            </FieldGroup>
            <div className="mt-8 space-y-3">
              {social.data.comments.map((item) => (
                <CommentCard
                  key={item.id}
                  comment={item}
                  spoilerMode={current.data?.account.preferences.spoilerMode ?? "cover"}
                  onReply={() => setReplyTo(item)}
                  onChanged={invalidate}
                />
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function StarPicker({ value, onChange }: { value: number; onChange: (value: number) => void }) {
  return (
    <fieldset className="flex gap-1" dir="ltr" aria-label={`التقييم ${value} من 5`}>
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          onClick={() => onChange(star)}
          className="rounded-md p-1 text-amber-400 outline-none hover:bg-amber-400/10 focus-visible:ring-3 focus-visible:ring-ring/50"
          aria-label={`${star} من 5`}
        >
          <StarIcon size={26} weight={star <= value ? "fill" : "regular"} />
        </button>
      ))}
    </fieldset>
  );
}

function SpoilerCheck({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <label htmlFor="social-spoiler" className="flex items-center gap-3 text-sm">
      <Checkbox id="social-spoiler" checked={checked} onCheckedChange={onChange} />
      {ar.social.spoiler}
    </label>
  );
}

function ReviewCard({
  review,
  spoilerMode,
  onChanged,
}: {
  review: TitleReview;
  spoilerMode: "cover" | "hide" | "show";
  onChanged: () => Promise<unknown>;
}) {
  return (
    <Card size="sm">
      <CardHeader className="flex-row items-start gap-3">
        <AccountAvatar avatarKey={review.author.avatarKey} label={review.author.displayName} />
        <div className="min-w-0 flex-1">
          <CardTitle className="text-sm">{review.author.displayName}</CardTitle>
          <CardDescription>
            {"★".repeat(review.rating)}
            {"☆".repeat(5 - review.rating)}
          </CardDescription>
        </div>
        {review.containsSpoilers ? <Badge variant="outline">حرق</Badge> : null}
      </CardHeader>
      <CardContent>
        {review.body ? (
          <SpoilerBody containsSpoilers={review.containsSpoilers} mode={spoilerMode}>
            {review.body}
          </SpoilerBody>
        ) : null}
        <ReactionBar kind="review" id={review.id} values={review.reactions} onChanged={onChanged} />
      </CardContent>
    </Card>
  );
}

function CommentCard({
  comment,
  spoilerMode,
  onReply,
  onChanged,
}: {
  comment: TitleComment;
  spoilerMode: "cover" | "hide" | "show";
  onReply: () => void;
  onChanged: () => Promise<unknown>;
}) {
  return (
    <div
      className={
        comment.parentId ? "ms-8 rounded-2xl border bg-muted/25 p-4" : "rounded-2xl border p-4"
      }
    >
      <div className="flex items-center gap-3">
        <AccountAvatar avatarKey={comment.author.avatarKey} label={comment.author.displayName} />
        <div>
          <strong className="text-sm">{comment.author.displayName}</strong>
          <p className="text-xs text-muted-foreground">
            {new Intl.DateTimeFormat("ar", { dateStyle: "medium" }).format(
              new Date(comment.createdAt),
            )}
          </p>
        </div>
        {comment.containsSpoilers ? (
          <Badge variant="outline" className="ms-auto">
            حرق
          </Badge>
        ) : null}
      </div>
      <div className="mt-3">
        <SpoilerBody containsSpoilers={comment.containsSpoilers} mode={spoilerMode}>
          {comment.body}
        </SpoilerBody>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <ReactionBar
          kind="comment"
          id={comment.id}
          values={comment.reactions}
          onChanged={onChanged}
        />
        <Button variant="ghost" size="sm" onClick={onReply}>
          رد
        </Button>
      </div>
    </div>
  );
}

function SpoilerBody({
  children,
  containsSpoilers,
  mode,
}: {
  children: string;
  containsSpoilers: boolean;
  mode: "cover" | "hide" | "show";
}) {
  const [revealed, setRevealed] = useState(false);
  if (!containsSpoilers || mode === "show" || revealed)
    return <p className="whitespace-pre-wrap leading-7">{children}</p>;
  if (mode === "hide")
    return (
      <p className="rounded-xl bg-muted p-3 text-sm text-muted-foreground">
        محتوى حارق مخفي حسب إعداداتك.
      </p>
    );
  return (
    <button
      type="button"
      className="w-full rounded-xl border border-dashed bg-muted/40 p-4 text-sm text-muted-foreground hover:text-foreground"
      onClick={() => setRevealed(true)}
    >
      يحتوي على حرق · اضغط للكشف
    </button>
  );
}

function ReactionBar({
  kind,
  id,
  values,
  onChanged,
}: {
  kind: "review" | "comment";
  id: string;
  values: Record<string, number>;
  onChanged: () => Promise<unknown>;
}) {
  const mutation = useMutation({
    mutationFn: (emoji: (typeof reactions)[number][0]) => toggleReaction(kind, id, emoji),
    onSuccess: onChanged,
  });
  return (
    <div className="mt-3 flex flex-wrap gap-1">
      {reactions.map(([emoji, symbol, label]) => (
        <Button
          key={emoji}
          variant="ghost"
          size="sm"
          aria-label={label}
          onClick={() => mutation.mutate(emoji)}
        >
          <span aria-hidden="true">{symbol}</span>
          {values[emoji] ? <span className="font-mono text-xs">{values[emoji]}</span> : null}
        </Button>
      ))}
    </div>
  );
}
