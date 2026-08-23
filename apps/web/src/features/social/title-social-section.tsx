import type { TitleComment, TitleReview } from "@arcadia/contracts";
import { ar } from "@arcadia/i18n";
import {
  ArrowBendUpLeftIcon,
  BrainIcon,
  ChatCircleDotsIcon,
  HandsClappingIcon,
  HeartIcon,
  PaperPlaneRightIcon,
  PencilSimpleIcon,
  SmileyIcon,
  SparkleIcon,
  StarIcon,
  TrashIcon,
  XIcon,
} from "@phosphor-icons/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupTextarea,
} from "@/components/ui/input-group";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { AccountAvatar } from "@/features/accounts/account-avatar";
import { useCurrentAccount } from "@/features/accounts/api";
import { cn } from "@/lib/utils";
import {
  deleteComment,
  deleteReview,
  getTitleSocial,
  saveComment,
  saveReview,
  socialKeys,
  toggleReaction,
  updateTitleState,
} from "./api";

const reactions = [
  ["heart", HeartIcon, "أحببته"],
  ["clap", HandsClappingIcon, "أحسنت"],
  ["laugh", SmileyIcon, "أضحكني"],
  ["wow", SparkleIcon, "مذهل"],
  ["think", BrainIcon, "يدعو للتفكير"],
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
  const [reviewDialogOpen, setReviewDialogOpen] = useState(false);
  const [deleteReviewOpen, setDeleteReviewOpen] = useState(false);
  const [commentBody, setCommentBody] = useState("");
  const [commentSpoiler, setCommentSpoiler] = useState(false);
  const [replyTo, setReplyTo] = useState<TitleComment | null>(null);
  const [discussionComposerOpen, setDiscussionComposerOpen] = useState(false);
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
    onSuccess: async () => {
      setReviewDialogOpen(false);
      await invalidate();
    },
  });
  const deleteReviewMutation = useMutation({
    mutationFn: () => deleteReview(titleId),
    onSuccess: async () => {
      setDeleteReviewOpen(false);
      setReviewDialogOpen(false);
      setReviewRating(0);
      setReviewBody("");
      setReviewSpoiler(false);
      await invalidate();
    },
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
      setDiscussionComposerOpen(false);
      await invalidate();
    },
  });

  if (social.isLoading) return <p className="py-12 text-muted-foreground">جارٍ جمع حديث العائلة…</p>;
  if (!social.data) return <p className="py-12 text-muted-foreground">تعذّر تحميل مساحة العائلة.</p>;
  const state = social.data.state;
  const commentsById = new Set(social.data.comments.map((comment) => comment.id));
  const rootComments = social.data.comments.filter(
    (comment) => !comment.parentId || !commentsById.has(comment.parentId),
  );
  const repliesByParent = new Map<string, TitleComment[]>();
  for (const comment of social.data.comments) {
    if (!comment.parentId || !commentsById.has(comment.parentId)) continue;
    const replies = repliesByParent.get(comment.parentId) ?? [];
    replies.push(comment);
    repliesByParent.set(comment.parentId, replies);
  }
  const participants = Array.from(
    new Map([
      ...(current.data
        ? [
            [
              current.data.account.id,
              {
                id: current.data.account.id,
                displayName: current.data.account.displayName,
                avatarKey: current.data.account.avatarKey,
              },
            ] as const,
          ]
        : []),
      ...social.data.comments.map((comment) => [comment.author.id, comment.author] as const),
    ]).values(),
  ).slice(0, 5);

  return (
    <div className="flex flex-col gap-8">
      {(mode === "all" || mode === "quick") && (
        <div className="flex flex-wrap items-center justify-between gap-5">
          <div className="min-w-52 flex-1 rounded-2xl border bg-card/45 px-4 py-3">
            <div className="flex flex-wrap items-center gap-3">
              <StarPicker
                value={reviewRating}
                onChange={(rating) => {
                  setReviewRating(rating);
                  setReviewDialogOpen(true);
                }}
              />
              {ownReview ? <Badge variant="secondary">مراجعتك منشورة</Badge> : null}
            </div>
            <p className="mt-1.5 line-clamp-1 text-xs text-muted-foreground">
              {ownReview?.body || "اختر عدد النجوم، ثم أضف انطباعاً اختيارياً."}
            </p>
          </div>
          <Button
            variant={state?.isFavorite ? "default" : "outline"}
            className="rounded-full"
            disabled={stateMutation.isPending}
            onClick={() => stateMutation.mutate({ isFavorite: !state?.isFavorite })}
          >
            <HeartIcon data-icon="inline-start" weight={state?.isFavorite ? "fill" : "regular"} />
            {state?.isFavorite ? "في المفضلة" : "أضف إلى المفضلة"}
          </Button>
        </div>
      )}

      {(mode === "all" || mode === "reviews") && (
        <>
          <Card size="sm">
            <CardHeader className="border-b sm:flex sm:flex-row sm:items-center sm:justify-between">
              <div>
                <CardTitle>{ownReview ? "عدّل مراجعتك" : "اكتب مراجعتك"}</CardTitle>
                <CardDescription className="mt-1">
                  تقييم واحد لكل حساب، والانطباع اختياري.
                </CardDescription>
              </div>
              {ownReview ? (
                <Button variant="destructive" size="sm" onClick={() => setDeleteReviewOpen(true)}>
                  <TrashIcon data-icon="inline-start" /> حذف المراجعة
                </Button>
              ) : null}
            </CardHeader>
            <CardContent>
              <FieldGroup className="gap-4">
                <Field orientation="responsive">
                  <FieldLabel>التقييم</FieldLabel>
                  <StarPicker value={reviewRating} onChange={setReviewRating} />
                </Field>
                <Field>
                  <FieldLabel htmlFor="family-review" className="sr-only">
                    انطباعك
                  </FieldLabel>
                  <Textarea
                    id="family-review"
                    rows={2}
                    maxLength={1200}
                    value={reviewBody}
                    onChange={(event) => setReviewBody(event.target.value)}
                    placeholder="ما الذي يستحق أن تعرفه العائلة عن هذا العمل؟"
                  />
                  <FieldDescription>{reviewBody.length} / 1200</FieldDescription>
                </Field>
                <Field orientation="responsive">
                  <SpoilerCheck
                    id="review-social-spoiler"
                    checked={reviewSpoiler}
                    onChange={setReviewSpoiler}
                  />
                  <Button
                    disabled={!reviewRating || reviewMutation.isPending}
                    onClick={() => reviewMutation.mutate()}
                  >
                    <SparkleIcon data-icon="inline-start" />
                    {reviewMutation.isPending ? ar.common.loading : ar.social.publish}
                  </Button>
                </Field>
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
                  isOwn={item.id === ownReview?.id}
                  spoilerMode={current.data?.account.preferences.spoilerMode ?? "cover"}
                  onEdit={() => setReviewDialogOpen(true)}
                  onDelete={() => setDeleteReviewOpen(true)}
                  onChanged={invalidate}
                />
              ))}
            </div>
          </section>
        </>
      )}

      {(mode === "all" || mode === "discussion") && (
        <section aria-labelledby="family-discussion-heading" className="flex flex-col gap-8">
          <header className="flex flex-col gap-5 border-b pb-6 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <div className="flex items-center gap-3">
                <span className="flex size-10 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
                  <ChatCircleDotsIcon weight="duotone" />
                </span>
                <div>
                  <p className="text-xs font-medium text-muted-foreground">حديث صغير حول العمل</p>
                  <h2
                    id="family-discussion-heading"
                    className="mt-0.5 font-heading text-2xl font-semibold"
                  >
                    {ar.social.discussion}
                  </h2>
                </div>
              </div>
              <p className="mt-3 max-w-xl leading-7 text-muted-foreground">
                {social.data.comments.length
                  ? `${social.data.comments.length} مداخلة من العائلة — اترك رأياً أو تابع خيطاً بدأه شخص آخر.`
                  : "لا توجد مداخلات بعد. ابدأ سؤالاً صغيراً قبل سهرة المشاهدة القادمة."}
              </p>
            </div>
            {participants.length > 0 ? (
              <div className="flex items-center gap-3">
                <ul aria-label={`${participants.length} مشاركون في النقاش`} className="flex">
                  {participants.map((participant) => (
                    <li key={participant.id} className="-ms-2 first:ms-0">
                      <AccountAvatar
                        key={participant.id}
                        avatarKey={participant.avatarKey}
                        label={participant.displayName}
                        className="size-9 ring-2 ring-background"
                      />
                    </li>
                  ))}
                </ul>
                <span className="text-xs text-muted-foreground">
                  {participants.length === 1
                    ? "صوت واحد حاضر"
                    : `${participants.length} أصوات حاضرة`}
                </span>
              </div>
            ) : null}
          </header>

          <div className="flex gap-3 sm:gap-4">
            {current.data ? (
              <AccountAvatar
                avatarKey={current.data.account.avatarKey}
                label={current.data.account.displayName}
                className="size-10 shrink-0"
              />
            ) : null}
            <FieldGroup className="min-w-0 flex-1 gap-2">
              <Field>
                <FieldLabel htmlFor="family-comment" className="sr-only">
                  اكتب تعليقاً
                </FieldLabel>
                <InputGroup>
                  <InputGroupTextarea
                    id="family-comment"
                    rows={discussionComposerOpen ? 3 : 1}
                    maxLength={1200}
                    value={commentBody}
                    onFocus={() => setDiscussionComposerOpen(true)}
                    onChange={(event) => setCommentBody(event.target.value)}
                    onKeyDown={(event) => {
                      if (
                        event.key === "Enter" &&
                        (event.metaKey || event.ctrlKey) &&
                        commentBody.trim() &&
                        !commentMutation.isPending
                      ) {
                        event.preventDefault();
                        commentMutation.mutate();
                      }
                    }}
                    placeholder={
                      replyTo
                        ? `اكتب ردّك إلى ${replyTo.author.displayName}…`
                        : "أضف تعليقاً للعائلة…"
                    }
                  />
                  {discussionComposerOpen ? (
                    <InputGroupAddon align="block-end" className="justify-between gap-3">
                      <div className="flex min-w-0 flex-wrap items-center gap-2">
                        {replyTo ? (
                          <Badge variant="secondary">
                            رد على {replyTo.author.displayName}
                            <Button
                              variant="ghost"
                              size="icon-xs"
                              aria-label="إلغاء الرد"
                              onClick={() => setReplyTo(null)}
                            >
                              <XIcon />
                            </Button>
                          </Badge>
                        ) : null}
                        <SpoilerCheck
                          id="comment-social-spoiler"
                          checked={commentSpoiler}
                          onChange={setCommentSpoiler}
                        />
                      </div>
                      <div className="flex items-center gap-2">
                        <InputGroupButton
                          type="button"
                          variant="ghost"
                          onClick={() => {
                            setCommentBody("");
                            setCommentSpoiler(false);
                            setReplyTo(null);
                            setDiscussionComposerOpen(false);
                          }}
                        >
                          إلغاء
                        </InputGroupButton>
                        <InputGroupButton
                          type="button"
                          variant="default"
                          size="sm"
                          disabled={!commentBody.trim() || commentMutation.isPending}
                          onClick={() => commentMutation.mutate()}
                        >
                          <PaperPlaneRightIcon data-icon="inline-start" />
                          {commentMutation.isPending ? ar.common.loading : "نشر"}
                        </InputGroupButton>
                      </div>
                    </InputGroupAddon>
                  ) : null}
                </InputGroup>
              </Field>
              {discussionComposerOpen ? (
                <FieldDescription className="px-1 text-xs">
                  {commentBody.length} / 1200 · اضغط Ctrl + Enter للنشر
                </FieldDescription>
              ) : null}
            </FieldGroup>
          </div>

          {rootComments.length > 0 ? (
            <div className="flex flex-col gap-7">
              {rootComments.map((comment) => (
                <DiscussionComment
                  key={comment.id}
                  titleId={titleId}
                  comment={comment}
                  repliesByParent={repliesByParent}
                  spoilerMode={current.data?.account.preferences.spoilerMode ?? "cover"}
                  currentAccountId={current.data?.account.id}
                  canModerate={
                    current.data?.account.role === "owner" ||
                    current.data?.account.role === "editor"
                  }
                  onReply={(item) => {
                    setReplyTo(item);
                    setDiscussionComposerOpen(true);
                  }}
                  onChanged={invalidate}
                />
              ))}
            </div>
          ) : (
            <Empty className="min-h-44 border bg-muted/20 p-8">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <ChatCircleDotsIcon weight="duotone" />
                </EmptyMedia>
                <EmptyTitle>ابدأ الحديث</EmptyTitle>
                <EmptyDescription>
                  سؤال واحد أو ملاحظة قصيرة يكفيان لفتح نقاش العائلة حول هذا العمل.
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          )}
        </section>
      )}

      <Dialog open={reviewDialogOpen} onOpenChange={setReviewDialogOpen}>
        <DialogContent className="gap-4">
          <DialogHeader>
            <DialogTitle>{ownReview ? "عدّل مراجعتك" : "انشر تقييمك"}</DialogTitle>
            <DialogDescription>
              النجوم مطلوبة، أما وصف انطباعك فاختياري ويمكنك تعديله لاحقاً.
            </DialogDescription>
          </DialogHeader>
          <FieldGroup className="gap-3">
            <Field orientation="responsive">
              <FieldLabel>التقييم</FieldLabel>
              <StarPicker value={reviewRating} onChange={setReviewRating} />
            </Field>
            <Field>
              <FieldLabel htmlFor="quick-family-review">انطباع اختياري</FieldLabel>
              <Textarea
                id="quick-family-review"
                rows={2}
                maxLength={1200}
                value={reviewBody}
                onChange={(event) => setReviewBody(event.target.value)}
                placeholder="ما الذي تريد أن تعرفه العائلة عن هذا العمل؟"
              />
              <FieldDescription>{reviewBody.length} / 1200</FieldDescription>
            </Field>
            <SpoilerCheck
              id="quick-social-spoiler"
              checked={reviewSpoiler}
              onChange={setReviewSpoiler}
            />
          </FieldGroup>
          <DialogFooter>
            {ownReview ? (
              <Button
                variant="destructive"
                onClick={() => {
                  setReviewDialogOpen(false);
                  setDeleteReviewOpen(true);
                }}
              >
                <TrashIcon data-icon="inline-start" /> حذف المراجعة
              </Button>
            ) : null}
            <Button
              disabled={!reviewRating || reviewMutation.isPending}
              onClick={() => reviewMutation.mutate()}
            >
              <SparkleIcon data-icon="inline-start" />
              {reviewMutation.isPending ? ar.common.loading : ar.social.publish}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteReviewOpen} onOpenChange={setDeleteReviewOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>حذف مراجعتك؟</DialogTitle>
            <DialogDescription>
              سيُحذف التقييم والانطباع وتفاعلاتهما. يمكنك كتابة مراجعة جديدة لاحقاً.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter showCloseButton>
            <Button
              variant="destructive"
              disabled={deleteReviewMutation.isPending}
              onClick={() => deleteReviewMutation.mutate()}
            >
              <TrashIcon data-icon="inline-start" />
              {deleteReviewMutation.isPending ? "جارٍ الحذف…" : "حذف المراجعة"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
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
          className="rounded-md p-1 text-primary outline-none hover:bg-accent focus-visible:ring-3 focus-visible:ring-ring/50"
          aria-label={`${star} من 5`}
        >
          <StarIcon size={26} weight={star <= value ? "fill" : "regular"} />
        </button>
      ))}
    </fieldset>
  );
}

