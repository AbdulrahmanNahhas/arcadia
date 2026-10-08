import type { User, WorkSummary } from "@nahhasio/api-contract";
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  Compass,
  Download,
  Home,
  Library as LibraryIcon,
  LogOut,
  Search,
  Shield,
  SlidersHorizontal,
  Sparkles,
  X,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import { Artwork } from "../../components/artwork";
import { gateway } from "../../lib/bridge";
import type { LibraryQuery } from "../../lib/bridge";
import { Preview } from "./preview";
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
        <div className="poster-shelf">
          {result.data.items.map((work) => (
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
      <nav className="navigation-rail" aria-label="التنقل الرئيسي">
        <a
          className="rail-brand"
          href="#home"
          aria-label="نحّاسيو الرئيسية"
          onClick={(event) => {
            event.preventDefault();
            setView("home");
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
          <main className="library-main">
            {logout.error && (
              <p className="error" role="alert">
                {logout.error.message}
              </p>
            )}
            {discovering ? (
              <>
                <div className="filter-toolbar">
                  <label className="select-field">
                    <span className="sr-only">الصيغة</span>
                    <select
                      aria-label="الصيغة"
                      value={filters.format ?? ""}
                      onChange={(event) =>
                        setFilters({
                          ...filters,
                          format:
                            event.target.value === "animated"
                              ? "animated"
                              : event.target.value === "live-action"
                                ? "live-action"
                                : undefined,
                        })
                      }
                    >
                      <option value="">كل الصيغ</option>
                      {formats.map((item) => (
                        <option key={item.value} value={item.value}>
                          {item.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="select-field">
                    <span className="sr-only">الترتيب</span>
                    <select
                      aria-label="الترتيب"
                      value={filters.sort ?? "title"}
                      onChange={(event) => {
                        const value = event.target.value;
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
                        });
                      }}
                    >
                      <option value="title">الاسم</option>
                      <option value="year-desc">الأحدث إصدارًا</option>
                      <option value="year-asc">الأقدم إصدارًا</option>
                      <option value="updated-desc">آخر تحديث</option>
                    </select>
                  </label>
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
            ) : (
              <>
                <div className="home-intro">
                  <div>
                    <p className="eyebrow">مساحة للحكايات</p>
                    <h1>مكتبة العائلة</h1>
                    <p>اكتشف أعمالنا، واقرأ ما وراء كل حكاية.</p>
                  </div>
                  <span className="curated-mark">
                    <Shield size={19} /> اختيارات مدروسة
                  </span>
                </div>
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
                <Shelf
                  title="عوالم مرسومة"
                  query={{ format: "animated", sort: "year-desc", pageSize: 10 }}
                  selected={selected}
                  onSelect={choose}
                  onBrowse={() => browse("animated")}
                />
                <Shelf
                  title="على الشاشة"
                  query={{ format: "live-action", sort: "year-desc", pageSize: 10 }}
                  selected={selected}
                  onSelect={choose}
                  onBrowse={() => browse("live-action")}
                />
                <div className="library-end">
                  <Sparkles size={17} />
                  <span>كل عمل يحمل تفاصيله. اختر ملصقًا لقراءتها.</span>
                </div>
              </>
            )}
          </main>
          {selected && <Preview key={selected} id={selected} onClose={close} />}
        </div>
      </div>
    </div>
  );
}
