import { forwardRef, useId } from "react";
import { cn } from "@/lib/cn";

export interface SelectProps
  extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label: string;
  error?: string;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, label, error, id, children, ...props }, ref) => {
    const generatedId = useId();
    const selectId = id ?? generatedId;

    return (
      <div className="flex flex-col gap-1.5">
        <label htmlFor={selectId} className="text-sm font-medium text-crew-ink">
          {label}
        </label>
        <select
          ref={ref}
          id={selectId}
          aria-invalid={!!error}
          className={cn(
            "rounded-lg border border-neutral-300 bg-white px-3.5 py-2.5 text-sm text-crew-ink",
            "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-crew-green-light",
            error && "border-crew-red",
            className,
          )}
          {...props}
        >
          {children}
        </select>
        {error && (
          <p className="text-xs text-crew-red" role="alert">
            {error}
          </p>
        )}
      </div>
    );
  },
);
Select.displayName = "Select";
