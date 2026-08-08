import { createRootRoute, HeadContent, Scripts } from "@tanstack/react-router";
import { TooltipProvider } from "@/components/ui/tooltip";

import appCss from "../styles.css?url";

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
        title: "طبيعاوي شاهد — مكتبتك المحفوظة",
      },
      {
        name: "description",
        content: "قاعدة معرفة خاصة ومحلية لكل قصة تحتفظ بها.",
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
      <p>تعذر العثور على الصفحة المطلوبة.</p>
    </main>
  ),
  shellComponent: RootDocument,
});

function RootDocument({ children }: { children: React.ReactNode }) {
  const restorePreferences = `(function(){try{var r=document.documentElement,t=localStorage.getItem('arcadia:theme');if(t==='dark')r.classList.add('dark');r.style.colorScheme=t==='dark'?'dark':'light'}catch(e){}})()`;
  return (
    <html lang="ar" dir="rtl" suppressHydrationWarning>
      <head>
        {/* biome-ignore lint/security/noDangerouslySetInnerHtml: Static inline code restores local preferences before first paint. */}
        <script dangerouslySetInnerHTML={{ __html: restorePreferences }} />
        <HeadContent />
      </head>
      <body className="dark">
        <TooltipProvider>{children}</TooltipProvider>
        <Scripts />
      </body>
    </html>
  );
}
