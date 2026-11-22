// The membership form's field vocabulary on the public twc kit (classes in src/app/twc.css).
import * as React from "react";
import { cn } from "@/index";
import { useCopy } from "@/features/form-copy/use-copy";
import { FieldErrors, checkErrorKey } from "./form-state";
import { LIMITS } from "./schema";

// The space keeps a screen reader's name "Anything else? Optional", not "Anything else?Optional".
const Optional = () => <>{" "}<span className="ml-1 text-[13px] font-normal normal-case tracking-normal text-sb-muted">Optional</span></>;

export const Input = (props: React.ComponentProps<"input">) => <input className="twc-input" {...props} />;
export const Select = (props: React.ComponentProps<"select">) => <select className="twc-input cursor-pointer" {...props} />;
/** Long answers stay well inside the 32 KB `answers` column. */
export const LongAnswer = (props: React.ComponentProps<"textarea">) => <textarea className="twc-input" maxLength={LIMITS.text} {...props} />;

type ControlProps = { id?: string; name?: string; "aria-describedby"?: string; "aria-invalid"?: boolean };

/** Labels its single child control: gives it `id` and points `aria-describedby` at the hint and any error. */
export function Field({ id, label, optional, hint, className, children }: { id: string; label: string; optional?: boolean; hint?: string; className?: string; children: React.ReactElement<ControlProps> }) {
  const t = useCopy();
  const error = React.useContext(FieldErrors).get(children.props.name ?? id);
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  return (
    <div className={cn("twc-field", className)} data-question={t(label)}>
      <label htmlFor={id}>{t(label)}{optional && <Optional />}</label>
      {React.cloneElement(children, { id, "aria-describedby": [hintId, errorId].filter(Boolean).join(" ") || undefined, "aria-invalid": error ? true : undefined })}
      {hint && <span id={hintId} className="twc-hint">{t(hint)}</span>}
      {error && <p id={errorId} className="twc-error">{error}</p>}
    </div>
  );
}

export function Check({ label, className, id, ...props }: Omit<React.ComponentProps<"input">, "type"> & { label: React.ReactNode }) {
  const autoId = React.useId();
  const inputId = id ?? autoId;
  const error = React.useContext(FieldErrors).get(checkErrorKey(props.name, props.value));
  const errorId = `${inputId}-error`;
  return (
    <div className="min-w-0">
      <label className={cn("twc-check", className)}>
        <input type="checkbox" id={inputId} aria-invalid={error ? true : undefined} aria-describedby={error ? errorId : undefined} {...props} />
        <span className="max-w-[56ch]">{label}</span>
      </label>
      {error && <p id={errorId} className="twc-error mt-1.5 pl-8">{error}</p>}
    </div>
  );
}

export type Option = string | { value: string; label: string };
/** What a required group says while empty: a radio group takes exactly one. */
const emptyMessage = (type: "checkbox" | "radio") => (type === "radio" ? "Choose one option." : "Choose at least one option.");

export interface ChoicesProps {
  name: string;
  legend: string;
  options: Option[];
  type?: "checkbox" | "radio";
  hint?: string;
  optional?: boolean;
  /** Checkbox groups only: at least one must be checked before the form can submit. */
  required?: boolean;
  defaultValue?: string;
  /** Every checked value, after each change. */
  onValueChange?: (values: string[]) => void;
  className?: string;
}

/** A pill group (`twc-choice`) of checkboxes or radios in a labelled fieldset. */
export function Choices({ name, legend, options, type = "checkbox", hint, optional, required, defaultValue, onValueChange, className }: ChoicesProps) {
  const t = useCopy();
  const group = React.useRef<HTMLFieldSetElement>(null);
  const [invalid, setInvalid] = React.useState(false);
  const errorId = React.useId();
  // Native validation for "at least one": the message sits on the first box while none is checked,
  // so the browser blocks submit and focuses it; its `invalid` event shows the inline error.
  const syncValidity = () => {
    const boxes = [...(group.current?.querySelectorAll("input") ?? [])];
    const empty = !!required && !boxes.some((box) => box.checked);
    boxes.forEach((box, i) => box.setCustomValidity(empty && i === 0 ? emptyMessage(type) : ""));
    return boxes;
  };
  React.useLayoutEffect(() => void syncValidity());
  const onChange = () => {
    const checked = syncValidity().filter((box) => box.checked).map((box) => box.value);
    if (checked.length) setInvalid(false);
    onValueChange?.(checked);
  };
  const firstId = React.useId();
  const formError = React.useContext(FieldErrors).get(name);
  const message = formError ?? (invalid && required ? emptyMessage(type) : undefined);
  return (
    <fieldset ref={group} data-question={t(legend)} aria-describedby={message ? errorId : undefined} className={cn("min-w-0", className)}>
      <legend className="twc-label mb-2.5">
        {t(legend)}{optional && <Optional />}
        {hint && <span className="ml-2 text-[13px] font-normal normal-case tracking-normal text-sb-muted">{t(hint)}</span>}
      </legend>
      <div className="flex flex-wrap gap-2">
        {options.map((option, i) => {
          const { value, label } = typeof option === "string" ? { value: option, label: option } : option;
          return (
            <label key={value} className="twc-choice">
              <input
                id={i === 0 ? firstId : undefined}
                type={type}
                name={name}
                value={value}
                defaultChecked={defaultValue === value}
                aria-invalid={formError && type === "checkbox" ? true : undefined}
                aria-describedby={message && (i === 0 || formError) ? errorId : undefined}
                onInvalid={i === 0 && required ? () => setInvalid(true) : undefined}
                onChange={onChange}
              />
              {label}
            </label>
          );
        })}
      </div>
      {/* A form with an error summary announces there; an inline alert too would read every error twice. */}
      {message && <p id={errorId} role={formError ? undefined : "alert"} className="twc-error mt-2.5">{message}</p>}
    </fieldset>
  );
}

/** One numbered form section; its visible heading names the fieldset, so the title is announced once. */
export function Section({ index, title, description, children }: { index: string; title: string; description: string; children: React.ReactNode }) {
  const t = useCopy();
  const headingId = React.useId();
  return (
    <fieldset aria-labelledby={headingId} data-step={index} className="flex min-w-0 flex-col gap-[22px] border-t border-sb-ink/15 pt-12 first:border-t-0 first:pt-0">
      <span className="twc-index">{index}</span>
      <h2 id={headingId} className="font-display text-[32px] leading-[1.09] tracking-[-0.5px] sm:text-[40px]">{t(title)}</h2>
      <p className="max-w-[56ch] text-sb-muted">{t(description)}</p>
      {children}
    </fieldset>
  );
}

export function Notice({ title, eyebrow, tone, className, children, ...props }: Omit<React.ComponentProps<"aside">, "title"> & { title: string; eyebrow?: string; tone?: "mint" | "danger" }) {
  return (
    <aside className={cn("twc-notice", tone && `twc-notice--${tone}`, className)} {...props}>
      {eyebrow && <span className="twc-eyebrow text-sb-ink">{eyebrow}</span>}
      <h3 className="twc-notice__title">{title}</h3>
      <div className="flex max-w-[56ch] flex-col gap-3 text-[15px]">{children}</div>
    </aside>
  );
}
