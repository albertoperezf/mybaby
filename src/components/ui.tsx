"use client";

import clsx from "clsx";
import { X } from "lucide-react";
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

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "md" | "lg";

const variants: Record<Variant, string> = {
  primary: "bg-primary text-primary-fg font-semibold",
  secondary: "bg-surface2 text-fg border border-line font-medium",
  ghost: "text-fg font-medium hover:bg-surface2",
  danger: "bg-danger text-primary-fg font-semibold",
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
  return <div className={clsx("rounded-3xl border border-line bg-surface p-4 sm:p-5", className)} {...rest} />;
}

export function PageTitle({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="mb-4 flex items-center justify-between gap-3">
      <h1 className="text-2xl font-bold tracking-tight">{children}</h1>
      {action}
    </div>
  );
}

export function SectionTitle({ children }: { children: ReactNode }) {
  return <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted">{children}</h2>;
}

// ---- Form controls ---------------------------------------------------------

export const inputClass =
  "min-h-12 w-full rounded-xl border border-line bg-surface2 px-3 text-base text-fg placeholder:text-muted";

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

export function Sheet({ open, onClose, title, children }: SheetProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const t = useT();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

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
        <div className="flex flex-col gap-4 p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
          <div className="flex items-center justify-between gap-3">
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
          <div className="pointer-events-auto flex w-full max-w-md items-center justify-between gap-3 rounded-2xl border border-line bg-fg px-4 py-3 text-bg shadow-lg">
            <span className="text-sm font-medium">{toast.message}</span>
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
