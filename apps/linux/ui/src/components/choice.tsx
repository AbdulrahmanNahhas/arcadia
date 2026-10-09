import { Check, ChevronDown } from "lucide-react";
import { useEffect, useRef, useState } from "react";
export function Choice({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: Array<{ value: string; label: string }>;
  onChange: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (event: PointerEvent) => {
      if (event.target instanceof Node && !root.current?.contains(event.target)) setOpen(false);
    };
    document.addEventListener("pointerdown", close);
    root.current?.querySelector<HTMLButtonElement>(`[role=option][aria-selected=true]`)?.focus();
    return () => document.removeEventListener("pointerdown", close);
  }, [open]);
  return (
    <div
      ref={root}
      className="choice"
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
      }}
    >
      <button
        ref={trigger}
        className="choice-trigger"
        aria-label={label}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown") {
            event.preventDefault();
            setOpen(true);
          }
        }}
      >
        {options.find((option) => option.value === value)?.label ?? label}
        <ChevronDown size={16} />
      </button>
      {open && (
        <div
          className="choice-menu"
          role="listbox"
          aria-label={label}
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              setOpen(false);
              trigger.current?.focus();
            }
            if (event.key === "ArrowDown" || event.key === "ArrowUp") {
              event.preventDefault();
              const choices = Array.from(
                event.currentTarget.querySelectorAll<HTMLButtonElement>("[role=option]"),
              );
              const index = choices.findIndex((choice) => choice === document.activeElement);
              choices[
                (index + (event.key === "ArrowDown" ? 1 : choices.length - 1)) % choices.length
              ]?.focus();
            }
          }}
        >
          {options.map((option) => (
            <button
              key={option.value}
              role="option"
              tabIndex={option.value === value ? 0 : -1}
              aria-selected={option.value === value}
              onClick={() => {
                onChange(option.value);
                setOpen(false);
                trigger.current?.focus();
              }}
            >
              {option.label}
              {option.value === value && <Check size={15} />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
