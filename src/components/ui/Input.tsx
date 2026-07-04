import { forwardRef, useId } from "react";
import { cn } from "@/lib/cn";

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
  hint?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, error, hint, id, ...props }, ref) => {
    const generatedId = useId();
    const inputId = id ?? generatedId;
    const hintId = hint ? `${inputId}-hint` : undefined;
    const errorId = error ? `${inputId}-error` : undefined;

    return (
      <div className="flex flex-col gap-1.5">
        <label htmlFor={inputId} className="text-sm font-medium text-crew-ink">
          {label}
        </label>
        <input
          ref={ref}
          id={inputId}
          aria-invalid={!!error}
          aria-describedby={cn(hintId, errorId) || undefined}
          className={cn(
            "rounded-lg border border-neutral-300 bg-white px-3.5 py-2.5 text-sm text-crew-ink",
            "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-crew-green-light",
            error && "border-crew-red",
            className,
          )}
          {...props}
        />
        {hint && !error && (
          <p id={hintId} className="text-xs text-neutral-500">
            {hint}
          </p>
        )}
        {error && (
          <p id={errorId} className="text-xs text-crew-red" role="alert">
            {error}
          </p>
        )}
      </div>
    );
  },
);
Input.displayName = "Input";
