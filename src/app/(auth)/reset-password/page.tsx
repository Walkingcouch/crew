import type { Metadata } from "next";
import { ResetPasswordForm } from "./ResetPasswordForm";

export const metadata: Metadata = {
  title: "Reset your password",
};

export default function ResetPasswordPage() {
  return <ResetPasswordForm />;
}
