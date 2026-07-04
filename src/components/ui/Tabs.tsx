"use client";

import { useState, type ReactNode } from "react";
import { cn } from "@/lib/cn";

export interface TabItem {
  id: string;
  label: string;
  content: ReactNode;
}

/** ARIA tabs: role="tablist"/"tab"/"tabpanel", arrow-key navigation,
 * only the active tab is in the tab order (roving tabindex). */
export function Tabs({
  items,
  defaultTabId,
  className,
}: {
  items: TabItem[];
  defaultTabId?: string;
  className?: string;
}) {
  const [activeId, setActiveId] = useState(defaultTabId ?? items[0]?.id);

  function onKeyDown(e: React.KeyboardEvent, index: number) {
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
    e.preventDefault();
    const delta = e.key === "ArrowRight" ? 1 : -1;
    const nextIndex = (index + delta + items.length) % items.length;
    const next = items[nextIndex];
    if (!next) return;
    setActiveId(next.id);
    document.getElementById(`tab-${next.id}`)?.focus();
  }

  const active = items.find((item) => item.id === activeId);

  return (
    <div className={className}>
      <div role="tablist" className="flex gap-1 border-b border-neutral-200">
        {items.map((item, index) => {
          const selected = item.id === activeId;
          return (
            <button
              key={item.id}
              id={`tab-${item.id}`}
              role="tab"
              type="button"
              aria-selected={selected}
              aria-controls={`panel-${item.id}`}
              tabIndex={selected ? 0 : -1}
              onClick={() => setActiveId(item.id)}
              onKeyDown={(e) => onKeyDown(e, index)}
              className={cn(
                "px-4 py-2.5 text-sm font-semibold border-b-2 -mb-px",
                selected
                  ? "border-crew-green text-crew-green"
                  : "border-transparent text-neutral-500 hover:text-crew-ink",
              )}
            >
              {item.label}
            </button>
          );
        })}
      </div>
      {active && (
        <div
          id={`panel-${active.id}`}
          role="tabpanel"
          aria-labelledby={`tab-${active.id}`}
          tabIndex={0}
          className="pt-4"
        >
          {active.content}
        </div>
      )}
    </div>
  );
}
