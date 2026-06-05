import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from "react";
import { cn } from "@/lib/utils/cn";

const FIELD =
  "w-full rounded-lg border bg-surface/60 px-3 py-1.5 text-sm text-foreground placeholder:text-muted-2 backdrop-blur-sm transition-[border-color,box-shadow,background-color] disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring/30 focus-visible:border-ring focus-visible:bg-surface";

function ring(invalid?: boolean): string {
  return invalid
    ? "border-danger focus-visible:ring-danger/30 focus-visible:border-danger"
    : "border-border-strong hover:border-border-strong hover:bg-surface";
}

export interface FieldProps {
  invalid?: boolean;
}

export function Input({ className, invalid, ...props }: InputHTMLAttributes<HTMLInputElement> & FieldProps) {
  return <input className={cn(FIELD, ring(invalid), "h-9", className)} aria-invalid={invalid} {...props} />;
}

export function Textarea({
  className,
  invalid,
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement> & FieldProps) {
  return <textarea className={cn(FIELD, ring(invalid), "min-h-20", className)} aria-invalid={invalid} {...props} />;
}

export function Select({
  className,
  invalid,
  children,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement> & FieldProps) {
  return (
    <select className={cn(FIELD, ring(invalid), "h-9", className)} aria-invalid={invalid} {...props}>
      {children}
    </select>
  );
}

export function Label({
  htmlFor,
  required,
  children,
}: {
  htmlFor?: string;
  required?: boolean;
  children: ReactNode;
}) {
  return (
    <label htmlFor={htmlFor} className="mb-1 block text-xs font-medium text-muted">
      {children}
      {required && <span className="ml-0.5 text-danger">*</span>}
    </label>
  );
}
