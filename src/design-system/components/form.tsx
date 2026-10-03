import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../lib/utils";

const fieldVariants = cva(
  "peer w-full font-sans text-base text-ink placeholder:text-ink-faint transition-[border-color,background-color,box-shadow] duration-300 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50 aria-[invalid=true]:border-danger aria-[invalid=true]:focus-visible:ring-danger/20",
  {
    variants: {
      variant: {
        editorial: "border-x-0 border-b border-t-0 border-line bg-transparent px-0 focus-visible:border-ink focus-visible:ring-0",
        boxed: "rounded-control border border-line bg-surface px-4 focus-visible:border-sky focus-visible:ring-2 focus-visible:ring-ring/20",
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
    <label htmlFor={cid} className={cn("group inline-flex cursor-pointer items-start gap-3 text-sm text-ink has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-50", className)}>
      <input ref={ref} id={cid} type="checkbox" className="peer sr-only" {...p} />
      <span aria-hidden className="mt-0.5 grid size-5 shrink-0 place-items-center border border-line bg-canvas transition-colors peer-checked:border-ink peer-checked:bg-ink peer-checked:[&>svg]:opacity-100 peer-focus-visible:ring-2 peer-focus-visible:ring-ring peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-canvas">
        <svg viewBox="0 0 16 16" className="size-3 text-canvas opacity-0" fill="none" stroke="currentColor" strokeWidth="2"><path d="m3 8 3 3 7-7" /></svg>
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
  defaultValue?: string;
  onValueChange?: (v: string) => void;
  variant?: "pills" | "list";
}
export const RadioGroup = React.forwardRef<HTMLFieldSetElement, RadioGroupProps>(
  ({ className, name, legend, options, defaultValue, onValueChange, variant = "pills", ...p }, ref) => (
    <fieldset ref={ref} className={cn("flex flex-col", className)} {...p}>
      <legend className="mb-4 font-sans text-xs font-medium uppercase text-ink">{legend}</legend>
      <div className={cn("flex gap-2", variant === "pills" ? "flex-wrap" : "flex-col border-y border-line")}>
        {options.map((o) => (
          <label key={o.value} className={cn("cursor-pointer has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-50", variant === "list" && "border-b border-line last:border-b-0")}>
            <input type="radio" name={name} value={o.value} defaultChecked={defaultValue === o.value} onChange={() => onValueChange?.(o.value)} className="peer sr-only" />
            <span className={cn("inline-flex items-center font-sans text-sm text-ink transition-colors peer-focus-visible:ring-2 peer-focus-visible:ring-ring", variant === "pills" ? "h-11 rounded-full border border-line px-5 peer-checked:border-ink peer-checked:bg-ink peer-checked:text-canvas" : "min-h-field w-full justify-between py-3 peer-checked:font-medium peer-checked:[&>span]:border-ink peer-checked:[&>span]:bg-ink")}>
              {o.label}{variant === "list" && <span aria-hidden className="size-3 rounded-full border border-line peer-checked:border-ink peer-checked:bg-ink" />}
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
export const FormField = React.forwardRef<HTMLDivElement, FormFieldProps>(({ className, label, htmlFor, hint, error, index, optional, children, ...p }, ref) => (
  <div ref={ref} className={cn("flex flex-col gap-2", className)} {...p}>
    <Label htmlFor={htmlFor} index={index} optional={optional}>{label}</Label>
    {children}
    {error ? <p id={`${htmlFor}-error`} role="alert" className="font-sans text-xs text-danger">{error}</p> : hint ? <p id={`${htmlFor}-hint`} className="font-sans text-xs text-ink-muted">{hint}</p> : null}
  </div>
));
FormField.displayName = "FormField";

export interface SwitchProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "type"> {
  label: React.ReactNode;
  description?: React.ReactNode;
}
export const Switch = React.forwardRef<HTMLInputElement, SwitchProps>(({ className, label, description, id, ...p }, ref) => {
  const auto = React.useId();
  const sid = id ?? auto;
  return (
    <label htmlFor={sid} className={cn("flex cursor-pointer items-start justify-between gap-5 border-y border-line py-4 has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-50", className)}>
      <span><span className="block font-sans text-sm text-ink">{label}</span>{description && <span className="mt-1 block font-sans text-xs leading-relaxed text-ink-muted">{description}</span>}</span>
      <input ref={ref} id={sid} type="checkbox" role="switch" className="peer sr-only" {...p} />
      <span aria-hidden className="relative mt-0.5 h-6 w-11 shrink-0 rounded-full bg-surface-strong transition-colors after:absolute after:left-1 after:top-1 after:size-4 after:rounded-full after:bg-ink after:transition-transform peer-checked:bg-ink peer-checked:after:translate-x-5 peer-checked:after:bg-canvas peer-focus-visible:ring-2 peer-focus-visible:ring-ring peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-canvas" />
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
    <label htmlFor={fid} className={cn("group relative flex min-h-field-tall cursor-pointer flex-col items-center justify-center border border-dashed border-line bg-surface px-6 py-8 text-center transition-colors hover:border-ink has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-50", className)}>
      <input ref={ref} id={fid} type="file" className="peer sr-only" {...p} />
      <svg aria-hidden viewBox="0 0 24 24" className="mb-3 size-6 text-ink" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M12 16V4m0 0L7 9m5-5 5 5M4 15v4h16v-4" /></svg>
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
}
export const FormSection = React.forwardRef<HTMLFieldSetElement, FormSectionProps>(({ className, index, title, description, children, ...p }, ref) => (
  <fieldset ref={ref} className={cn("min-w-0 border-t border-line pt-5", className)} {...p}>
    <legend className="sr-only">{title}</legend>
    <div className="mb-10 flex items-start justify-between gap-6">
      <div>{index && <span className="mb-2 block font-sans text-xs font-medium uppercase text-ink-muted">{index}</span>}<h3 className="font-display text-3xl font-normal leading-tight text-ink">{title}</h3></div>
      {description && <p className="max-w-xs font-sans text-xs leading-relaxed text-ink-muted">{description}</p>}
    </div>
    {children}
  </fieldset>
));
FormSection.displayName = "FormSection";

export interface FormActionsProps extends React.HTMLAttributes<HTMLDivElement> {}
export const FormActions = React.forwardRef<HTMLDivElement, FormActionsProps>(({ className, ...p }, ref) => (
  <div ref={ref} className={cn("flex flex-col-reverse gap-3 border-t border-line pt-6 sm:flex-row sm:items-center sm:justify-end", className)} {...p} />
));
FormActions.displayName = "FormActions";
