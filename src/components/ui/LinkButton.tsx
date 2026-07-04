import Link, { type LinkProps } from "next/link";
import { cn } from "@/lib/cn";

type ButtonVariant = "primary" | "secondary" | "ghost" | "destructive";
type ButtonSize = "sm" | "md" | "lg";

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary: "bg-crew-green text-white hover:bg-crew-green-light",
  secondary: "bg-white text-crew-ink border border-neutral-300 hover:bg-neutral-50",
  ghost: "bg-transparent text-crew-ink hover:bg-neutral-100",
  destructive: "bg-crew-red text-white hover:bg-red-700",
};

const SIZE_CLASSES: Record<ButtonSize, string> = {
  sm: "px-3 py-1.5 text-sm",
  md: "px-4 py-2.5 text-sm",
  lg: "px-6 py-3.5 text-base",
};

/** Button-styled Link, for navigation CTAs. Use Button for actions
 * (form submit, mutations); use LinkButton for navigation. */
export function LinkButton({
  variant = "primary",
  size = "md",
  className,
  children,
  ...props
}: LinkProps & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-full font-semibold transition-colors",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-crew-green-light",
        VARIANT_CLASSES[variant],
        SIZE_CLASSES[size],
        className,
      )}
      {...props}
    >
      {children}
    </Link>
  );
}
