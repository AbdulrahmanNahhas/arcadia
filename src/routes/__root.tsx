import { HeadContent, Scripts, createRootRoute } from "@tanstack/react-router"
import { TooltipProvider } from "@/components/ui/tooltip"

import appCss from "../styles.css?url"

export const Route = createRootRoute({
  head: () => ({
    meta: [
      {
        charSet: "utf-8",
      },
      {
        name: "viewport",
        content: "width=device-width, initial-scale=1",
      },
      {
        title: "Arcadia — your media, remembered",
      },
      {
        name: "description",
        content:
          "A private, local-first knowledge base for every story you keep.",
      },
    ],
    links: [
      {
        rel: "stylesheet",
        href: appCss,
      },
    ],
  }),
  notFoundComponent: () => (
    <main className="container mx-auto p-4 pt-16">
      <h1>404</h1>
      <p>The requested page could not be found.</p>
    </main>
  ),
  shellComponent: RootDocument,
})

function RootDocument({ children }: { children: React.ReactNode }) {
  const restorePreferences = `(function(){try{var r=document.documentElement,t=localStorage.getItem('arcadia:theme');if(t==='dark')r.classList.add('dark');r.dataset.sidebarOpen=localStorage.getItem('arcadia:sidebar-open')==='false'?'false':'true';r.dataset.focusMode=localStorage.getItem('arcadia:focus-mode')==='true'?'true':'false';r.style.colorScheme=t==='dark'?'dark':'light'}catch(e){}})()`
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: restorePreferences }} />
        <HeadContent />
      </head>
      <body>
        <TooltipProvider>{children}</TooltipProvider>
        <Scripts />
      </body>
    </html>
  )
}
