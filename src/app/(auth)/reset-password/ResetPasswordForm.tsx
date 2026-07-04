"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { useToast } from "@/components/ui/Toast";

export function ResetPasswordForm() {
  const router = useRouter();
  const toast = useToast();
  const supabase = createClient();
  const [ready, setReady] = useState(false);
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") setReady(true);
    });
    return () => subscription.unsubscribe();
  }, [supabase]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 10) {
      setError("Password must be at least 10 characters");
      return;
    }
    setLoading(true);
    const { error: updateError } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (updateError) {
      setError(updateError.message);
      return;
    }
    toast.show("Password updated. Please sign in again.", "success");
    router.push("/login");
  }

  if (!ready) {
    return <p className="text-sm text-neutral-500">Verifying your reset link...</p>;
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <h1 className="text-xl font-bold text-crew-ink">Set a new password</h1>
      <Input
        label="New password"
        type="password"
        required
        minLength={10}
        hint="At least 10 characters"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        error={error}
      />
      <Button type="submit" disabled={loading}>
        {loading ? "Updating..." : "Update password"}
      </Button>
    </form>
  );
}
