"use client";

import clsx from "clsx";
import { Check, X } from "lucide-react";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type ReactNode,
} from "react";
import { useT } from "@/i18n";

// ---- Button ----------------------------------------------------------------

type Variant = "primary" | "secondary" | "ghost" | "danger" | "feed" | "diaper" | "sleep";
type Size = "md" | "lg";

const variants: Record<Variant, string> = {
  primary: "bg-primary text-primary-fg font-bold shadow-soft",
  secondary: "bg-surface2 text-fg border border-line font-semibold",
  ghost: "text-fg font-semibold hover:bg-surface2",
  danger: "bg-danger text-primary-fg font-bold",
  feed: "bg-feed-tint text-feed-ink border border-feed/30 font-bold",
  diaper: "bg-diaper-tint text-diaper-ink border border-diaper/30 font-bold",
  sleep: "bg-sleep-tint text-sleep-ink border border-sleep/30 font-bold",
};
const sizes: Record<Size, string> = {
  md: "min-h-12 px-5 text-base",
  lg: "min-h-16 px-6 text-xl",
};

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
}

export function Button({ variant = "secondary", size = "md", className, type = "button", ...rest }: ButtonProps) {
  return (
    <button
      type={type}
      className={clsx(
        "inline-flex select-none items-center justify-center gap-2 rounded-2xl transition active:scale-[0.97] disabled:opacity-50",
        variants[variant],
        sizes[size],
        className,
      )}
      {...rest}
    />
  );
}

// ---- Layout bits -----------------------------------------------------------

export function Card({ className, ...rest }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={clsx("rounded-[1.75rem] border border-line bg-surface p-4 shadow-soft sm:p-5", className)} {...rest} />;
}

export function PageTitle({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="mb-4 flex items-center justify-between gap-3">
      <h1 className="text-3xl font-extrabold tracking-tight">{children}</h1>
      {action}
    </div>
  );
}

export function SectionTitle({ children }: { children: ReactNode }) {
  return <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted">{children}</h2>;
}

// ---- Form controls ---------------------------------------------------------

export const inputClass =
  "min-h-12 w-full min-w-0 max-w-full rounded-xl border border-line bg-surface2 px-3 text-base text-fg placeholder:text-muted";

export function Field({ label, hint, children }: { label: string; hint?: string; children: (id: string) => ReactNode }) {
  const id = useId();
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium">
        {label}
      </label>
      {children(id)}
      {hint && <p className="text-xs text-muted">{hint}</p>}
    </div>
  );
}

interface SegmentedProps<T extends string | number> {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
  className?: string;
}

