import { createFileRoute } from "@tanstack/react-router"
import { LibraryHome } from "@/features/library/library-home"

export const Route = createFileRoute("/")({ component: LibraryHome })
