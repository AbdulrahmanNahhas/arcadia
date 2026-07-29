import { Link } from "@tanstack/react-router"
import { BooksIcon } from "@phosphor-icons/react"
import { buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { ThemeToggle } from "./theme-toggle"

export function LibraryHeader({ compact = false }: { compact?: boolean }) {
  return (
    <header className="sticky top-2 z-[99] mx-auto w-[95vw] max-w-7xl rounded-2xl border border-border/60 bg-background/80 shadow-sm backdrop-blur-xl">
      <div
        className={cn(
          "flex items-center justify-between gap-4 px-3 sm:px-4",
          compact ? "h-12" : "h-14"
        )}
      >
        <Link
          to="/"
          className="group flex items-center gap-2.5 rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-label="العودة إلى أركاديا"
        >
          <span className="flex size-8 items-center justify-center rounded-lg bg-foreground text-background transition-transform group-hover:-rotate-3">
            <BooksIcon weight="duotone" />
          </span>
          <span className="flex flex-col leading-none">
            <strong className="text-sm font-semibold tracking-tight">
              أركاديا
            </strong>
            {!compact && (
              <span className="mt-1 text-[10px] text-muted-foreground">
                أرشيف القصص الشخصي
              </span>
            )}
          </span>
        </Link>

        <nav className="flex items-center gap-1.5" aria-label="التنقل الرئيسي">
          <Link
            to="/feed"
            className={cn(
              buttonVariants({ variant: "ghost", size: "sm" }),
              "hidden h-9 text-xs sm:inline-flex"
            )}
          >
            النشاط
          </Link>
          <Link
            to="/admin"
            className={cn(
              buttonVariants({ variant: "ghost", size: "sm" }),
              "hidden h-9 text-xs sm:inline-flex"
            )}
          >
            الإدارة
          </Link>
          <ThemeToggle />
        </nav>
      </div>
    </header>
  )
}