function SpoilerCheck({
  id,
  checked,
  onChange,
}: {
  id: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <label htmlFor={id} className="flex items-center gap-3 text-sm">
      <Checkbox id={id} checked={checked} onCheckedChange={onChange} />
      {ar.social.spoiler}
    </label>
  );
}

function ReviewCard({
  review,
  isOwn,
  spoilerMode,
  onEdit,
  onDelete,
  onChanged,
}: {
  review: TitleReview;
  isOwn: boolean;
  spoilerMode: "cover" | "hide" | "show";
  onEdit: () => void;
  onDelete: () => void;
  onChanged: () => Promise<unknown>;
}) {
  return (
    <Card size="sm">
      <CardHeader className="flex-row items-start gap-3">
        <AccountAvatar avatarKey={review.author.avatarKey} label={review.author.displayName} />
        <div className="min-w-0 flex-1">
          <CardTitle>{review.author.displayName}</CardTitle>
          <ReviewStars value={review.rating} />
        </div>
        {review.containsSpoilers ? <Badge variant="outline">حرق</Badge> : null}
      </CardHeader>
      <CardContent>
        {review.body ? (
          <SpoilerBody containsSpoilers={review.containsSpoilers} mode={spoilerMode}>
            {review.body}
          </SpoilerBody>
        ) : (
          <p className="text-sm text-muted-foreground">اكتفى بتقييم النجوم.</p>
        )}
      </CardContent>
      <CardFooter className="flex-wrap justify-between gap-2 border-t">
        <ReactionBar kind="review" id={review.id} values={review.reactions} onChanged={onChanged} />
        {isOwn ? (
          <div className="flex items-center gap-1">
            <Tooltip>
              <TooltipTrigger
                render={
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    onClick={onEdit}
                    aria-label="تعديل المراجعة"
                  />
                }
              >
                <PencilSimpleIcon />
              </TooltipTrigger>
              <TooltipContent>تعديل المراجعة</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger
                render={
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    onClick={onDelete}
                    aria-label="حذف المراجعة"
                  />
                }
              >
                <TrashIcon />
              </TooltipTrigger>
              <TooltipContent>حذف المراجعة</TooltipContent>
            </Tooltip>
          </div>
        ) : null}
      </CardFooter>
    </Card>
  );
}

