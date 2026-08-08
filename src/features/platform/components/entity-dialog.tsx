import { BuildingsIcon, CalendarBlankIcon, UserIcon } from "@phosphor-icons/react";
import { Link } from "@tanstack/react-router";
import type { CSSProperties, ReactNode } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import type { Entity } from "@/features/library/model";
import { cn } from "@/lib/utils";

export function EntityDialog({
  entity,
  children,
  open,
  onOpenChange,
  triggerClassName,
  triggerStyle,
}: {
  entity: Entity;
  children?: ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  triggerClassName?: string;
  triggerStyle?: CSSProperties;
}) {
  const isStudio = entity.entityType === "organization";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {children && (
        <DialogTrigger
          render={
            <button
              type="button"
              className={cn("text-start", triggerClassName)}
              style={triggerStyle}
            />
          }
        >
          {children}
        </DialogTrigger>
      )}
      <DialogContent
        className={cn(
          "platform-surface max-h-[90svh] overflow-y-auto p-0",
          isStudio ? "sm:max-w-3xl" : "sm:max-w-2xl",
        )}
      >
        {isStudio ? (
          <div className="p-6 sm:p-8">
            <DialogHeader>
              <div className="flex items-center gap-4">
                <div className="flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-xl border bg-muted sm:size-20">
                  {entity.imagePath ? (
                    <img src={entity.imagePath} alt="" className="size-full object-cover" />
                  ) : (
                    <BuildingsIcon size={28} className="text-muted-foreground" />
                  )}
                </div>
                <div>
                  <div className="mb-1 text-xs font-semibold tracking-[0.15em] text-primary">
                    استوديو / منظمة
                  </div>
                  <DialogTitle className="text-2xl leading-tight">{entity.name}</DialogTitle>
                  <DialogDescription className="mt-1">
                    {entity.alternativeNames.slice(0, 3).join(" · ") ||
                      "سجل مؤسسي من أرشيف طبيعاوي شاهد"}
                  </DialogDescription>
                </div>
              </div>
            </DialogHeader>

            <p className="mt-6 leading-7 text-muted-foreground">
              {entity.description || "لم يُضف وصف تحريري لهذا السجل بعد."}
            </p>

            <dl className="mt-6 grid grid-cols-2 gap-3 sm:max-w-xs">
              <Stat label="الأعمال المرتبطة" value={String(entity.workCount)} />
              <Stat
                label="سنة التأسيس"
                value={entity.establishedAt || "غير موثّق"}
                icon={<CalendarBlankIcon />}
              />
            </dl>

            {entity.works.length > 0 && (
              <div className="mt-6">
                <h3 className="mb-3 font-heading text-sm font-semibold">أعمال بارزة</h3>
                <div className="flex gap-3 overflow-x-auto pb-2">
                  {entity.works.slice(0, 6).map((work) => (
                    <Link
                      key={work.id}
                      to="/works/$workId"
                      params={{ workId: work.id }}
                      className="w-24 shrink-0"
                    >
                      <div className="aspect-2/3 overflow-hidden rounded-lg bg-muted">
                        {work.imagePath && (
                          <img src={work.imagePath} alt="" className="size-full object-cover" />
                        )}
                      </div>
                      <span className="mt-1.5 block truncate text-xs">
                        {work.arabicTitle || work.title}
                      </span>
                    </Link>
                  ))}
                </div>
              </div>
            )}

            <Button
              nativeButton={false}
              render={<Link to="/studios/$studioId" params={{ studioId: entity.id }} />}
              className="mt-6 w-full"
            >
              فتح الصفحة الكاملة
            </Button>
          </div>
        ) : (
          <div className="grid sm:grid-cols-[12rem_1fr]">
            <div className="relative min-h-48 overflow-hidden bg-muted sm:min-h-full">
              {entity.imagePath ? (
                <img
                  src={entity.imagePath}
                  alt=""
                  className="absolute inset-0 size-full object-cover"
                />
              ) : (
                <div className="flex size-full min-h-48 items-center justify-center text-muted-foreground">
                  <UserIcon size={48} />
                </div>
              )}
              <div className="absolute inset-0 bg-linear-to-t from-popover via-transparent to-transparent sm:bg-linear-to-s" />
            </div>
            <div className="p-6 sm:p-8">
              <DialogHeader>
                <div className="mb-2 text-xs font-semibold tracking-[0.15em] text-primary">
                  شخصية منتقاة
                </div>
                <DialogTitle className="text-2xl leading-tight">{entity.name}</DialogTitle>
                <DialogDescription>
                  {entity.alternativeNames.slice(0, 3).join(" · ") ||
                    "سجل شخص من أرشيف طبيعاوي شاهد"}
                </DialogDescription>
              </DialogHeader>
              <p className="mt-6 leading-7 text-muted-foreground">
                {entity.description || "لم يُضف وصف تحريري لهذا السجل بعد."}
              </p>
              <dl className="mt-6 grid grid-cols-2 gap-3">
                <Stat label="الأعمال المرتبطة" value={String(entity.workCount)} />
                <Stat
                  label="الأدوار"
                  value={String(entity.roles.length)}
                  icon={<CalendarBlankIcon />}
                />
              </dl>
              {entity.works.length > 0 && (
                <div className="mt-6">
                  <h3 className="mb-3 font-heading text-sm font-semibold">أعمال بارزة</h3>
                  <div className="flex gap-2 overflow-x-auto pb-2">
                    {entity.works.slice(0, 5).map((work) => (
                      <Link
                        key={work.id}
                        to="/works/$workId"
                        params={{ workId: work.id }}
                        className="w-24 shrink-0"
                      >
                        <div className="aspect-2/3 overflow-hidden rounded-lg bg-muted">
                          {work.imagePath && (
                            <img src={work.imagePath} alt="" className="size-full object-cover" />
                          )}
                        </div>
                        <span className="mt-1.5 block truncate text-xs">
                          {work.arabicTitle || work.title}
                        </span>
                      </Link>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function Stat({ label, value, icon }: { label: string; value: string; icon?: ReactNode }) {
  return (
    <div className="rounded-lg border bg-muted/40 p-3">
      <dt className="flex items-center gap-1.5 text-xs text-muted-foreground">
        {icon}
        {label}
      </dt>
      <dd className="mt-1 font-heading text-sm font-semibold">{value}</dd>
    </div>
  );
}
