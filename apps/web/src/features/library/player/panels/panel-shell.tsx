import { CheckIcon, XIcon } from "@phosphor-icons/react";
import { type KeyboardEvent as ReactKeyboardEvent, type ReactNode, useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

/**
 * The one modal surface every player menu uses: a centred card from `sm` up, a bottom sheet on a
 * phone, opaque because the X11 surface cannot blend (see `use-overlay-regions.ts`).
 *
 * Owns its own D-pad model so every panel behaves identically: Up/Down walk `data-panel-item`s,
 * Left/Right switch `data-panel-tab`s or walk a `data-panel-row`, Enter activates, Back/Escape
 * closes. Keys are stopped here so the page's own shortcuts never fire underneath an open panel.
 */
export function PanelShell({
  title,
  icon,
  tabs,
  onClose,
  children,
  wide = false,
}: {
  title: string;
  icon: ReactNode;
  tabs?: ReactNode;
  onClose: () => void;
  children: ReactNode;
  wide?: boolean;
}) {
  const card = useRef<HTMLDivElement>(null);

  // Land focus on the selected row (or the first), and hand it back to whatever opened the panel.
  useEffect(() => {
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const items = panelItems(card.current);
    (items.find((item) => item.dataset.selected === "true") ?? items[0] ?? card.current)?.focus();
    return () => previous?.focus();
  }, []);

  const onKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    const root = card.current;
    if (!root) return;
    event.stopPropagation();
    const active = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    switch (event.key) {
      case "Escape":
      case "Backspace":
      case "BrowserBack":
      case "GoBack":
        if (event.key === "Backspace" && isTextEntry(active)) return;
        event.preventDefault();
        onClose();
        return;
      case "Enter":
        // The spatial-navigation engine cancels Enter's native activation window-wide, so the
        // click is issued here rather than left to the button.
        event.preventDefault();
        active?.click();
        return;
      case "ArrowDown":
      case "ArrowUp":
        event.preventDefault();
        moveVertically(root, active, event.key === "ArrowDown" ? 1 : -1);
        return;
      case "ArrowLeft":
      case "ArrowRight":
        event.preventDefault();
        moveHorizontally(root, active, event.key === "ArrowRight" ? 1 : -1);
        return;
      default:
        return;
    }
  };

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center sm:items-center sm:p-6">
      {/* Click-catcher: closes on a tap outside. Not an overlay region, so the picture stays. */}
      <button
        type="button"
        tabIndex={-1}
        aria-label="إغلاق"
        onClick={onClose}
        className="absolute inset-0 cursor-default"
      />
      <div
        ref={card}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        data-video-overlay
        onKeyDown={onKeyDown}
        className={cn(
          "relative flex max-h-[85vh] w-full flex-col overflow-hidden rounded-t-3xl bg-neutral-900 text-white outline-none ring-1 ring-white/10 sm:rounded-3xl",
          wide ? "sm:max-w-2xl" : "sm:max-w-md",
        )}
      >
        <header className="flex items-center gap-3 px-5 pt-4 pb-3">
          <span className="grid size-9 place-items-center rounded-xl bg-white/8 text-white">
            {icon}
          </span>
          <h2 className="flex-1 font-heading text-base font-semibold">{title}</h2>
          <button
            type="button"
            aria-label="إغلاق"
            onClick={onClose}
            className="grid size-9 place-items-center rounded-full text-white/70 outline-none hover:bg-white/10 hover:text-white focus-visible:ring-2 focus-visible:ring-white"
          >
            <XIcon size={18} />
          </button>
        </header>
        {tabs && <div className="px-5 pb-3">{tabs}</div>}
        <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-3">{children}</div>
      </div>
    </div>
  );
}

/** A segmented control; `Left`/`Right` in the shell move between these and activate on landing. */
export function PanelTabs<TKey extends string>({
  value,
  onChange,
  options,
}: {
  value: TKey;
  onChange: (value: TKey) => void;
  options: readonly { key: TKey; label: string; icon?: ReactNode }[];
}) {
  return (
    <div role="tablist" className="flex gap-1 rounded-xl bg-white/6 p-1">
      {options.map((option) => (
        <button
          key={option.key}
          type="button"
          role="tab"
          aria-selected={option.key === value}
          data-panel-tab
          onClick={() => onChange(option.key)}
          className={cn(
            "flex flex-1 items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm outline-none transition-colors",
            option.key === value
              ? "bg-white text-black"
              : "text-white/70 hover:bg-white/8 hover:text-white",
            "focus-visible:ring-2 focus-visible:ring-white",
          )}
        >
          {option.icon}
          {option.label}
        </button>
      ))}
    </div>
  );
}

