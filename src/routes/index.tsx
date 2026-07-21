import { createFileRoute } from "@tanstack/react-router"
import { LibraryApp } from "@/features/library/library-app"

export const Route = createFileRoute("/")({ component: App })

function App() {
  return <LibraryApp />
}
