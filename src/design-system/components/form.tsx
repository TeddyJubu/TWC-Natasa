import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../lib/utils";

const fieldVariants = cva(
  "peer w-full font-sans text-base text-ink placeholder:text-ink-muted/85 transition-[border-color,background-color,box-shadow,transform] duration-300 ease-[var(--ease-snap)] hover:border-ink-muted focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50 aria-[invalid=true]:border-danger aria-[invalid=true]:focus-visible:ring-danger/20 motion-reduce:transition-none",
  {
    variants: {
      variant: {
        editorial: "border-x-0 border-b border-t-0 border-line bg-transparent px-0 focus-visible:border-sky focus-visible:shadow-[inset_0_-1px_0_var(--bl-sky)] focus-visible:ring-0",
        boxed: "rounded-control border border-line bg-surface px-4 focus-visible:-translate-y-0.5 focus-visible:border-sky focus-visible:bg-canvas focus-visible:ring-2 focus-visible:ring-ring/20",
      },
    },
    defaultVariants: { variant: "editorial" },
  },
);

export interface LabelProps extends React.LabelHTMLAttributes<HTMLLabelElement> {
  index?: string;
  optional?: boolean;
}
export const Label = React.forwardRef<HTMLLabelElement, LabelProps>(({ className, index, optional, children, ...p }, ref) => (
  <label ref={ref} className={cn("flex items-baseline justify-between gap-3 font-sans text-xs font-medium uppercase text-ink", className)} {...p}>
    <span className="flex items-baseline gap-2">{index && <span className="text-ink-muted" aria-hidden>{index}</span>}{children}</span>
    {optional && <span className="font-normal normal-case text-ink-muted">Optional</span>}
  </label>
));
Label.displayName = "Label";

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement>, VariantProps<typeof fieldVariants> {}
export const Input = React.forwardRef<HTMLInputElement, InputProps>(({ className, variant, ...p }, ref) => (
  <input ref={ref} className={cn(fieldVariants({ variant }), "h-field", className)} {...p} />
));
Input.displayName = "Input";

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement>, VariantProps<typeof fieldVariants> {}
export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(({ className, variant, ...p }, ref) => (
  <textarea ref={ref} className={cn(fieldVariants({ variant }), "min-h-field-tall resize-y py-3", className)} {...p} />
));
Textarea.displayName = "Textarea";

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement>, VariantProps<typeof fieldVariants> {}
export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(({ className, variant, children, ...p }, ref) => (
  <select ref={ref} className={cn(fieldVariants({ variant }), "h-field cursor-pointer", className)} {...p}>{children}</select>
));
Select.displayName = "Select";

export interface CheckboxProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "type"> {
  label: React.ReactNode;
  description?: React.ReactNode;
}
export const Checkbox = React.forwardRef<HTMLInputElement, CheckboxProps>(({ className, label, description, id, ...p }, ref) => {
  const auto = React.useId();
  const cid = id ?? auto;
  return (
    <label htmlFor={cid} className={cn("group inline-flex cursor-pointer items-start gap-3 text-sm text-ink transition-opacity has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-50", className)}>
      <input ref={ref} id={cid} type="checkbox" className="peer sr-only" {...p} />
      <span aria-hidden className="mt-0.5 grid size-5 shrink-0 place-items-center border border-line bg-canvas transition-[transform,background-color,border-color] duration-300 ease-[var(--ease-snap)] group-hover:scale-105 peer-checked:scale-105 peer-checked:border-ink peer-checked:bg-ink peer-checked:[&>svg]:[animation:bl-check_var(--duration-base)_var(--ease-snap)_both] peer-focus-visible:ring-2 peer-focus-visible:ring-ring peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-canvas motion-reduce:transform-none motion-reduce:transition-none">
        <svg viewBox="0 0 16 16" className="size-3 scale-50 text-canvas opacity-0" fill="none" stroke="currentColor" strokeWidth="2"><path d="m3 8 3 3 7-7" /></svg>
      </span>
      <span><span className="block">{label}</span>{description && <span className="mt-1 block text-xs leading-relaxed text-ink-muted">{description}</span>}</span>
    </label>
  );
});
Checkbox.displayName = "Checkbox";

