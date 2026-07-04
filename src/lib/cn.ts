type ClassValue = string | number | null | undefined | false | ClassValue[];

function flatten(value: ClassValue, out: string[]): void {
  if (!value && value !== 0) return;
  if (Array.isArray(value)) {
    for (const item of value) flatten(item, out);
    return;
  }
  out.push(String(value));
}

/** Minimal classnames joiner: no conflict resolution (no tailwind-merge),
 * just filters falsy values and flattens arrays. Kept dependency-free. */
export function cn(...values: ClassValue[]): string {
  const out: string[] = [];
  for (const value of values) flatten(value, out);
  return out.join(" ");
}