export function PanelSection({ title, children }: { title?: string; children: ReactNode }) {
  return (
    <section className="mb-2">
      {title && (
        <p className="px-3 pt-2 pb-1 text-[11px] font-medium tracking-wide text-white/50">
          {title}
        </p>
      )}
      <div className="flex flex-col gap-0.5">{children}</div>
    </section>
  );
}

export function PanelNote({ children }: { children: ReactNode }) {
  return <p className="px-3 py-3 text-center text-xs leading-5 text-white/50">{children}</p>;
}

/** One row. Marked `data-panel-item` so the shell's D-pad walk finds it. */
export function PanelItem({
  leading,
  label,
  description,
  trailing,
  selected = false,
  disabled = false,
  onClick,
  className,
}: {
  leading?: ReactNode;
  label: ReactNode;
  description?: ReactNode;
  trailing?: ReactNode;
  selected?: boolean;
  disabled?: boolean;
  onClick?: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      data-panel-item
      data-selected={selected || undefined}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-start outline-none transition-colors",
        selected ? "bg-white/10" : "hover:bg-white/6",
        "focus-visible:bg-white/12 focus-visible:ring-2 focus-visible:ring-white",
        "disabled:opacity-40",
        className,
      )}
    >
      {leading}
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium">{label}</span>
        {description && (
          <span className="block truncate text-[11px] leading-4 text-white/55">{description}</span>
        )}
      </span>
      {trailing ??
        (selected && <CheckIcon size={18} weight="bold" className="shrink-0 text-white" />)}
    </button>
  );
}

function isTextEntry(element: HTMLElement | null) {
  return element?.matches("input, textarea, [contenteditable='true']") ?? false;
}

function isVisible(element: HTMLElement) {
  return element.offsetParent !== null && !element.matches("[disabled]");
}

function panelItems(root: HTMLElement | null): HTMLElement[] {
  return root ? [...root.querySelectorAll<HTMLElement>("[data-panel-item]")].filter(isVisible) : [];
}

function rowOf(element: HTMLElement | null) {
  return element?.closest<HTMLElement>("[data-panel-row]") ?? null;
}

function focusItem(item: HTMLElement | undefined) {
  if (!item) return;
  item.focus();
  item.scrollIntoView({ block: "nearest" });
}

function moveVertically(root: HTMLElement, active: HTMLElement | null, direction: 1 | -1) {
  const items = panelItems(root);
  if (items.length === 0) return;
  const currentRow = rowOf(active);
  const index = active ? items.indexOf(active) : -1;
  if (index < 0) {
    focusItem(direction === 1 ? items[0] : items.at(-1));
    return;
  }
  // A horizontal row (speed chips, the offset stepper) counts as one stop for vertical moves.
  const candidates = direction === 1 ? items.slice(index + 1) : items.slice(0, index).toReversed();
  focusItem(candidates.find((item) => currentRow === null || rowOf(item) !== currentRow));
}

const byX = (elements: HTMLElement[]) =>
  elements.toSorted((a, b) => a.getBoundingClientRect().left - b.getBoundingClientRect().left);

function moveHorizontally(root: HTMLElement, active: HTMLElement | null, direction: 1 | -1) {
  const row = rowOf(active);
  if (row && active) {
    const siblings = byX(panelItems(row));
    focusItem(siblings[siblings.indexOf(active) + direction]);
    return;
  }
  const tabs = byX([...root.querySelectorAll<HTMLElement>("[data-panel-tab]")].filter(isVisible));
  if (tabs.length === 0) return;
  const selected = tabs.findIndex((tab) => tab.getAttribute("aria-selected") === "true");
  const next = tabs[selected + direction];
  if (!next) return;
  next.click();
  // Keep focus on the list, not the tab strip: the family lands on content, not chrome.
  requestAnimationFrame(() => {
    const items = panelItems(root);
    focusItem(items.find((item) => item.dataset.selected === "true") ?? items[0]);
  });
}