function ReviewStars({ value }: { value: number }) {
  return (
    <div
      className="mt-1 flex items-center gap-0.5 text-primary"
      dir="ltr"
      role="img"
      aria-label={`${value} من 5`}
    >
      {[1, 2, 3, 4, 5].map((star) => (
        <StarIcon key={star} size={14} weight={star <= value ? "fill" : "regular"} />
      ))}
    </div>
  );
}

function DiscussionComment({
  titleId,
  comment,
  spoilerMode,
  currentAccountId,
  canModerate = false,
  onReply,
  onChanged,
  repliesByParent,
  depth = 0,
}: {
  titleId: string;
  comment: TitleComment;
  spoilerMode: "cover" | "hide" | "show";
  currentAccountId?: string;
  canModerate?: boolean;
  onReply: (comment: TitleComment) => void;
  onChanged: () => Promise<unknown>;
  repliesByParent: Map<string, TitleComment[]>;
  depth?: number;
}) {
  const replies = repliesByParent.get(comment.id) ?? [];
  const canDelete = canModerate || comment.author.id === currentAccountId;
  const [deleteOpen, setDeleteOpen] = useState(false);
  const deleteMutation = useMutation({
    mutationFn: () => deleteComment(titleId, comment.id),
    onSuccess: async () => {
      setDeleteOpen(false);
      await onChanged();
    },
  });
  return (
    <article className={cn("flex gap-3 sm:gap-4", depth > 0 && "ms-5 sm:ms-10")}>
      <AccountAvatar
        avatarKey={comment.author.avatarKey}
        label={comment.author.displayName}
        className="size-9 shrink-0"
      />
      <div className="min-w-0 flex-1">
        <header className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <h3 className="text-sm font-semibold">{comment.author.displayName}</h3>
          <span className="text-xs text-muted-foreground">
            {new Intl.DateTimeFormat("ar", { dateStyle: "medium" }).format(
              new Date(comment.createdAt),
            )}
          </span>
          {comment.containsSpoilers ? <Badge variant="outline">حرق</Badge> : null}
        </header>
        <div className="mt-2 text-sm">
          <SpoilerBody containsSpoilers={comment.containsSpoilers} mode={spoilerMode}>
            {comment.body}
          </SpoilerBody>
        </div>
        <footer className="mt-2 flex flex-wrap items-center gap-2">
          <ReactionBar
            kind="comment"
            id={comment.id}
            values={comment.reactions}
            onChanged={onChanged}
          />
          <Button variant="ghost" size="xs" onClick={() => onReply(comment)}>
            <ArrowBendUpLeftIcon data-icon="inline-start" /> رد
          </Button>
          {canDelete ? (
            <Tooltip>
              <TooltipTrigger
                render={
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    className="text-muted-foreground hover:text-destructive"
                    onClick={() => setDeleteOpen(true)}
                    aria-label="حذف التعليق"
                  />
                }
              >
                <TrashIcon />
              </TooltipTrigger>
              <TooltipContent>حذف التعليق</TooltipContent>
            </Tooltip>
          ) : null}
        </footer>
        {replies.length > 0 ? (
          <div className="mt-4 flex flex-col gap-5 border-s border-border/60 ps-4 sm:ps-5">
            {replies.map((reply) => (
              <DiscussionComment
                key={reply.id}
                titleId={titleId}
                comment={reply}
                repliesByParent={repliesByParent}
                spoilerMode={spoilerMode}
                currentAccountId={currentAccountId}
                canModerate={canModerate}
                onReply={onReply}
                onChanged={onChanged}
                depth={depth + 1}
              />
            ))}
          </div>
        ) : null}
      </div>

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>حذف هذا التعليق؟</DialogTitle>
            <DialogDescription>
              {replies.length > 0
                ? `سيُحذف التعليق وردوده الـ${replies.length} أيضاً. لا يمكن التراجع عن هذا.`
                : "لا يمكن التراجع عن هذا."}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter showCloseButton>
            <Button
              variant="destructive"
              disabled={deleteMutation.isPending}
              onClick={() => deleteMutation.mutate()}
            >
              <TrashIcon data-icon="inline-start" />
              {deleteMutation.isPending ? "جارٍ الحذف…" : "حذف التعليق"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </article>
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
    <div className="flex flex-wrap gap-1">
      {reactions.map(([emoji, ReactionIcon, label]) => (
        <Tooltip key={emoji}>
          <TooltipTrigger
            render={
              <Button
                variant="ghost"
                size="xs"
                aria-label={label}
                onClick={() => mutation.mutate(emoji)}
              />
            }
          >
            <ReactionIcon data-icon="inline-start" />
            {values[emoji] ? <span className="font-mono">{values[emoji]}</span> : null}
          </TooltipTrigger>
          <TooltipContent>{label}</TooltipContent>
        </Tooltip>
      ))}
    </div>
  );
}
