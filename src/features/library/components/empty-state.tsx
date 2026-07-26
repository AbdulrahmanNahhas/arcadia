import { MagnifyingGlassIcon, XIcon } from "@phosphor-icons/react"
import { Button } from "@/components/ui/button"

export function EmptyState({ clear }: { clear: () => void }) {
  return (
    <div className="mx-auto flex min-h-[52vh] max-w-md flex-col items-center justify-center px-6 text-center">
      <div className="mb-5 flex size-14 items-center justify-center rounded-2xl border bg-muted/40 text-muted-foreground shadow-sm">
        <MagnifyingGlassIcon className="size-6" weight="duotone" />
      </div>
      <h2 className="text-base font-semibold tracking-tight">
        لم نعثر على أعمال
      </h2>
      <p className="mt-1.5 text-sm leading-6 text-muted-foreground">
        لا توجد نتائج تطابق البحث والفلاتر الحالية. امسح الفلاتر للعودة إلى
        مكتبتك كاملة.
      </p>
      <Button variant="outline" size="sm" className="mt-5" onClick={clear}>
        <XIcon className="size-3.5" />
        مسح الفلاتر
      </Button>
    </div>
  )
}
