import { workKinds, type Work, type WorkKind } from "@/features/library/model"
import {
  editWorksBulk,
} from "@/server/library.functions"
import { useMutation } from "@tanstack/react-query"
import { useState, type FormEvent } from "react"
import { parseList } from "../admin-app"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { kindLabels, personalStatuses } from "@/features/library/filtering"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { NotePencilIcon } from "@phosphor-icons/react"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

export function BulkEditDialog({
  open,
  onOpenChange,
  workIds,
  onUpdated,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  workIds: string[]
  onUpdated: () => Promise<void>
}) {
  const [kind, setKind] = useState("")
  const [status, setStatus] = useState("")
  const [rating, setRating] = useState("")
  const [favorite, setFavorite] = useState("")
  const [addGenres, setAddGenres] = useState("")
  const [removeGenres, setRemoveGenres] = useState("")
  const [addTags, setAddTags] = useState("")
  const [removeTags, setRemoveTags] = useState("")
  const mutation = useMutation({
    mutationFn: editWorksBulk,
    onSuccess: async () => {
      onOpenChange(false)
      await onUpdated()
    },
  })
  const submit = (event: FormEvent) => {
    event.preventDefault()
    mutation.mutate({
      data: {
        workIds,
        ...(kind ? { kind: kind as WorkKind } : {}),
        ...(status ? { status: status as Work["status"] } : {}),
        ...(rating ? { rating: Number(rating) } : {}),
        ...(favorite ? { favorite: favorite === "true" } : {}),
        addGenres: parseList(addGenres),
        removeGenres: parseList(removeGenres),
        addTags: parseList(addTags),
        removeTags: parseList(removeTags),
      },
    })
  }
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            Edit {workIds.length} selected{" "}
            {workIds.length === 1 ? "work" : "works"}
          </DialogTitle>

          <DialogDescription>
            Only configured fields will be changed. Adding or removing values
            preserves all other existing data.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={submit} className="space-y-6">
          <div className="grid gap-5 sm:grid-cols-2">
            <FormField label="Set type" htmlFor="bulk-kind">
              <Select value={kind} onValueChange={setKind}>
                <SelectTrigger id="bulk-kind" className="w-full">
                  <SelectValue placeholder="Keep unchanged" />
                </SelectTrigger>

                <SelectContent>
                  <SelectItem value="unchanged">Keep unchanged</SelectItem>

                  {workKinds.map((item) => (
                    <SelectItem key={item} value={item}>
                      {kindLabels[item]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>

            <FormField label="Set status" htmlFor="bulk-status">
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger id="bulk-status" className="w-full">
                  <SelectValue placeholder="Keep unchanged" />
                </SelectTrigger>

                <SelectContent>
                  <SelectItem value="unchanged">Keep unchanged</SelectItem>

                  {personalStatuses.map((item) => (
                    <SelectItem key={item} value={item}>
                      {item}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>

            <FormField label="Set rating" htmlFor="bulk-rating">
              <Input
                id="bulk-rating"
                type="number"
                min={0}
                max={10}
                step={0.1}
                value={rating}
                onChange={(event) => setRating(event.target.value)}
                placeholder="Keep unchanged"
              />
            </FormField>

            <FormField label="Set favorite" htmlFor="bulk-favorite">
              <Select value={favorite} onValueChange={setFavorite}>
                <SelectTrigger id="bulk-favorite" className="w-full">
                  <SelectValue placeholder="Keep unchanged" />
                </SelectTrigger>

                <SelectContent>
                  <SelectItem value="unchanged">Keep unchanged</SelectItem>
                  <SelectItem value="true">Favorite</SelectItem>
                  <SelectItem value="false">Not favorite</SelectItem>
                </SelectContent>
              </Select>
            </FormField>

            <FormField label="Add genres" htmlFor="bulk-add-genres">
              <Input
                id="bulk-add-genres"
                value={addGenres}
                onChange={(event) => setAddGenres(event.target.value)}
                placeholder="Drama, Classic"
              />
            </FormField>

            <FormField label="Remove genres" htmlFor="bulk-remove-genres">
              <Input
                id="bulk-remove-genres"
                value={removeGenres}
                onChange={(event) => setRemoveGenres(event.target.value)}
                placeholder="Ecchi"
              />
            </FormField>

            <FormField label="Add tags" htmlFor="bulk-add-tags">
              <Input
                id="bulk-add-tags"
                value={addTags}
                onChange={(event) => setAddTags(event.target.value)}
                placeholder="coming-of-age, school"
              />
            </FormField>

            <FormField label="Remove tags" htmlFor="bulk-remove-tags">
              <Input
                id="bulk-remove-tags"
                value={removeTags}
                onChange={(event) => setRemoveTags(event.target.value)}
                placeholder="fan-service"
              />
            </FormField>
          </div>

          {mutation.error ? (
            <div
              role="alert"
              className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
            >
              {mutation.error.message}
            </div>
          ) : null}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={mutation.isPending}
            >
              Cancel
            </Button>

            <Button type="submit" disabled={mutation.isPending}>
              <NotePencilIcon className="size-4" />

              {mutation.isPending ? "Updating…" : "Apply changes"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}


type FormFieldProps = {
  label: string
  htmlFor: string
  children: React.ReactNode
}

function FormField({ label, htmlFor, children }: FormFieldProps) {
  return (
    <div className="grid gap-2">
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
    </div>
  )
}
