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

import { Artwork } from "../../components/artwork";
import { Choice } from "../../components/choice";
import { gateway } from "../../lib/bridge";
import type { LibraryQuery } from "../../lib/bridge";
import { Hero } from "./hero";
import { Preview } from "./preview";
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
  selected,
  onSelect,
}: {
  work: WorkSummary;
  selected: boolean;
  onSelect: (id: string) => void;
}) {
  return (
    <button
      className="poster-card"
      aria-label={`تفاصيل ${work.titleAr || work.canonicalTitle}`}
      aria-pressed={selected}
      onClick={() => onSelect(work.id)}
    >
      <span className="poster-image">
        <Artwork id={work.poster?.id} alt="" />
        {work.age && <span className="poster-age">{work.age}</span>}
        {work.isPrivate && <span className="poster-private">خاص</span>}
      </span>
      <span className="poster-title" dir="auto">
        {work.titleAr || work.canonicalTitle}
      </span>
      <span className="poster-caption">
        {work.releaseYear ?? ""}
        {work.releaseYear ? " · " : ""}
        {work.format === "animated" ? "رسوم متحركة" : "تمثيل حي"}
      </span>
    </button>
  );
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
    <section className="shelf">
      <header className="section-heading">
        <h2>{title}</h2>
        <button className="text-button" onClick={onBrowse}>
          عرض الكل <ArrowLeft size={16} />
        </button>
      </header>
      {result.error ? (
        <p className="error" role="alert">
          {result.error.message}
          <button className="text-button" onClick={() => void result.refetch()}>
            إعادة المحاولة
          </button>
        </p>
      ) : result.isLoading ? (
        <div className="shelf-loading" role="status">
          جارٍ تحميل الأعمال…
        </div>
      ) : result.data?.items.length ? (
        <div ref={row} className="poster-shelf">
          {result.data.items.slice(0, columns).map((work) => (
            <Poster key={work.id} work={work} selected={selected === work.id} onSelect={onSelect} />
          ))}
        </div>
      ) : (
        <p className="muted">لا توجد أعمال في هذا القسم بعد.</p>
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
    <section className="discover">
      <div className="section-heading">
        <h1>اكتشف المكتبة</h1>
        {result.data && <span className="muted">{result.data.pages[0].total} عمل</span>}
      </div>
      {result.error && (
        <p className="error" role="alert">
          {result.error.message}
          <button className="text-button" onClick={() => void result.refetch()}>
            إعادة المحاولة
          </button>
        </p>
      )}
      {result.isLoading && <p role="status">جارٍ تحميل المكتبة…</p>}
      <div className="poster-grid">
        {result.data?.pages
          .flatMap((page) => page.items)
          .map((work) => (
            <Poster key={work.id} work={work} selected={selected === work.id} onSelect={onSelect} />
          ))}
      </div>
      {result.data?.pages[0].total === 0 && (
        <div className="empty-state">
          <Search />
          <h2>لا توجد أعمال مطابقة</h2>
          <p>جرّب عبارة أخرى أو خفّف المرشحات.</p>
        </div>
      )}
      {result.hasNextPage && (
        <button
          className="load-more"
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
  const client = useQueryClient();
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(search.trim()), 300);
    return () => clearTimeout(timer);
  }, [search]);
  const options = useQuery({
    queryKey: ["catalog", "filters"],
    queryFn: ({ signal }) => gateway.filters(signal),
  });
  const logout = useMutation({
    mutationFn: gateway.logout,
    onSettled: () => {
      client.removeQueries({ predicate: (query) => query.queryKey[0] !== "session" });
      client.setQueryData(["session"], null);
    },
  });
  const close = useCallback(() => setSelected(null), []);
  const choose = useCallback((id: string) => setSelected(id), []);
  const browse = (format?: "animated" | "live-action") => {
    setView("discover");
    setFilters({ sort: "title", format });
  };
  const discovering = view === "discover" || Boolean(search);
  return (
    <div className="client-shell">
      <nav
        className="navigation-rail"
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
          className="rail-brand"
          href="#home"
          aria-label="نحّاسيو الرئيسية"
          onClick={(event) => {
            event.preventDefault();
            setView("home");
            setSelected(null);
            setSearch("");
          }}
        >
          <LibraryIcon />
        </a>
        <button
          className={view === "home" && !search ? "rail-button active" : "rail-button"}
          aria-label="الرئيسية"
          title="الرئيسية"
          onClick={() => {
            setView("home");
            setSelected(null);
            setSearch("");
          }}
        >
          <Home />
        </button>
        <button
          className={discovering ? "rail-button active" : "rail-button"}
          aria-label="اكتشف المكتبة"
          title="اكتشف المكتبة"
          onClick={() => setView("discover")}
        >
          <Compass />
        </button>
        <button
          className={view === "planets" ? "rail-button active" : "rail-button"}
          aria-label="العوالم"
          title="العوالم"
          onClick={() => {
            setView("planets");
            setSearch("");
          }}
        >
          <Orbit />
        </button>
        <button
          className="rail-button"
          aria-label="المحفوظات — قريبًا"
          title="المحفوظات — قريبًا"
          disabled
        >
          <LibraryIcon />
        </button>
        <button
          className="rail-button"
          aria-label="التنزيلات — قريبًا"
          title="التنزيلات — قريبًا"
          disabled
        >
          <Download />
        </button>
        <div className="rail-bottom">
          <button
            className="rail-button"
            aria-label="تسجيل الخروج"
            title="تسجيل الخروج"
            disabled={logout.isPending}
            onClick={() => logout.mutate()}
          >
            <LogOut />
          </button>
        </div>
      </nav>
      <div className="application">
        <header className="topbar">
          <div className="wordmark">
            نحّاسيو <span>مكتبتنا</span>
          </div>
          <label className="search-field">
            <Search size={21} />
            <span className="sr-only">ابحث في المكتبة</span>
            <input
              type="search"
              placeholder="ابحث عن حكايتك التالية…"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
            {search && (
              <button className="icon-button" aria-label="مسح البحث" onClick={() => setSearch("")}>
                <X size={17} />
              </button>
            )}
          </label>
          <span className="user-chip" title={user.name}>
            <span>{user.name.charAt(0)}</span>
            <b>{user.name}</b>
          </span>
        </header>
        <div className={selected ? "library-layout has-preview" : "library-layout"}>
          <main className="library-main" onKeyDown={movePoster}>
            {logout.error && (
              <p className="error" role="alert">
                {logout.error.message}
              </p>
            )}
            {discovering ? (
              <>
                <div className="filter-toolbar">
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
                  <label className="private-toggle">
                    <input
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
                      className="text-button"
                      onClick={() => setFilters({ ...filters, planet: undefined })}
                    >
                      مسح اختيار العالم
                    </button>
                  )}
                  <button
                    className={showFilters ? "filter-button active" : "filter-button"}
                    aria-expanded={showFilters}
                    onClick={() => setShowFilters(!showFilters)}
                  >
                    <SlidersHorizontal size={18} /> مرشحات
                  </button>
                </div>
                {showFilters && (
                  <div className="advanced-filters">
                    <label>
                      التصنيف
                      <select
                        value={filters.genre ?? ""}
                        onChange={(event) =>
                          setFilters({ ...filters, genre: event.target.value || undefined })
                        }
                      >
                        <option value="">كل التصنيفات</option>
                        {options.data?.genres.map((item) => (
                          <option key={item.id} value={item.slug}>
                            {item.labelAr || item.labelEn}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      الجمهور
                      <select
                        value={filters.audience ?? ""}
                        onChange={(event) => {
                          const value = event.target.value;
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
                          });
                        }}
                      >
                        <option value="">كل الأعمار</option>
                        <option value="general">عام</option>
                        <option value="teen">للمراهقين</option>
                        <option value="young-adult">للشباب</option>
                        <option value="adult">للبالغين</option>
                      </select>
                    </label>
                    <label>
                      حالة الإصدار
                      <select
                        value={filters.status ?? ""}
                        onChange={(event) => {
                          const value = event.target.value;
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
                          });
                        }}
                      >
                        <option value="">كل الحالات</option>
                        <option value="announced">معلن</option>
                        <option value="airing">يُعرض حاليًا</option>
                        <option value="completed">مكتمل</option>
                        <option value="unknown">غير معروف</option>
                      </select>
                    </label>
                    <label>
                      من سنة
                      <input
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
                    <button className="text-button" onClick={() => setFilters({ sort: "title" })}>
                      مسح المرشحات
                    </button>
                    {options.error && (
                      <p className="error" role="alert">
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
              <section className="planet-directory">
                <h1>العوالم</h1>
                <div className="planet-grid">
                  {options.data?.planets.map((planet) => (
                    <button
                      key={planet.id}
                      onClick={() => {
                        setView("discover");
                        setFilters({ sort: "title", planet: planet.slug });
                      }}
                    >
                      <span>{planet.icon}</span>
                      <h2>{planet.nameAr}</h2>
                      <small>{planet.count} عمل</small>
                    </button>
                  ))}
                </div>
              </section>
            ) : (
              <>
                <Hero onSelect={choose} />
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
                {options.data?.planets
                  .filter((planet) => planet.count > 0)
                  .map((planet) => (
                    <Shelf
                      key={planet.id}
                      title={`${planet.icon} ${planet.nameAr}`}
                      query={{
                        planet: planet.slug,
                        sort: "updated-desc",
                        pageSize: 10,
                        includePrivate: false,
                      }}
                      selected={selected}
                      onSelect={choose}
                      onBrowse={() => {
                        setView("discover");
                        setFilters({ sort: "title", planet: planet.slug });
                      }}
                    />
                  ))}
              </>
            )}
          </main>
          {selected && <Preview key={selected} id={selected} onClose={close} />}
        </div>
      </div>
    </div>
  );
}
