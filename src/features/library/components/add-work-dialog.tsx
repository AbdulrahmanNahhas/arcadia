import { useState } from "react"
import type { FormEvent } from "react"
import { useMutation } from "@tanstack/react-query"
import { PlusIcon } from "@phosphor-icons/react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { addWork } from "@/server/library.functions"
import { kindLabels } from "../filtering"
import { workKinds } from "../model"
import type { WorkKind } from "../model"

export function AddWorkDialog({
  onCreated,
}: {
  onCreated: () => Promise<void>
}) {
  const [open, setOpen] = useState(false)
  const [kind, setKind] = useState<WorkKind>("movie")
  const mutation = useMutation({
    mutationFn: addWork,
    onSuccess: async () => {
      await onCreated()
      setOpen(false)
    },
  })

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const data = new FormData(event.currentTarget)
    mutation.mutate({
      data: {
        title: String(data.get("title") ?? ""),
        kind,
        year: data.get("year") ? Number(data.get("year")) : null,
        status: "planned",
        summary: String(data.get("summary") ?? ""),
      },
    })
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button size="sm" className="h-8" />}>
        <PlusIcon className="size-3.5" weight="bold" />
        إضافة عمل
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>إضافة إلى مكتبتك</DialogTitle>
          <DialogDescription>
            أنشئ السجل الأساسي الآن، ويمكنك استكمال بياناته لاحقاً من مساحة
            الإدارة.
          </DialogDescription>
        </DialogHeader>
        <form id="add-work-form" onSubmit={submit} className="grid gap-4 py-2">
          <div className="grid gap-2">
            <Label htmlFor="work-title">العنوان</Label>
            <Input
              id="work-title"
              name="title"
              placeholder="عنوان العمل"
              required
              autoFocus
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="work-kind">النوع</Label>
              <Select
                value={kind}
                onValueChange={(value) => value && setKind(value)}
              >
                <SelectTrigger id="work-kind" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {workKinds.map((item) => (
                    <SelectItem key={item} value={item}>
                      {kindLabels[item]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="work-year">السنة</Label>
              <Input
                id="work-year"
                name="year"
                type="number"
                min="1000"
                max="2200"
                placeholder="2026"
              />
            </div>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="work-summary">الملخص</Label>
            <Textarea
              id="work-summary"
              name="summary"
              placeholder="وصف قصير يمكن البحث فيه…"
              rows={4}
            />
          </div>
          {mutation.error && (
            <p className="text-sm text-destructive" role="alert">
              {mutation.error.message}
            </p>
          )}
        </form>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>
            إلغاء
          </Button>
          <Button
            type="submit"
            form="add-work-form"
            disabled={mutation.isPending}
          >
            {mutation.isPending ? "جارٍ الإضافة…" : "إضافة إلى المكتبة"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
