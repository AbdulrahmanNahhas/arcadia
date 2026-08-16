import { createRootRoute, HeadContent, Scripts } from "@tanstack/react-router";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthBoundary } from "@/features/accounts/auth-boundary";
import appCss from "../styles.css?url";

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "نحّاسينما — أركاديا" },
      { name: "description", content: "أرشيف عائلي للأفلام والمسلسلات والأنمي." },
    ],
    links: [{ rel: "stylesheet", href: appCss }],
  }),
  notFoundComponent: () => (
    <main className="mx-auto max-w-3xl p-8 pt-32">
      <h1 className="font-heading text-3xl">هذه المدار غير موجود</h1>
      <p className="mt-3 text-muted-foreground">ارجع إلى الأرشيف واختر مساراً آخر.</p>
    </main>
  ),
  shellComponent: RootDocument,
});

function RootDocument({ children }: { children: React.ReactNode }) {
  const restore = `(function(){try{var r=document.documentElement,t=localStorage.getItem('arcadia:theme')||'dark';r.classList.toggle('dark',t==='dark');r.style.colorScheme=t}catch(e){}})()`;
  return (
    <html lang="ar" dir="rtl" suppressHydrationWarning>
      <head>
        {/* biome-ignore lint/security/noDangerouslySetInnerHtml: static preference restoration before first paint */}
        <script dangerouslySetInnerHTML={{ __html: restore }} />
        <HeadContent />
      </head>
      <body className="dark">
        <TooltipProvider>
          <AuthBoundary>{children}</AuthBoundary>
        </TooltipProvider>
        <Scripts />
      </body>
    </html>
  );
}
