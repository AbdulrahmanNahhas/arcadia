import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { currentAccountQueryOptions } from "@/features/accounts/api";
import {
  FocusContext,
  revealSpatialTarget,
  useSpatialFocusable,
} from "@/features/platform/spatial-navigation";
import { apiBaseUrl, setApiUrlOverride } from "@/lib/api";
import { setAppMode } from "@/lib/app-mode";
import { signOut as clearSession } from "@/lib/auth-client";
import { setTheme, type ThemePreference, useTheme } from "@/lib/theme";
import { cn } from "@/lib/utils";
import { DisplayShell } from "./display-shell";

const themes: Array<[ThemePreference, string]> = [
  ["dark", "داكن"],
  ["light", "فاتح"],
  ["system", "حسب النظام"],
];

/**
 * Display Settings: the four things a living-room box needs — who is signed in, the theme, the
 * server address, and the way out of Display Mode. Everything else lives in the desk settings.
 */
export function DisplaySettings() {
  const account = useQuery(currentAccountQueryOptions());
  const theme = useTheme();
  const [server, setServer] = useState(apiBaseUrl);
  const [serverError, setServerError] = useState<string | null>(null);

  const applyServer = async () => {
    try {
      setServerError(null);
      await setApiUrlOverride(server.trim() || null);
    } catch {
      setServerError("العنوان غير صالح — مثال: http://192.168.1.10:23101");
    }
  };

  return (
    <DisplayShell>
      <FocusContext.Provider value="display-settings">
        <div className="mx-auto flex max-w-4xl flex-col gap-10 px-[5vw] pb-24">
          <h1 className="font-heading text-4xl font-bold">الإعدادات</h1>

          <Section title="الحساب">
            <p className="text-xl">{account.data?.account.displayName ?? "…"}</p>
            <div className="flex flex-wrap gap-3">
              <Action label="تبديل الحساب" onPress={() => window.location.assign("/profiles")} />
              <Action
                label="تسجيل الخروج"
                onPress={async () => {
                  await clearSession();
                  window.location.assign("/login");
                }}
              />
            </div>
          </Section>

          <Section title="المظهر">
            <div className="flex flex-wrap gap-3">
              {themes.map(([value, label]) => (
                <Action
                  key={value}
                  label={label}
                  active={theme.preference === value}
                  onPress={() => setTheme(value)}
                />
              ))}
            </div>
          </Section>

          <Section title="خادم العائلة">
            <input
              dir="ltr"
              value={server}
              onChange={(event) => setServer(event.target.value)}
              className="w-full rounded-xl border border-white/15 bg-white/5 px-4 py-3 font-mono text-lg outline-none focus:border-white/50"
              aria-label="عنوان الخادم"
            />
            {serverError && <p className="text-base text-red-300">{serverError}</p>}
            <div className="flex flex-wrap gap-3">
              <Action label="حفظ وإعادة التحميل" onPress={applyServer} />
            </div>
          </Section>

          <Section title="وضع العرض">
            <p className="text-lg text-white/70">
              هذا الجهاز في وضع العرض (التلفاز). للعودة إلى الواجهة الكاملة بلوحة الإدارة وكل
              الأدوات:
            </p>
            <div className="flex flex-wrap gap-3">
              <Action label="الخروج من وضع العرض" onPress={() => setAppMode("normal")} />
            </div>
            <p className="text-base text-white/50" dir="auto">
              اختصار: Ctrl+Shift+T من أي صفحة.
            </p>
          </Section>
        </div>
      </FocusContext.Provider>
    </DisplayShell>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-4 rounded-3xl border border-white/10 bg-white/5 p-7">
      <h2 className="font-heading text-2xl font-semibold">{title}</h2>
      {children}
    </section>
  );
}

function Action({
  label,
  active,
  onPress,
}: {
  label: string;
  active?: boolean;
  onPress: () => void | Promise<void>;
}) {
  const { ref, focused } = useSpatialFocusable<object, HTMLButtonElement>({
    onEnterPress: () => void onPress(),
    onFocus: ({ node }) => revealSpatialTarget(node),
  });
  return (
    <button
      ref={ref}
      type="button"
      data-display-chrome
      data-focused={focused || undefined}
      aria-pressed={active}
      onClick={() => void onPress()}
      className={cn(
        "rounded-full px-6 py-3 text-lg font-medium outline-none",
        active ? "bg-white/20 text-white" : "bg-white/5 text-white/80",
      )}
    >
      {label}
    </button>
  );
}
