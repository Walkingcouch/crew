import { cn } from "@/lib/cn";

type BadgeTone = "neutral" | "success" | "warning" | "danger" | "info";

const TONE_CLASSES: Record<BadgeTone, string> = {
  neutral: "bg-neutral-100 text-neutral-700",
  success: "bg-green-100 text-crew-green",
  warning: "bg-amber-100 text-crew-amber",
  danger: "bg-red-100 text-crew-red",
  info: "bg-blue-100 text-blue-700",
};

export function Badge({
  tone = "neutral",
  className,
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & { tone?: BadgeTone }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold",
        TONE_CLASSES[tone],
        className,
      )}
      {...props}
    />
  );
}

/** Maps an escrow_state value (payments/escrow.js STATES) to a Badge tone
 * and Australian-English label. Escrow states are the one enum that must
 * never drift from payments/escrow.js, kept in one place here. */
const ESCROW_STATE_LABELS: Record<string, { label: string; tone: BadgeTone }> = {
  CREATED: { label: "Created", tone: "neutral" },
  PAYMENT_PENDING: { label: "Awaiting payment", tone: "warning" },
  PAYMENT_HELD: { label: "Funds secured in trust", tone: "success" },
  DISPUTABLE: { label: "Awaiting confirmation", tone: "info" },
  RELEASING: { label: "Releasing", tone: "info" },
  RELEASED: { label: "Released", tone: "success" },
  DISPUTED: { label: "Disputed", tone: "danger" },
  REFUNDED: { label: "Refunded", tone: "neutral" },
  CANCELLED: { label: "Cancelled", tone: "neutral" },
};

export function EscrowStateBadge({ state }: { state: string }) {
  const entry = ESCROW_STATE_LABELS[state] ?? { label: state, tone: "neutral" as const };
  return <Badge tone={entry.tone}>{entry.label}</Badge>;
}