export interface RadioGroupProps extends Omit<React.FieldsetHTMLAttributes<HTMLFieldSetElement>, "onChange"> {
  name: string;
  legend: React.ReactNode;
  options: { value: string; label: string }[];
  /** Controlled selection; pair with `onValueChange`. */
  value?: string;
  defaultValue?: string;
  onValueChange?: (v: string) => void;
  /** Native radio validation: the form cannot submit until one option is chosen. */
  required?: boolean;
  variant?: "pills" | "list";
}
export const RadioGroup = React.forwardRef<HTMLFieldSetElement, RadioGroupProps>(
  ({ className, name, legend, options, value, defaultValue, onValueChange, required, variant = "pills", ...p }, ref) => (
    <fieldset ref={ref} className={cn("flex flex-col", className)} {...p}>
      <legend className="mb-4 font-sans text-xs font-medium uppercase text-ink">{legend}</legend>
      <div className={cn("flex gap-2", variant === "pills" ? "flex-wrap" : "flex-col border-y border-line")}>
        {options.map((o) => (
          <label key={o.value} className={cn("cursor-pointer has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-50", variant === "list" && "border-b border-line last:border-b-0")}>
            <input type="radio" name={name} value={o.value} {...(value !== undefined ? { checked: value === o.value } : { defaultChecked: defaultValue === o.value })} required={required} onChange={() => onValueChange?.(o.value)} className="peer sr-only" />
            <span className={cn("inline-flex items-center font-sans text-sm text-ink transition-[transform,background-color,border-color,color] duration-300 ease-[var(--ease-snap)] hover:-translate-y-0.5 peer-focus-visible:ring-2 peer-focus-visible:ring-ring motion-reduce:transform-none motion-reduce:transition-none", variant === "pills" ? "h-11 rounded-full border border-line px-5 peer-checked:border-ink peer-checked:bg-ink peer-checked:text-canvas peer-checked:shadow-soft" : "min-h-field w-full justify-between py-3 peer-checked:font-medium peer-checked:[&>span]:scale-125 peer-checked:[&>span]:border-ink peer-checked:[&>span]:bg-ink")}>
              {o.label}{variant === "list" && <span aria-hidden className="size-3 rounded-full border border-line transition-[transform,background-color,border-color] duration-300 peer-checked:border-ink peer-checked:bg-ink" />}
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  ),
);
RadioGroup.displayName = "RadioGroup";

export interface FormFieldProps extends React.HTMLAttributes<HTMLDivElement> {
  label: React.ReactNode;
  htmlFor: string;
  hint?: string;
  error?: string;
  index?: string;
  optional?: boolean;
}
type ControlProps = { id?: string; "aria-describedby"?: string; "aria-invalid"?: React.AriaAttributes["aria-invalid"] };

/** Space-separated id list with duplicates and empties removed; undefined when nothing is left. */
const joinIds = (...lists: (string | undefined)[]) => {
  const ids = [...new Set(lists.flatMap((list) => list?.split(/\s+/) ?? []).filter(Boolean))];
  return ids.length ? ids.join(" ") : undefined;
};

/**
 * The single child must be the control itself (or a component that forwards `id` and `aria-*` props to it).
 * Labels its single child control: injects `id={htmlFor}` (unless the child has one), `aria-describedby`
 * pointing at the rendered hint or error (merged with the child's own), and `aria-invalid` when `error` is set.
 */
export const FormField = React.forwardRef<HTMLDivElement, FormFieldProps>(({ className, label, htmlFor, hint, error, index, optional, children, ...p }, ref) => {
  const messageId = error ? `${htmlFor}-error` : hint ? `${htmlFor}-hint` : undefined;
  let control = children;
  if (React.isValidElement<ControlProps>(children) && children.type !== React.Fragment) {
    const own = children.props;
    control = React.cloneElement(children, {
      id: own.id ?? htmlFor,
      "aria-describedby": joinIds(own["aria-describedby"], messageId),
      "aria-invalid": error ? true : own["aria-invalid"],
    });
  }
  return (
    <div ref={ref} className={cn("group/form-field flex flex-col gap-2", className)} {...p}>
      <Label htmlFor={htmlFor} index={index} optional={optional} className="transition-colors duration-300 group-focus-within/form-field:text-sky">{label}</Label>
      {control}
      {error ? <p id={`${htmlFor}-error`} role="alert" className="font-sans text-xs text-danger">{error}</p> : hint ? <p id={`${htmlFor}-hint`} className="font-sans text-xs text-ink-muted">{hint}</p> : null}
    </div>
  );
});
FormField.displayName = "FormField";

export interface SwitchProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "type"> {
  label: React.ReactNode;
  description?: React.ReactNode;
}
export const Switch = React.forwardRef<HTMLInputElement, SwitchProps>(({ className, label, description, id, ...p }, ref) => {
  const auto = React.useId();
  const sid = id ?? auto;
  return (
    <label htmlFor={sid} className={cn("group flex cursor-pointer items-start justify-between gap-5 border-y border-line py-4 transition-colors hover:border-ink-muted has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-50", className)}>
      <span><span className="block font-sans text-sm text-ink">{label}</span>{description && <span className="mt-1 block font-sans text-xs leading-relaxed text-ink-muted">{description}</span>}</span>
      <input ref={ref} id={sid} type="checkbox" role="switch" className="peer sr-only" {...p} />
      <span aria-hidden className="relative mt-0.5 h-6 w-11 shrink-0 rounded-full bg-surface-strong transition-[transform,background-color] duration-300 ease-[var(--ease-snap)] group-hover:scale-105 after:absolute after:left-1 after:top-1 after:size-4 after:rounded-full after:bg-ink after:transition-transform after:duration-300 after:ease-[var(--ease-snap)] peer-checked:bg-ink peer-checked:after:translate-x-5 peer-checked:after:bg-canvas peer-focus-visible:ring-2 peer-focus-visible:ring-ring peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-canvas motion-reduce:transform-none motion-reduce:transition-none" />
    </label>
  );
});
Switch.displayName = "Switch";

export interface FileUploadProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "type"> {
  label: React.ReactNode;
  hint?: React.ReactNode;
}
export const FileUpload = React.forwardRef<HTMLInputElement, FileUploadProps>(({ className, label, hint, id, ...p }, ref) => {
  const auto = React.useId();
  const fid = id ?? auto;
  return (
    <label htmlFor={fid} className={cn("group relative flex min-h-field-tall cursor-pointer flex-col items-center justify-center border border-dashed border-line bg-surface px-6 py-8 text-center transition-[transform,background-color,border-color,box-shadow] duration-300 ease-[var(--ease-snap)] hover:-translate-y-1 hover:border-ink hover:bg-canvas hover:shadow-soft has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-50 motion-reduce:transform-none motion-reduce:transition-none", className)}>
      <input ref={ref} id={fid} type="file" className="peer sr-only" {...p} />
      <svg aria-hidden viewBox="0 0 24 24" className="mb-3 size-6 text-ink transition-transform duration-300 ease-[var(--ease-snap)] group-hover:-translate-y-1" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M12 16V4m0 0L7 9m5-5 5 5M4 15v4h16v-4" /></svg>
      <span className="font-display text-xl text-ink underline decoration-line underline-offset-4 group-hover:decoration-ink">{label}</span>
      {hint && <span className="mt-2 font-sans text-xs text-ink-muted">{hint}</span>}
      <span className="pointer-events-none absolute inset-0 peer-focus-visible:ring-2 peer-focus-visible:ring-ring" />
    </label>
  );
});
FileUpload.displayName = "FileUpload";

export interface FormSectionProps extends Omit<React.FieldsetHTMLAttributes<HTMLFieldSetElement>, "title"> {
  index?: string;
  title: React.ReactNode;
  description?: React.ReactNode;
  /** Heading element for the title: "h2" when the section sits directly under the page h1. */
  headingAs?: "h2" | "h3";
}
/** The visible heading names the fieldset (aria-labelledby), so the title is announced once. */
export const FormSection = React.forwardRef<HTMLFieldSetElement, FormSectionProps>(({ className, index, title, description, headingAs: Title = "h3", children, ...p }, ref) => {
  const headingId = React.useId();
  return (
    <fieldset ref={ref} aria-labelledby={headingId} className={cn("min-w-0 border-t border-line pt-5", className)} {...p}>
      <div className="mb-10 flex items-start justify-between gap-6">
        <div>{index && <span className="mb-2 block font-sans text-xs font-medium uppercase text-ink-muted">{index}</span>}<Title id={headingId} className="font-display text-3xl font-normal leading-tight text-ink">{title}</Title></div>
        {description && <p className="max-w-xs font-sans text-xs leading-relaxed text-ink-muted">{description}</p>}
      </div>
      {children}
    </fieldset>
  );
});
FormSection.displayName = "FormSection";

export type FormActionsProps = React.HTMLAttributes<HTMLDivElement>;
export const FormActions = React.forwardRef<HTMLDivElement, FormActionsProps>(({ className, ...p }, ref) => (
  <div ref={ref} className={cn("flex flex-col-reverse gap-3 border-t border-line pt-6 sm:flex-row sm:items-center sm:justify-end", className)} {...p} />
));
FormActions.displayName = "FormActions";

export interface ChoiceOption {
  value: string;
  label: React.ReactNode;
  description?: React.ReactNode;
}
export interface ChoiceGroupProps extends Omit<React.FieldsetHTMLAttributes<HTMLFieldSetElement>, "onChange"> {
  name: string;
  legend: React.ReactNode;
  options: ChoiceOption[];
  hint?: React.ReactNode;
  columns?: 1 | 2 | 3;
  /** At least one box must be checked before the form can submit. */
  required?: boolean;
  /** Shown (and used as the native validation message) when `required` and nothing is checked. */
  requiredMessage?: string;
  /** Controlled selection; pair with `onValueChange`. */
  value?: string[];
  /** Initial selection when uncontrolled. */
  defaultValue?: string[];
  onValueChange?: (values: string[]) => void;
}
const checkboxesIn = (node: HTMLFieldSetElement | null) => [...(node?.querySelectorAll<HTMLInputElement>('input[type="checkbox"]') ?? [])];
export const ChoiceGroup = React.forwardRef<HTMLFieldSetElement, ChoiceGroupProps>(
  ({ className, name, legend, options, hint, columns = 2, required, requiredMessage = "Choose at least one option.", value, defaultValue, onValueChange, "aria-describedby": describedBy, ...p }, ref) => {
    const controlled = value !== undefined;
    const [inner, setInner] = React.useState<string[]>(() => defaultValue ?? []);
    const values = controlled ? value : inner;
    const [invalidShown, setInvalidShown] = React.useState(false);
    const errorId = `${React.useId()}-error`;
    const missing = !!required && values.length === 0;
    // A group that becomes non-empty by any route (click, controlled value, reset) forgets the shown error;
    // it only reappears on a new `invalid` event.
    if (invalidShown && values.length > 0) setInvalidShown(false);
    const showError = invalidShown && missing;

    const fieldset = React.useRef<HTMLFieldSetElement | null>(null);
    const setFieldset = React.useCallback((node: HTMLFieldSetElement | null) => {
      fieldset.current = node;
      if (typeof ref === "function") ref(node);
      else if (ref) ref.current = node;
    }, [ref]);

    // Native constraint validation, read from the DOM: the message sits on whichever box is first right now
    // (so the browser blocks submission and focuses it) and is cleared on every other box.
    const syncValidity = React.useCallback(() => {
      const all = checkboxesIn(fieldset.current);
      const empty = !!required && !all.some((box) => box.checked);
      all.forEach((box, i) => box.setCustomValidity(empty && i === 0 ? requiredMessage : ""));
    }, [required, requiredMessage]);
    React.useLayoutEffect(syncValidity);

    // `reset` fires before the form restores its controls, so re-read the DOM on the next task.
    React.useEffect(() => {
      const form = fieldset.current?.form;
      if (!form) return;
      let timer: ReturnType<typeof setTimeout> | undefined;
      const onReset = () => {
        clearTimeout(timer);
        timer = setTimeout(() => {
          if (!controlled) setInner(checkboxesIn(fieldset.current).filter((box) => box.checked).map((box) => box.value));
          setInvalidShown(false);
          syncValidity();
        }, 0);
      };
      form.addEventListener("reset", onReset);
      return () => { form.removeEventListener("reset", onReset); clearTimeout(timer); };
    }, [controlled, syncValidity]);

    const update = (option: string, checked: boolean) => {
      const next = checked ? [...values, option] : values.filter((item) => item !== option);
      if (!controlled) {
        setInner(next);
        syncValidity();
      }
      onValueChange?.(next);
    };
    return (
      <fieldset ref={setFieldset} aria-describedby={joinIds(describedBy, showError ? errorId : undefined)} className={cn("rounded-card border border-line bg-canvas p-5 transition-[border-color,box-shadow] duration-300 focus-within:border-sky focus-within:shadow-soft", className)} {...p}>
        <legend className="px-1 font-sans text-xs font-medium uppercase text-ink">{legend}{required && <span className="ml-1 text-danger" aria-hidden>*</span>}</legend>
        {hint && <p className="mb-5 mt-1 font-sans text-xs text-ink-muted">{hint}</p>}
        <div className={cn("grid gap-x-8 gap-y-4", columns === 2 && "sm:grid-cols-2", columns === 3 && "sm:grid-cols-2 lg:grid-cols-3")}>
          {options.map((option, i) => (
            <Checkbox
              key={option.value}
              name={name}
              value={option.value}
              label={option.label}
              description={option.description}
              {...(controlled ? { checked: values.includes(option.value) } : { defaultChecked: defaultValue?.includes(option.value) })}
              aria-describedby={i === 0 && showError ? errorId : undefined}
              onInvalid={i === 0 ? () => setInvalidShown(true) : undefined}
              onChange={(event) => update(option.value, event.currentTarget.checked)}
            />
          ))}
        </div>
        {showError && <p id={errorId} role="alert" className="mt-4 font-sans text-xs text-danger">{requiredMessage}</p>}
      </fieldset>
    );
  },
);
ChoiceGroup.displayName = "ChoiceGroup";

export interface FormNoticeProps extends Omit<React.HTMLAttributes<HTMLElement>, "title"> {
  title: React.ReactNode;
  tone?: "soft" | "accent";
  /** Heading element for the title; one level below the surrounding section heading. */
  headingAs?: "h2" | "h3" | "h4";
}
export const FormNotice = React.forwardRef<HTMLElement, FormNoticeProps>(({ className, title, tone = "soft", headingAs: Title = "h4", children, ...p }, ref) => (
  <aside ref={ref} className={cn("rounded-card border border-line p-5 transition-colors duration-300", tone === "accent" ? "bg-mint" : "bg-surface", className)} {...p}>
    <Title className="font-display text-xl font-normal text-ink">{title}</Title>
    <div className="mt-3 font-sans text-sm leading-relaxed text-ink-muted">{children}</div>
  </aside>
));
FormNotice.displayName = "FormNotice";

export interface FormProgressProps extends React.HTMLAttributes<HTMLOListElement> {
  items: string[];
  current?: number;
}
export const FormProgress = React.forwardRef<HTMLOListElement, FormProgressProps>(({ className, items, current = 0, ...p }, ref) => (
  <ol ref={ref} aria-label="Application sections" className={cn("flex gap-1", className)} {...p}>
    {items.map((item, index) => (
      <li key={item} className="group relative min-w-0 flex-1">
        <span className={cn("block h-1 overflow-hidden rounded-full bg-surface-strong", index <= current && "bg-ink")}>
          <span className={cn("block h-full origin-left bg-sky transition-transform duration-700 ease-[var(--ease-gentle)]", index <= current ? "scale-x-100" : "scale-x-0")} />
        </span>
        <span className="sr-only">{index + 1}. {item}</span>
      </li>
    ))}
  </ol>
));
FormProgress.displayName = "FormProgress";
