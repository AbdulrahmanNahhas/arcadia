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
  const FallbackIcon = isStudio ? BuildingsIcon : UserIcon;

  const categoryLabel = isStudio ? "استوديو / منظمة" : "شخصية منتقاة";
  const defaultAltName = isStudio ? "سجل مؤسسي من أرشيف نحّاسينما" : "سجل شخص من أرشيف نحّاسينما";

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
      <DialogContent className="platform-surface max-h-[90svh] overflow-y-auto p-0 sm:max-w-175">
        <div className="p-6 sm:p-8">
          {/* Header */}
          <DialogHeader>
            <div className="flex items-center gap-4">
              <div
                className={cn(
                  "flex size-16 shrink-0 items-center justify-center overflow-hidden border bg-muted sm:size-20",
                  isStudio ? "rounded-xl" : "rounded-full",
                )}
              >
                {entity.imagePath ? (
                  <img src={entity.imagePath} alt="" className="size-full object-cover" />
                ) : (
                  <FallbackIcon size={28} className="text-muted-foreground" />
                )}
              </div>
              <div>
                <div className="mb-1 text-xs font-semibold tracking-[0.15em] text-primary">
                  {categoryLabel}
                </div>
                <DialogTitle className="text-2xl leading-tight">{entity.name}</DialogTitle>
                <DialogDescription className="mt-1">{defaultAltName}</DialogDescription>
              </div>
            </div>
          </DialogHeader>

          {/* Description */}
          <p className="mt-6 leading-7 text-muted-foreground">
            {entity.description || "لم يُضف وصف تحريري لهذا السجل بعد."}
          </p>

          {/* Stats */}
          <dl className="mt-6 grid grid-cols-2 gap-3 sm:max-w-xs">
            <Stat label="الأعمال المرتبطة" value={String(entity.workCount)} />
            {isStudio ? (
              <Stat
                label="سنة التأسيس"
                value={entity.establishedAt || "غير موثّق"}
                icon={<CalendarBlankIcon />}
              />
            ) : (
              <Stat label="الأدوار" value={String(entity.roles?.length ?? 0)} icon={<UserIcon />} />
            )}
          </dl>

          {/* Featured Works */}
          {entity.works.length > 0 && (
            <div className="mt-6">
              <h3 className="mb-3 font-heading text-sm font-semibold">أعمال بارزة</h3>
              <div className="flex gap-3 overflow-x-auto pb-2">
                {entity.works.slice(0, 6).map((work) => (
                  <Link
                    key={work.id}
                    to="/titles/$titleId"
                    params={{ titleId: work.id }}
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

          {/* Full Page Button */}
          <Button
            nativeButton={false}
            render={
              isStudio ? (
                <Link to="/studios/$studioId" params={{ studioId: entity.id }} />
              ) : (
                <Link to="/people/$personId" params={{ personId: entity.id }} />
              )
            }
            className="mt-6 w-full"
          >
            فتح الصفحة الكاملة
          </Button>
        </div>
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