export function Segmented<T extends string | number>({ label, value, options, onChange, className }: SegmentedProps<T>) {
  return (
    <div role="radiogroup" aria-label={label} className={clsx("flex gap-1 rounded-2xl bg-surface2 p-1", className)}>
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={String(o.value)}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(o.value)}
            className={clsx(
              "min-h-11 flex-1 rounded-xl px-3 text-sm font-medium transition",
              active ? "bg-primary text-primary-fg" : "text-fg",
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

export function Switch({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={clsx(
        "relative h-8 w-14 shrink-0 rounded-full border border-line transition",
        checked ? "bg-primary" : "bg-surface2",
      )}
    >
      <span
        className={clsx(
          "absolute top-0.5 h-6 w-6 rounded-full bg-fg transition-all",
          checked ? "left-[1.7rem] bg-primary-fg" : "left-0.5",
        )}
      />
    </button>
  );
}

// ---- Sheet -----------------------------------------------------------------

interface SheetProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}

const INTERACTIVE = "button, a, input, select, textarea, label";

export function Sheet({ open, onClose, title, children }: SheetProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const drag = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    startTime: number;
    dy: number;
    dragging: boolean;
    fromHandle: boolean;
  } | null>(null);
  const titleId = useId();
  const t = useT();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    dialog.style.transform = "";
    dialog.style.transition = "";
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  function onPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    if (e.button !== 0 && e.pointerType === "mouse") return;
    const dialog = ref.current;
    if (!dialog) return;
    const target = e.target as HTMLElement | null;
    if (target?.closest(INTERACTIVE)) return;
    const fromHandle = Boolean(target?.closest("[data-sheet-handle]"));
    if (!fromHandle && dialog.scrollTop > 0) return;
    drag.current = {
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      startTime: Date.now(),
      dy: 0,
      dragging: false,
      fromHandle,
    };
  }

  function onPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    const state = drag.current;
    const dialog = ref.current;
    if (!state || !dialog || e.pointerId !== state.pointerId) return;
    const dx = e.clientX - state.startX;
    const dy = e.clientY - state.startY;
    if (!state.dragging) {
      if (dy < 6 || dy <= Math.abs(dx)) {
        if (dy < -8) drag.current = null;
        return;
      }
      if (!state.fromHandle && dialog.scrollTop > 0) {
        drag.current = null;
        return;
      }
      state.dragging = true;
      dialog.style.transition = "none";
      e.currentTarget.setPointerCapture(e.pointerId);
    }
    state.dy = Math.max(0, dy);
    dialog.style.transform = `translateY(${state.dy}px)`;
  }

  function endDrag(e: React.PointerEvent<HTMLDivElement>, cancelled = false) {
    const state = drag.current;
    const dialog = ref.current;
    if (!state || e.pointerId !== state.pointerId) return;
    drag.current = null;
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
    if (!state.dragging || !dialog) return;

    const elapsed = Math.max(1, Date.now() - state.startTime);
    const velocity = state.dy / elapsed;
    const shouldClose = !cancelled && (state.dy >= 90 || (state.dy >= 40 && velocity > 0.5));

    if (shouldClose) {
      dialog.style.transform = "";
      dialog.style.transition = "";
      onClose();
    } else {
      dialog.style.transition = "transform 200ms cubic-bezier(0.2, 0.8, 0.2, 1)";
      dialog.style.transform = "translateY(0)";
      const clear = () => {
        dialog.style.transition = "";
        dialog.style.transform = "";
      };
      dialog.addEventListener("transitionend", clear, { once: true });
    }
  }

  return (
    <dialog
      ref={ref}
      className="sheet"
      aria-labelledby={titleId}
      onClose={onClose}
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
    >
      {open && (
        <div
          className="flex flex-col gap-4 p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))]"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={(e) => endDrag(e, false)}
          onPointerCancel={(e) => endDrag(e, true)}
        >
          {/* Generous touch target around the visual drag handle for mobile swipe-to-close. */}
          <div data-sheet-handle className="-mx-5 -mt-5 flex touch-none justify-center pb-2 pt-3 md:hidden">
            <div aria-hidden className="h-1.5 w-11 rounded-full bg-line" />
          </div>
          <div data-sheet-handle className="flex touch-none items-center justify-between gap-3">
            <h2 id={titleId} className="text-xl font-bold">
              {title}
            </h2>
            <button
              type="button"
              onClick={onClose}
              aria-label={t("common.close")}
              className="grid size-12 place-items-center rounded-full bg-surface2"
            >
              <X aria-hidden className="size-5" />
            </button>
          </div>
          {children}
        </div>
      )}
    </dialog>
  );
}

// ---- Toasts (with undo) ----------------------------------------------------

interface ToastOptions {
  message: string;
  actionLabel?: string;
  onAction?: () => void;
}
interface ToastItem extends ToastOptions {
  id: number;
}

const ToastContext = createContext<{ show: (t: ToastOptions) => void }>({ show: () => undefined });
export const useToast = () => useContext(ToastContext);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<ToastItem | null>(null);
  const counter = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const dismiss = useCallback(() => setToast(null), []);
  const show = useCallback((options: ToastOptions) => {
    clearTimeout(timer.current);
    const id = ++counter.current;
    setToast({ ...options, id });
    timer.current = setTimeout(() => setToast((cur) => (cur?.id === id ? null : cur)), 7000);
  }, []);

  useEffect(() => () => clearTimeout(timer.current), []);
  const value = useMemo(() => ({ show }), [show]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        role="status"
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 bottom-[calc(10rem+env(safe-area-inset-bottom))] z-50 flex justify-center px-4 lg:bottom-28"
      >
        {toast && (
          <div className="pointer-events-auto flex w-full max-w-md items-center gap-3 rounded-2xl border border-line bg-fg px-4 py-3 text-bg shadow-lg">
            <span key={toast.id} aria-hidden className="animate-pop grid size-7 shrink-0 place-items-center rounded-full bg-bg text-fg">
              <Check className="size-4" strokeWidth={3} />
            </span>
            <span className="flex-1 text-sm font-semibold">{toast.message}</span>
            {toast.onAction && (
              <button
                type="button"
                className="min-h-11 rounded-xl px-3 text-sm font-bold underline"
                onClick={() => {
                  toast.onAction?.();
                  dismiss();
                }}
              >
                {toast.actionLabel}
              </button>
            )}
          </div>
        )}
      </div>
    </ToastContext.Provider>
  );
}
