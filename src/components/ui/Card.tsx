import { cn } from "@/lib/cn";

export function Card({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "rounded-xl2 border border-neutral-200 bg-white p-4 shadow-sm",
        className,
      )}
      {...props}
    />
  );
}
