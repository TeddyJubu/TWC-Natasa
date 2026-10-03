import * as React from "react";
import { cn } from "../lib/utils";

const field =
  "w-full rounded-soft border border-line bg-paper px-4 font-sans text-ink placeholder:text-ink-muted/70 transition-colors focus-visible:border-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30 disabled:opacity-50 aria-[invalid=true]:border-danger";

export interface LabelProps extends React.LabelHTMLAttributes<HTMLLabelElement> {}
export const Label = React.forwardRef<HTMLLabelElement, LabelProps>(({ className, ...p }, ref) => (
  <label ref={ref} className={cn("text-xs uppercase tracking-[0.18em] text-ink-muted", className)} {...p} />
));
Label.displayName = "Label";

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {}
export const Input = React.forwardRef<HTMLInputElement, InputProps>(({ className, ...p }, ref) => (
  <input ref={ref} className={cn(field, "h-12", className)} {...p} />
));
Input.displayName = "Input";

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {}
export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(({ className, ...p }, ref) => (
  <textarea ref={ref} className={cn(field, "min-h-28 py-3", className)} {...p} />
));
Textarea.displayName = "Textarea";

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {}
export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(({ className, ...p }, ref) => (
  <select ref={ref} className={cn(field, "h-12 appearance-none bg-[length:12px] bg-[right_1rem_center] bg-no-repeat pr-10", className)} {...p} />
));
Select.displayName = "Select";

export interface CheckboxProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "type"> { label: React.ReactNode }
export const Checkbox = React.forwardRef<HTMLInputElement, CheckboxProps>(({ className, label, id, ...p }, ref) => {
  const auto = React.useId();
  const cid = id ?? auto;
  return (
    <label htmlFor={cid} className={cn("inline-flex cursor-pointer items-center gap-3 text-sm text-ink", className)}>
      <input ref={ref} id={cid} type="checkbox" className="size-4 accent-[var(--ks-accent)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring" {...p} />
      {label}
    </label>
  );
});
Checkbox.displayName = "Checkbox";

export interface RadioGroupProps extends Omit<React.FieldsetHTMLAttributes<HTMLFieldSetElement>, "onChange"> {
  name: string;
  legend: React.ReactNode;
  options: { value: string; label: string }[];
  value?: string;
  defaultValue?: string;
  onValueChange?: (v: string) => void;
}
export const RadioGroup = React.forwardRef<HTMLFieldSetElement, RadioGroupProps>(
  ({ className, name, legend, options, value, defaultValue, onValueChange, ...p }, ref) => (
    <fieldset ref={ref} className={cn("flex flex-col gap-3", className)} {...p}>
      <legend className="mb-3 text-xs uppercase tracking-[0.18em] text-ink-muted">{legend}</legend>
      <div className="flex flex-wrap gap-3">
        {options.map((o) => (
          <label key={o.value} className="cursor-pointer">
            <input
              type="radio"
              name={name}
              value={o.value}
              className="peer sr-only"
              {...(value !== undefined ? { checked: value === o.value } : { defaultChecked: defaultValue === o.value })}
              onChange={() => onValueChange?.(o.value)}
            />
            <span className="inline-flex h-10 items-center rounded-full border border-line px-5 text-sm text-ink transition-colors peer-checked:border-ink peer-checked:bg-ink peer-checked:text-paper peer-focus-visible:ring-2 peer-focus-visible:ring-ring">
              {o.label}
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  ),
);
RadioGroup.displayName = "RadioGroup";

export interface FormFieldProps extends React.HTMLAttributes<HTMLDivElement> {
  label: string;
  htmlFor: string;
  hint?: string;
  error?: string;
}
export const FormField = React.forwardRef<HTMLDivElement, FormFieldProps>(
  ({ className, label, htmlFor, hint, error, children, ...p }, ref) => (
    <div ref={ref} className={cn("flex flex-col gap-2", className)} {...p}>
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
      {error ? <p role="alert" className="text-sm text-danger">{error}</p> : hint ? <p className="text-sm text-ink-muted">{hint}</p> : null}
    </div>
  ),
);
FormField.displayName = "FormField";
