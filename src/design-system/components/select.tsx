import * as React from "react";
import {
  Select as SelectRoot, SelectContent, SelectGroup, SelectGroupLabel, SelectItem, SelectItemIndicator, SelectTrigger, SelectValue, type ListData,
} from "@ui-sdk/react/select";
import type { VariantProps } from "class-variance-authority";
import { cn } from "../lib/utils";
import { fieldVariants } from "./field-variants";

type SelectOption = { value: string; label: string; disabled?: boolean };
type SelectOptionGroup = { label?: string; options: SelectOption[] };

// ui-sdk has no empty item value, so a native `<option value="">` becomes this item and maps back to "".
const EMPTY_OPTION = "__empty__";
const toItem = (value: string) => (value === "" ? EMPTY_OPTION : value);

/** Reads native `<option>`/`<optgroup>` children, so call sites keep the markup they already have. */
function readOptions(children: React.ReactNode): SelectOptionGroup[] {
  const groups: SelectOptionGroup[] = [{ options: [] }];
  const walk = (nodes: React.ReactNode, into: SelectOptionGroup) => {
    React.Children.forEach(nodes, (node) => {
      if (!React.isValidElement<{ children?: React.ReactNode; value?: string | number; label?: string; disabled?: boolean }>(node)) return;
      if (node.type === React.Fragment) walk(node.props.children, into);
      else if (node.type === "optgroup") {
        const group: SelectOptionGroup = { label: node.props.label, options: [] };
        groups.push(group);
        walk(node.props.children, group);
      } else if (node.type === "option") {
        const label = React.Children.toArray(node.props.children).join("");
        into.options.push({ value: String(node.props.value ?? label), label, disabled: node.props.disabled });
      }
    });
  };
  walk(children, groups[0]!);
  return groups.filter((g) => g.options.length > 0);
}

const selectItems = (groups: SelectOptionGroup[]): ListData => groups.flatMap<ListData[number]>((g) => {
  const items = g.options.map((o) => ({ value: toItem(o.value), label: o.label, disabled: o.disabled }));
  return g.label ? [{ type: "group", label: g.label, items }] : items;
});

function SelectPopup({ groups }: { groups: SelectOptionGroup[] }) {
  const item = (o: SelectOption) => (
    <SelectItem key={o.value} value={toItem(o.value)} label={o.label} disabled={o.disabled} data-value={o.value} className="flex min-h-10 cursor-pointer items-center justify-between gap-3 rounded-[8px] px-3 py-2 text-[15px] outline-none data-disabled:cursor-not-allowed data-disabled:opacity-50 data-highlighted:bg-ink/10 data-selected:font-semibold">
      {o.label}
      <SelectItemIndicator className="shrink-0">
        <svg viewBox="0 0 24 24" aria-hidden className="size-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m5 12 5 5L20 7" /></svg>
      </SelectItemIndicator>
    </SelectItem>
  );
  return (
    <SelectContent sideOffset={4} className="max-h-[min(20rem,var(--available-height))] min-w-(--anchor-width) overflow-y-auto rounded-control border border-line bg-canvas p-1 text-ink shadow-soft">
      {groups.map((g) => g.label
        ? <SelectGroup key={g.label}><SelectGroupLabel className="px-3 pt-2 pb-1 text-xs font-medium text-ink-muted">{g.label}</SelectGroupLabel>{g.options.map(item)}</SelectGroup>
        : g.options.map(item))}
    </SelectContent>
  );
}

const selectTrigger = "flex items-center justify-between gap-2 text-left data-placeholder:text-ink-muted";
const SelectChevron = () => (
  <svg viewBox="0 0 24 24" aria-hidden className="size-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6" /></svg>
);

interface SelectControlBase {
  id?: string; name?: string; form?: string; className?: string; required?: boolean; disabled?: boolean; children?: React.ReactNode;
  "aria-describedby"?: string; "aria-invalid"?: React.AriaAttributes["aria-invalid"]; "aria-label"?: string;
}
export interface SelectControlProps extends SelectControlBase {
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
}

/**
 * A ui-sdk Select taking native `<option>` children, styled by `className`. `""` stays a real answer: it shows as the
 * placeholder and, in a form, submits an empty value just as a native select does.
 */
export function SelectControl({ id, name, form, className, required, disabled, value, defaultValue, onValueChange, children, ...aria }: SelectControlProps) {
  const groups = readOptions(children);
  const options = groups.flatMap((g) => g.options);
  const [own, setOwn] = React.useState(defaultValue ?? options[0]?.value ?? "");
  const current = value ?? own;
  return (
    <SelectRoot
      items={selectItems(groups)} value={current === "" ? null : current} placeholder={options.find((o) => o.value === "")?.label}
      name={name} form={form} required={required} disabled={disabled}
      onValueChange={(next) => {
        const chosen = next === null || next === EMPTY_OPTION ? "" : String(next);
        setOwn(chosen);
        onValueChange?.(chosen);
      }}
    >
      <SelectTrigger id={id} className={cn(selectTrigger, className)} {...aria}><SelectValue /><SelectChevron /></SelectTrigger>
      <SelectPopup groups={groups} />
      {name && !required && current === "" && <input type="hidden" name={name} form={form} value="" />}
    </SelectRoot>
  );
}

export interface MultiSelectControlProps extends SelectControlBase {
  value: string[];
  onValueChange: (value: string[]) => void;
  placeholder?: string;
}
/** The several-answers version of `SelectControl`. */
export function MultiSelectControl({ id, name, form, className, required, disabled, value, onValueChange, placeholder = "Choose…", children, ...aria }: MultiSelectControlProps) {
  const groups = readOptions(children);
  return (
    <SelectRoot multiple items={selectItems(groups)} value={value} placeholder={placeholder} name={name} form={form} required={required} disabled={disabled} onValueChange={(next) => onValueChange(next.map(String))}>
      <SelectTrigger id={id} className={cn(selectTrigger, className)} {...aria}><SelectValue /><SelectChevron /></SelectTrigger>
      <SelectPopup groups={groups} />
    </SelectRoot>
  );
}

export interface SelectProps extends SelectControlProps, VariantProps<typeof fieldVariants> {}
export function Select({ className, variant, ...p }: SelectProps) {
  return <SelectControl className={cn(fieldVariants({ variant }), "h-field cursor-pointer", className)} {...p} />;
}
