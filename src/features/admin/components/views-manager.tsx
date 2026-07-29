import { useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { BookmarkSimpleIcon, TrashIcon } from "@phosphor-icons/react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { getSavedViews, removeSavedView } from "@/server/library.functions"

const layoutLabels = {
  gallery: "معرض",
  table: "جدول",
  timeline: "خط زمني",
  statistics: "إحصاءات",
} as const

export function ViewsManagerDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const queryClient = useQueryClient()
  const [confirmingId, setConfirmingId] = useState<string | null>(null)
  const {
    data: views = [],
    isPending,
    isError,
  } = useQuery({
    queryKey: ["saved-views"],
    queryFn: () => getSavedViews(),
    enabled: open,
  })
  const deleteMutation = useMutation({
    mutationFn: (id: string) => removeSavedView({ data: { id } }),
    onSuccess: async () => {
      setConfirmingId(null)
      await queryClient.invalidateQueries({ queryKey: ["saved-views"] })
    },
  })

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) setConfirmingId(null)
    onOpenChange(nextOpen)
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>إدارة العروض المحفوظة</DialogTitle>
          <DialogDescription>
            راجع العروض المحفوظة واحذف أي عرض لم تعد بحاجة إليه.
          </DialogDescription>
        </DialogHeader>

        {isPending ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            جارٍ تحميل العروض…
          </p>
        ) : isError ? (
          <p className="py-8 text-center text-sm text-destructive">
            تعذر تحميل العروض المحفوظة.
          </p>
        ) : views.length === 0 ? (
          <Empty className="border">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <BookmarkSimpleIcon />
              </EmptyMedia>
              <EmptyTitle>لا توجد عروض محفوظة</EmptyTitle>
              <EmptyDescription>
                ستظهر هنا العروض التي تحفظها من المكتبة.
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <div className="max-h-[60vh] overflow-y-auto rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>الاسم</TableHead>
                  <TableHead>التخطيط</TableHead>
                  <TableHead>البحث</TableHead>
                  <TableHead className="w-32 text-end">الإجراء</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {views.map((view) => {
                  const isConfirming = confirmingId === view.id
                  const isDeleting =
                    deleteMutation.isPending &&
                    deleteMutation.variables === view.id

                  return (
                    <TableRow key={view.id}>
                      <TableCell className="max-w-56 truncate font-medium">
                        {view.name}
                      </TableCell>
                      <TableCell>{layoutLabels[view.layout]}</TableCell>
                      <TableCell className="max-w-48 truncate text-muted-foreground">
                        {view.search || "—"}
                      </TableCell>
                      <TableCell className="text-end">
                        {isConfirming ? (
                          <div className="flex justify-end gap-1">
                            <Button
                              size="sm"
                              variant="destructive"
                              disabled={isDeleting}
                              onClick={() => deleteMutation.mutate(view.id)}
                            >
                              {isDeleting ? "جارٍ الحذف…" : "تأكيد"}
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              disabled={isDeleting}
                              onClick={() => setConfirmingId(null)}
                            >
                              إلغاء
                            </Button>
                          </div>
                        ) : (
                          <Button
                            size="icon-sm"
                            variant="ghost"
                            onClick={() => {
                              deleteMutation.reset()
                              setConfirmingId(view.id)
                            }}
                            aria-label={`حذف العرض ${view.name}`}
                          >
                            <TrashIcon />
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>
        )}

        {deleteMutation.isError && (
          <p className="text-sm text-destructive" role="alert">
            تعذر حذف العرض. حاول مرة أخرى.
          </p>
        )}
      </DialogContent>
    </Dialog>
  )
}
