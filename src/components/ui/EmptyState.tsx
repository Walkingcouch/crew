import type { ReactNode } from "react";

export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-xl2 border border-dashed border-neutral-300 px-6 py-12 text-center">
      {icon && <div className="mb-2 text-4xl" aria-hidden="true">{icon}</div>}
      <p className="text-base font-semibold text-crew-ink">{title}</p>
      {description && <p className="max-w-sm text-sm text-neutral-500">{description}</p>}
      {action && <div className="mt-3">{action}</div>}
    </div>
  );
}
