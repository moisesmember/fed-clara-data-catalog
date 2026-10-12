import {
  useId,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type ReactElement,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from "react";

import { Spinner } from "./states";

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: "md" | "sm";
  loading?: boolean;
}

export function Button({ variant = "secondary", size = "md", loading = false, disabled, children, className, type = "button", ...rest }: ButtonProps) {
  const classes = ["ui-button", `ui-button--${variant}`, size === "sm" ? "ui-button--sm" : "", className ?? ""].join(" ").trim();
  return (
    <button type={type} className={classes} disabled={disabled || loading} aria-busy={loading || undefined} {...rest}>
      {loading ? <Spinner label="" /> : null}
      {children}
    </button>
  );
}

export type Tone = "neutral" | "accent" | "success" | "warning" | "danger" | "info";

export function Badge({ tone = "neutral", children, title }: { tone?: Tone; children: ReactNode; title?: string }) {
  return (
    <span className={`ui-badge ui-badge--${tone}`} title={title}>
      {children}
    </span>
  );
}

export function Panel({ title, actions, children, className }: { title?: ReactNode; actions?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`ui-panel ${className ?? ""}`.trim()}>
      {title || actions ? (
        <header className="ui-panel__header">
          {title ? <h2 className="ui-panel__title">{title}</h2> : <span />}
          {actions}
        </header>
      ) : null}
      <div className="ui-panel__body">{children}</div>
    </section>
  );
}

/** Bloco recolhível (`<details>`) para informação secundária, como detalhes técnicos. */
export function Disclosure({ summary, open, children }: { summary: ReactNode; open?: boolean; children: ReactNode }) {
  return (
    <details className="ui-disclosure" open={open}>
      <summary className="ui-disclosure__summary">{summary}</summary>
      <div className="ui-disclosure__body">{children}</div>
    </details>
  );
}

/** Campo com rótulo, dica e erro associados ao controle (aria-describedby). */
export function Field({
  label,
  hint,
  error,
  children,
}: {
  label: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
  children: (props: { id: string; "aria-describedby"?: string; "aria-invalid"?: boolean }) => ReactElement;
}) {
  const id = useId();
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(" ") || undefined;
  return (
    <div className="ui-field">
      <label className="ui-field__label" htmlFor={id}>
        {label}
      </label>
      {children({ id, "aria-describedby": describedBy, "aria-invalid": error ? true : undefined })}
      {hint ? (
        <span id={hintId} className="ui-field__hint">
          {hint}
        </span>
      ) : null}
      {error ? (
        <span id={errorId} className="ui-field__error" role="alert">
          {error}
        </span>
      ) : null}
    </div>
  );
}

export function TextInput({ size = "md", className, ...rest }: Omit<InputHTMLAttributes<HTMLInputElement>, "size"> & { size?: "md" | "lg" }) {
  return <input className={`ui-input ${size === "lg" ? "ui-input--lg" : ""} ${className ?? ""}`.trim()} {...rest} />;
}

export function Select({ className, ...rest }: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className={`ui-select ${className ?? ""}`.trim()} {...rest} />;
}

export function TextArea({ className, ...rest }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={`ui-textarea ${className ?? ""}`.trim()} {...rest} />;
}

export function Checkbox({ label, ...rest }: Omit<InputHTMLAttributes<HTMLInputElement>, "type"> & { label: ReactNode }) {
  return (
    <label className="ui-check">
      <input type="checkbox" {...rest} />
      <span>{label}</span>
    </label>
  );
}

/** Alternância entre poucas opções (ex.: modo de busca). */
export function Segmented<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: { value: T; label: string; description?: string }[];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <div className="ui-segmented" role="group" aria-label={label}>
      {options.map((option) => (
        <button key={option.value} type="button" aria-pressed={option.value === value} title={option.description} onClick={() => onChange(option.value)}>
          {option.label}
        </button>
      ))}
    </div>
  );
}

export function Tabs<T extends string>({
  label,
  tabs,
  value,
  onChange,
}: {
  label: string;
  tabs: { value: T; label: ReactNode }[];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <div className="ui-tabs" role="tablist" aria-label={label}>
      {tabs.map((tab) => (
        <button key={tab.value} type="button" role="tab" aria-selected={tab.value === value} onClick={() => onChange(tab.value)}>
          {tab.label}
        </button>
      ))}
    </div>
  );
}

export function PageHeader({ eyebrow, title, subtitle, actions }: { eyebrow?: string; title: ReactNode; subtitle?: ReactNode; actions?: ReactNode }) {
  return (
    <header className="ui-page-header">
      <div>
        {eyebrow ? <div className="ui-page-header__eyebrow">{eyebrow}</div> : null}
        <h1>{title}</h1>
        {subtitle ? <p className="ui-page-header__subtitle">{subtitle}</p> : null}
      </div>
      {actions ? <div className="cluster">{actions}</div> : null}
    </header>
  );
}

export function Pagination({ page, hasNext, onChange }: { page: number; hasNext: boolean; onChange: (page: number) => void }) {
  return (
    <nav className="ui-pagination" aria-label="Paginação">
      <Button size="sm" variant="ghost" disabled={page <= 1} onClick={() => onChange(page - 1)}>
        ← Anterior
      </Button>
      <span aria-live="polite">Página {page}</span>
      <Button size="sm" variant="ghost" disabled={!hasNext} onClick={() => onChange(page + 1)}>
        Próxima →
      </Button>
    </nav>
  );
}
