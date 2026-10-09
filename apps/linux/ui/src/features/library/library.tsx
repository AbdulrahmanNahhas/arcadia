import type { User, WorkSummary } from "@nahhasio/api-contract";
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  Compass,
  Download,
  Home,
  Orbit,
  Library as LibraryIcon,
  LogOut,
  Search,
  SlidersHorizontal,
  X,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import type { KeyboardEvent } from "react";

import { Choice } from "../../components/choice";
import { MediaCard } from "../../components/media-card";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "../../components/ui/input-group";
import { gateway } from "../../lib/bridge";
import type { LibraryQuery } from "../../lib/bridge";
import { Hero } from "./hero";
import { HomeFeed } from "./home-feed";
import { WorkPage } from "./work-page";
function movePoster(event: KeyboardEvent<HTMLElement>) {
  if (
    !["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key) ||
    !(event.target instanceof Element)
  )
    return;
  const current = event.target.closest<HTMLButtonElement>(".poster-card");
  if (!current) return;
  const box = current.getBoundingClientRect();
  const horizontal = event.key === "ArrowLeft" || event.key === "ArrowRight";
  const sign = event.key === "ArrowLeft" || event.key === "ArrowUp" ? -1 : 1;
  const candidates = Array.from(
    event.currentTarget.querySelectorAll<HTMLButtonElement>(".poster-card"),
  )
    .filter((card) => card !== current)
    .map((card) => {
      const rect = card.getBoundingClientRect();
      const dx = rect.x + rect.width / 2 - box.x - box.width / 2;
      const dy = rect.y + rect.height / 2 - box.y - box.height / 2;
      return { card, along: horizontal ? dx : dy, cross: horizontal ? dy : dx };
    })
    .filter(
      (candidate) =>
        candidate.along * sign > 5 && (!horizontal || Math.abs(candidate.cross) < box.height / 2),
    )
    .toSorted(
      (a, b) =>
        Math.abs(a.along) + Math.abs(a.cross) * 4 - Math.abs(b.along) - Math.abs(b.cross) * 4,
    );
  if (!candidates[0] && event.key === "ArrowRight") {
    event.preventDefault();
    event.currentTarget
      .closest(".client-shell")
      ?.querySelector<HTMLButtonElement>(".navigation-rail button.active")
      ?.focus();
  }
  if (candidates[0]) {
    event.preventDefault();
    candidates[0].card.focus({ preventScroll: true });
    candidates[0].card.scrollIntoView({
      block: "nearest",
      inline: "nearest",
      behavior: window.matchMedia("(prefers-reduced-motion:reduce)").matches ? "auto" : "smooth",
    });
  }
}
const formats = [
  { value: "animated", label: "رسوم متحركة" },
  { value: "live-action", label: "تمثيل حي" },
];
function Poster({
  work,
  onSelect,
}: {
  work: WorkSummary;
  selected: boolean;
  onSelect: (id: string) => void;
}) {
  return <MediaCard work={work} onSelect={onSelect} />;
}
function Shelf({
  title,
  query,
  selected,
  onSelect,
  onBrowse,
}: {
  title: string;
  query: LibraryQuery;
  selected: string | null;
  onSelect: (id: string) => void;
  onBrowse: () => void;
}) {
  const result = useQuery({
    queryKey: ["works", "shelf", query],
    queryFn: ({ signal }) => gateway.works(query, signal),
  });
  const row = useRef<HTMLDivElement>(null);
  const [columns, setColumns] = useState(6);
  useEffect(() => {
    if (!result.data) return;
    const observer = new ResizeObserver(([entry]) =>
      setColumns(Math.max(2, Math.floor((entry.contentRect.width + 18) / 156))),
    );
    if (row.current) {
      observer.observe(row.current);
      if (document.activeElement === document.body)
        row.current
          .querySelector<HTMLButtonElement>(".poster-card")
          ?.focus({ preventScroll: true });
    }
    return () => observer.disconnect();
  }, [result.data]);
  return (
    <section className="mb-10">
      <header className="mb-5 flex items-center justify-between gap-4">
        <h2 className="text-xl font-semibold">{title}</h2>
        <button
          className="inline-flex items-center gap-2 py-2 text-xs text-muted-foreground transition-colors hover:text-foreground"
          onClick={onBrowse}
        >
          عرض الكل <ArrowLeft size={16} />
        </button>
      </header>
      {result.error ? (
        <p
          className="rounded-xl bg-destructive/10 p-3.5 text-sm leading-relaxed text-destructive"
          role="alert"
        >
          {result.error.message}
          <button
            className="inline-flex items-center gap-2 py-2 text-xs text-muted-foreground hover:text-foreground"
            onClick={() => void result.refetch()}
          >
            إعادة المحاولة
          </button>
        </p>
      ) : result.isLoading ? (
        <div className="grid h-[270px] place-items-center text-muted-foreground" role="status">
          جارٍ تحميل الأعمال…
        </div>
      ) : result.data?.items.length ? (
        <div
          ref={row}
          className="grid grid-cols-[repeat(auto-fit,minmax(110px,1fr))] gap-[18px] overflow-visible px-0 pt-1 pb-3 min-[1700px]:grid-cols-[repeat(auto-fit,minmax(140px,1fr))]"
        >
          {result.data.items.slice(0, columns).map((work) => (
            <Poster key={work.id} work={work} selected={selected === work.id} onSelect={onSelect} />
          ))}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">لا توجد أعمال في هذا القسم بعد.</p>
      )}
    </section>
  );
}
function Discover({
  query,
  selected,
  onSelect,
}: {
  query: LibraryQuery;
  selected: string | null;
  onSelect: (id: string) => void;
}) {
  const result = useInfiniteQuery({
    queryKey: ["works", "discover", query],
    initialPageParam: 1,
    queryFn: ({ pageParam, signal }) =>
      gateway.works({ ...query, page: pageParam, pageSize: 24 }, signal),
    getNextPageParam: (page) =>
      page.page * page.pageSize < page.total ? page.page + 1 : undefined,
  });
  return (
    <section>
      <div className="mb-5 flex items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold">اكتشف المكتبة</h1>
        {result.data && (
          <span className="text-sm text-muted-foreground">{result.data.pages[0].total} عمل</span>
        )}
      </div>
      {result.error && (
        <p
          className="rounded-xl bg-destructive/10 p-3.5 text-sm leading-relaxed text-destructive"
          role="alert"
        >
          {result.error.message}
          <button
            className="inline-flex items-center gap-2 py-2 text-xs text-muted-foreground hover:text-foreground"
            onClick={() => void result.refetch()}
          >
            إعادة المحاولة
          </button>
        </p>
      )}
      {result.isLoading && (
        <p className="text-muted-foreground" role="status">
          جارٍ تحميل المكتبة…
        </p>
      )}
      <div className="grid grid-cols-[repeat(auto-fill,minmax(120px,1fr))] gap-x-[15px] gap-y-[22px] p-1 sm:grid-cols-[repeat(auto-fill,minmax(135px,1fr))] sm:gap-x-[18px] sm:gap-y-6 min-[1100px]:grid-cols-[repeat(auto-fill,minmax(150px,1fr))] min-[1700px]:grid-cols-[repeat(auto-fill,minmax(175px,1fr))]">
        {result.data?.pages
          .flatMap((page) => page.items)
          .map((work) => (
            <Poster key={work.id} work={work} selected={selected === work.id} onSelect={onSelect} />
          ))}
      </div>
      {result.data?.pages[0].total === 0 && (
        <div className="flex flex-col items-center gap-3 px-5 py-20 text-center text-muted-foreground">
          <Search />
          <h2 className="text-xl text-foreground">لا توجد أعمال مطابقة</h2>
          <p>جرّب عبارة أخرى أو خفّف المرشحات.</p>
        </div>
      )}
      {result.hasNextPage && (
        <button
          className="mx-auto mt-9 mb-2.5 block rounded-full bg-secondary px-6 py-3 text-foreground disabled:opacity-50"
          disabled={result.isFetchingNextPage}
          onClick={() => void result.fetchNextPage()}
        >
          {result.isFetchingNextPage ? "جارٍ التحميل…" : "تحميل المزيد"}
        </button>
      )}
    </section>
  );
}
export function Library({ user }: { user: User }) {
  const [view, setView] = useState("home");
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [filters, setFilters] = useState<LibraryQuery>({ sort: "title" });
  const [showFilters, setShowFilters] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [installment, setInstallment] = useState<string | undefined>();
  const [homePlanet, setHomePlanet] = useState("");
  const main = useRef<HTMLElement>(null);
  const returnTo = useRef<{ scroll: number; focus: HTMLElement | null }>({
    scroll: 0,
    focus: null,
  });
  const client = useQueryClient();
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(search.trim()), 300);
    return () => clearTimeout(timer);
  }, [search]);
  const options = useQuery({
    queryKey: ["catalog", "filters"],
    queryFn: ({ signal }) => gateway.filters(signal),
  });
  const currentPlanet =
    options.data?.planets.find((planet) => planet.slug === homePlanet) ??
    options.data?.planets.find((planet) => planet.count > 0) ??
    options.data?.planets[0];
  const logout = useMutation({
    mutationFn: gateway.logout,
    onSettled: () => {
      client.removeQueries({ predicate: (query) => query.queryKey[0] !== "session" });
      client.setQueryData(["session"], null);
    },
  });
  const close = useCallback(() => {
    setSelected(null);
    setInstallment(undefined);
    requestAnimationFrame(() => {
      if (main.current) main.current.scrollTop = returnTo.current.scroll;
      returnTo.current.focus?.focus({ preventScroll: true });
    });
  }, []);
  const choose = useCallback((id: string, installmentId?: string) => {
    returnTo.current = {
      scroll: main.current?.scrollTop ?? 0,
      focus: document.activeElement instanceof HTMLElement ? document.activeElement : null,
    };
    setInstallment(installmentId);
    setSelected(id);
    requestAnimationFrame(() => {
      if (main.current) main.current.scrollTop = 0;
    });
  }, []);
  const browse = (format?: "animated" | "live-action") => {
    setView("discover");
    setFilters({ sort: "title", format });
  };
  const discovering = view === "discover" || Boolean(search);
  return (
    <div className="flex h-dvh w-full overflow-hidden">
      <nav
        className="flex w-14 shrink-0 flex-col items-center gap-[17px] bg-[var(--rail)] px-[5px] py-[18px] sm:w-16 sm:gap-[19px] sm:px-[9px] sm:py-6 lg:w-[76px] lg:gap-[21px] lg:px-3 lg:py-6"
        aria-label="التنقل الرئيسي"
        onKeyDown={(event) => {
          if (event.key === "ArrowLeft") {
            event.preventDefault();
            event.currentTarget
              .closest(".client-shell")
              ?.querySelector<HTMLButtonElement>(".library-main .poster-card")
              ?.focus();
          } else if (event.key === "ArrowDown" || event.key === "ArrowUp") {
            event.preventDefault();
            const controls = Array.from(
              event.currentTarget.querySelectorAll<HTMLButtonElement>("button:not(:disabled)"),
            );
            const index = controls.findIndex((button) => button === document.activeElement);
            controls[
              (index + (event.key === "ArrowDown" ? 1 : controls.length - 1)) % controls.length
            ]?.focus();
          }
        }}
      >
        <a
          className="mb-2.5 grid size-10 shrink-0 place-items-center text-primary sm:mb-[18px] sm:size-12"
          href="#home"
          aria-label="نحّاسيو الرئيسية"
          onClick={(event) => {
            event.preventDefault();
            setView("home");
            setSelected(null);
            setSearch("");
          }}
        >
          <LibraryIcon className="size-[27px] sm:size-[31px]" />
        </a>
        <button
          className={`grid size-10 shrink-0 place-items-center rounded-[14px] text-muted-foreground transition-colors sm:size-[46px] ${view === "home" && !search ? "bg-primary/10 text-primary" : "hover:bg-white/5 hover:text-foreground"}`}
          aria-label="الرئيسية"
          title="الرئيسية"
          onClick={() => {
            setView("home");
            setSelected(null);
            setSearch("");
          }}
        >
          <Home className="size-[21px] sm:size-[23px]" />
        </button>
        <button
          className={`grid size-10 shrink-0 place-items-center rounded-[14px] text-muted-foreground transition-colors sm:size-[46px] ${discovering ? "bg-primary/10 text-primary" : "hover:bg-white/5 hover:text-foreground"}`}
          aria-label="اكتشف المكتبة"
          title="اكتشف المكتبة"
          onClick={() => {
            setView("discover");
            setSelected(null);
            setFilters((previous) => ({ ...previous, planet: undefined }));
          }}
        >
          <Compass className="size-[21px] sm:size-[23px]" />
        </button>
        <button
          className={`grid size-10 shrink-0 place-items-center rounded-[14px] text-muted-foreground transition-colors sm:size-[46px] ${view === "planets" ? "bg-primary/10 text-primary" : "hover:bg-white/5 hover:text-foreground"}`}
          aria-label="العوالم"
          title="العوالم"
          onClick={() => {
            setView("planets");
            setSelected(null);
            setSearch("");
          }}
        >
          <Orbit className="size-[21px] sm:size-[23px]" />
        </button>
        <button
          className="grid size-10 shrink-0 place-items-center rounded-[14px] text-muted-foreground opacity-40 sm:size-[46px]"
          aria-label="المحفوظات — قريبًا"
          title="المحفوظات — قريبًا"
          disabled
        >
          <LibraryIcon className="size-[21px] sm:size-[23px]" />
        </button>
        <button
          className="grid size-10 shrink-0 place-items-center rounded-[14px] text-muted-foreground opacity-40 sm:size-[46px]"
          aria-label="التنزيلات — قريبًا"
          title="التنزيلات — قريبًا"
          disabled
        >
          <Download className="size-[21px] sm:size-[23px]" />
        </button>
        <div className="mt-auto">
          <button
            className="grid size-10 shrink-0 place-items-center rounded-[14px] text-muted-foreground transition-colors hover:bg-white/5 hover:text-foreground sm:size-[46px]"
            aria-label="تسجيل الخروج"
            title="تسجيل الخروج"
            disabled={logout.isPending}
            onClick={() => logout.mutate()}
          >
            <LogOut className="size-[21px] sm:size-[23px]" />
          </button>
        </div>
      </nav>
      <div className="relative flex min-w-0 flex-1 flex-col">
        <header
          className={`z-10 flex min-h-[50px] shrink-0 items-center gap-2.5 bg-background px-3.5 py-3 sm:gap-[18px] sm:px-5 sm:py-4 lg:gap-6 lg:px-[38px] ${!selected && !discovering && view === "home" ? "absolute inset-x-0 top-0 min-h-[88px] items-start bg-gradient-to-b from-background via-background/80 to-transparent pt-6" : ""}`}
        >
          <div className="min-w-[70px] text-xl font-semibold leading-snug max-[640px]:hidden lg:min-w-[125px] lg:text-[21px]">
            نحّاسيو{" "}
            <span className="block text-[11px] font-normal text-muted-foreground">مكتبتنا</span>
          </div>
          <div className="flex min-w-0 flex-1 justify-center">
            <InputGroup className="h-11 min-w-0 max-w-xl flex-1">
              <InputGroupAddon>
                <Search data-icon="inline-start" />
              </InputGroupAddon>
              <InputGroupInput
                className="h-full"
                type="search"
                aria-label="ابحث في المكتبة"
                placeholder="ابحث عن حكايتك التالية…"
                value={search}
                onChange={(event) => {
                  setSelected(null);
                  setSearch(event.target.value);
                }}
              />
              {search && (
                <InputGroupAddon align="inline-end">
                  <InputGroupButton
                    size="icon-xs"
                    aria-label="مسح البحث"
                    onClick={() => setSearch("")}
                  >
                    <X data-icon="inline-start" />
                  </InputGroupButton>
                </InputGroupAddon>
              )}
            </InputGroup>
          </div>
          <span
            className="flex max-w-[180px] items-center gap-2.5 text-[13px] max-[640px]:hidden"
            title={user.name}
          >
            <span className="grid size-[34px] shrink-0 place-items-center rounded-full bg-accent text-accent-foreground">
              {user.name.charAt(0)}
            </span>
            <b className="truncate font-normal max-[1100px]:hidden">{user.name}</b>
          </span>
        </header>
        <div className="relative flex min-h-0 flex-1 overflow-hidden">
          <main
            ref={main}
            className="min-w-0 flex-1 overflow-auto overscroll-contain px-[15px] pt-4 pb-[30px] [scrollbar-color:var(--line)_transparent] [scrollbar-width:thin] [scroll-behavior:smooth] sm:px-5 sm:pt-5 lg:px-[38px] lg:pt-5 lg:pb-11 min-[1700px]:px-[52px] motion-reduce:[scroll-behavior:auto]"
            onKeyDown={movePoster}
          >
            {logout.error && (
              <p
                className="rounded-xl bg-destructive/10 p-3.5 text-sm leading-relaxed text-destructive"
                role="alert"
              >
                {logout.error.message}
              </p>
            )}
            <div hidden={Boolean(selected)}>
              {discovering ? (
                <>
                  <div className="mb-6 flex flex-wrap gap-2.5 sm:gap-3.5">
                    <Choice
                      label="الصيغة"
                      value={filters.format ?? ""}
                      options={[{ value: "", label: "كل الصيغ" }, ...formats]}
                      onChange={(value) =>
                        setFilters({
                          ...filters,
                          format:
                            value === "animated"
                              ? "animated"
                              : value === "live-action"
                                ? "live-action"
                                : undefined,
                        })
                      }
                    />
                    <Choice
                      label="الترتيب"
                      value={filters.sort ?? "title"}
                      options={[
                        { value: "title", label: "الاسم" },
                        { value: "year-desc", label: "الأحدث إصدارًا" },
                        { value: "year-asc", label: "الأقدم إصدارًا" },
                        { value: "updated-desc", label: "آخر تحديث" },
                      ]}
                      onChange={(value) =>
                        setFilters({
                          ...filters,
                          sort:
                            value === "year-desc"
                              ? "year-desc"
                              : value === "year-asc"
                                ? "year-asc"
                                : value === "updated-desc"
                                  ? "updated-desc"
                                  : "title",
                        })
                      }
                    />
                    <label className="flex items-center gap-2 text-xs text-muted-foreground">
                      <input
                        className="size-4 accent-primary"
                        type="checkbox"
                        checked={filters.includePrivate ?? false}
                        onChange={(event) => {
                          setSelected(null);
                          setFilters({ ...filters, includePrivate: event.target.checked });
                        }}
                      />
                      إظهار الأعمال الخاصة
                    </label>
                    {filters.planet && (
                      <button
                        className="inline-flex items-center gap-2 py-2 text-xs text-muted-foreground hover:text-foreground"
                        onClick={() => setFilters({ ...filters, planet: undefined })}
                      >
                        مسح اختيار العالم
                      </button>
                    )}
                    <button
                      className={`flex items-center gap-2 rounded-full bg-secondary px-4 py-2.5 text-xs text-muted-foreground ${showFilters ? "text-primary" : ""}`}
                      aria-expanded={showFilters}
                      onClick={() => setShowFilters(!showFilters)}
                    >
                      <SlidersHorizontal size={18} /> مرشحات
                    </button>
                  </div>
                  {showFilters && (
                    <div className="mb-7 grid grid-cols-1 gap-4 rounded-xl bg-card p-4 sm:grid-cols-2 lg:grid-cols-3 lg:p-[22px]">
                      <Choice
                        label="التصنيف"
                        value={filters.genre ?? ""}
                        options={[
                          { value: "", label: "كل التصنيفات" },
                          ...(options.data?.genres.map((item) => ({
                            value: item.slug,
                            label: item.labelAr || item.labelEn,
                          })) ?? []),
                        ]}
                        onChange={(value) => setFilters({ ...filters, genre: value || undefined })}
                      />
                      <Choice
                        label="الجمهور"
                        value={filters.audience ?? ""}
                        options={[
                          { value: "", label: "كل الأعمار" },
                          { value: "general", label: "عام" },
                          { value: "teen", label: "للمراهقين" },
                          { value: "young-adult", label: "للشباب" },
                          { value: "adult", label: "للبالغين" },
                        ]}
                        onChange={(value) =>
                          setFilters({
                            ...filters,
                            audience:
                              value === "general"
                                ? "general"
                                : value === "teen"
                                  ? "teen"
                                  : value === "young-adult"
                                    ? "young-adult"
                                    : value === "adult"
                                      ? "adult"
                                      : undefined,
                          })
                        }
                      />
                      <Choice
                        label="حالة الإصدار"
                        value={filters.status ?? ""}
                        options={[
                          { value: "", label: "كل الحالات" },
                          { value: "announced", label: "معلن" },
                          { value: "airing", label: "يُعرض حاليًا" },
                          { value: "completed", label: "مكتمل" },
                          { value: "unknown", label: "غير معروف" },
                        ]}
                        onChange={(value) =>
                          setFilters({
                            ...filters,
                            status:
                              value === "announced"
                                ? "announced"
                                : value === "airing"
                                  ? "airing"
                                  : value === "completed"
                                    ? "completed"
                                    : value === "unknown"
                                      ? "unknown"
                                      : undefined,
                          })
                        }
                      />
                      <label>
                        من سنة
                        <input
                          className="h-10 w-full rounded-lg border border-input bg-secondary px-3 text-foreground"
                          type="number"
                          min="1800"
                          max="2200"
                          value={filters.yearFrom ?? ""}
                          onChange={(event) =>
                            setFilters({
                              ...filters,
                              yearFrom: event.target.value ? Number(event.target.value) : undefined,
                            })
                          }
                        />
                      </label>
                      <label>
                        إلى سنة
                        <input
                          className="h-10 w-full rounded-lg border border-input bg-secondary px-3 text-foreground"
                          type="number"
                          min="1800"
                          max="2200"
                          value={filters.yearTo ?? ""}
                          onChange={(event) =>
                            setFilters({
                              ...filters,
                              yearTo: event.target.value ? Number(event.target.value) : undefined,
                            })
                          }
                        />
                      </label>
                      <button
                        className="inline-flex items-center gap-2 py-2 text-xs text-muted-foreground hover:text-foreground"
                        onClick={() => setFilters({ sort: "title" })}
                      >
                        مسح المرشحات
                      </button>
                      {options.error && (
                        <p
                          className="rounded-xl bg-destructive/10 p-3.5 text-sm leading-relaxed text-destructive"
                          role="alert"
                        >
                          {options.error.message}
                        </p>
                      )}
                    </div>
                  )}
                  <Discover
                    query={{ ...filters, q: debounced || undefined }}
                    selected={selected}
                    onSelect={choose}
                  />
                </>
              ) : view === "planets" ? (
                <section>
                  <h1 className="text-3xl font-semibold">العوالم</h1>
                  <div className="mt-6 grid grid-cols-[repeat(auto-fit,minmax(240px,1fr))] gap-[18px]">
                    {options.data?.planets.map((planet) => (
                      <button
                        key={planet.id}
                        className="rounded-[14px] bg-card p-6 text-start transition-colors hover:bg-accent"
                        onClick={() => {
                          setView("discover");
                          setFilters({ sort: "title", planet: planet.slug });
                        }}
                      >
                        <span className="mb-3 block text-4xl">{planet.icon}</span>
                        <h2 className="mb-2 text-lg font-semibold">{planet.nameAr}</h2>
                        <small className="text-muted-foreground">{planet.count} عمل</small>
                      </button>
                    ))}
                  </div>
                </section>
              ) : (
                <>
                  <Hero onSelect={choose} active={!selected} />
                  <Shelf
                    title="آخر تحديثات المكتبة"
                    query={{ sort: "updated-desc", pageSize: 10 }}
                    selected={selected}
                    onSelect={choose}
                    onBrowse={() => {
                      browse();
                      setFilters({ sort: "updated-desc" });
                    }}
                  />
                  <section aria-label="أعمال العوالم">
                    <header className="mb-[22px] flex flex-wrap items-center gap-5">
                      <h2 className="text-xl font-semibold">من عوالمنا</h2>
                      <Choice
                        label="اختر العالم"
                        value={currentPlanet?.slug ?? ""}
                        options={
                          options.data?.planets.map((planet) => ({
                            value: planet.slug,
                            label: `${planet.icon} ${planet.nameAr}`,
                          })) ?? []
                        }
                        onChange={setHomePlanet}
                      />
                    </header>
                    {currentPlanet && (
                      <Shelf
                        title={currentPlanet.nameAr}
                        query={{
                          planet: currentPlanet.slug,
                          sort: "updated-desc",
                          pageSize: 10,
                          includePrivate: false,
                        }}
                        selected={selected}
                        onSelect={choose}
                        onBrowse={() => {
                          setView("discover");
                          setFilters({ sort: "title", planet: currentPlanet.slug });
                        }}
                      />
                    )}
                  </section>
                  <HomeFeed onSelect={choose} />
                </>
              )}
            </div>
            {selected && (
              <WorkPage
                key={`${selected}-${installment ?? ""}`}
                id={selected}
                installmentId={installment}
                onBack={close}
              />
            )}
          </main>
        </div>
      </div>
    </div>
  );
}
