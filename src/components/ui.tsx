import clsx from "clsx";
import { Star, X } from "lucide-react";
import { useEffect, type ReactNode } from "react";

export const cn = clsx;

export function PageHeader({ eyebrow, title, right }: { eyebrow: ReactNode; title: string; right?: ReactNode }) {
  return (
    <div className="mb-7 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <div className="eyebrow mb-1 flex items-center gap-2">{eyebrow}</div>
        <h1 className="page-title">{title}</h1>
      </div>
      {right}
    </div>
  );
}

export function IconBubble({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span className={cn("grid h-9 w-9 shrink-0 place-items-center rounded-full bg-lavender text-primary", className)}>
      {children}
    </span>
  );
}

export function Rating({ value }: { value: number }) {
  return (
    <span className="inline-flex items-center gap-1 text-[15px] font-medium text-ink">
      <Star className="h-4 w-4 fill-star text-star" />
      {value.toFixed(1)}
    </span>
  );
}

export function ProgressBar({ value, className }: { value: number; className?: string }) {
  return (
    <div className={cn("h-2 w-full overflow-hidden rounded-full bg-lavender", className)}>
      <div className="h-full rounded-full bg-primary transition-all duration-500" style={{ width: `${Math.round(value * 100)}%` }} />
    </div>
  );
}

export function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={cn(
        "relative h-7 w-12 shrink-0 rounded-full transition-colors",
        checked ? "bg-primary" : "bg-line",
      )}
    >
      <span
        className={cn(
          "absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-all",
          checked ? "left-6" : "left-1",
        )}
      />
    </button>
  );
}

export function Modal({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: ReactNode }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/30 p-4 backdrop-blur-sm sm:items-center" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="card max-h-[90vh] w-full max-w-lg overflow-y-auto p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-xl font-bold">{title}</h2>
          <button onClick={onClose} className="grid h-9 w-9 place-items-center rounded-full hover:bg-sand" aria-label="Close">
            <X className="h-5 w-5" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="py-6 text-center text-muted">{children}</p>;
}
