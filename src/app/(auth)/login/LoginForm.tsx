"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { useToast } from "@/components/ui/Toast";

type Mode = "signin" | "signup";

function passwordStrength(password: string): { label: string; ratio: number } {
  let score = 0;
  if (password.length >= 10) score++;
  if (password.length >= 14) score++;
  if (/[A-Z]/.test(password) && /[a-z]/.test(password)) score++;
  if (/\d/.test(password)) score++;
  if (/[^A-Za-z0-9]/.test(password)) score++;
  const labels = ["Too short", "Weak", "Fair", "Good", "Strong", "Excellent"];
  return { label: labels[score] ?? "Weak", ratio: score / 5 };
}

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const toast = useToast();
  const supabase = createClient();

  const [mode, setMode] = useState<Mode>(searchParams.get("mode") === "signup" ? "signup" : "signin");
  const [role, setRole] = useState<"customer" | "crew_member">(
    searchParams.get("role") === "contractor" ? "crew_member" : "customer",
  );
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [appleEnabled, setAppleEnabled] = useState(false);
  const [loading, setLoading] = useState(false);
  const [forgotMode, setForgotMode] = useState(false);
  const [errors, setErrors] = useState<{ email?: string; password?: string; form?: string }>({});

  useEffect(() => {
    fetch("/api/config")
      .then((res) => res.json())
      .then((config) => setAppleEnabled(!!config.authAppleEnabled))
      .catch(() => {});
  }, []);

  /** The eventual /auth/callback destination, with ?next= carried through
   * as a real query param, not sessionStorage: the callback route runs
   * server-side and can only see what's actually in the URL. Supabase
   * preserves query params on redirectTo through the OAuth round-trip. */
  function callbackUrl() {
    const next = searchParams.get("next");
    const url = new URL("/auth/callback", window.location.origin);
    if (next) url.searchParams.set("next", next);
    return url.toString();
  }

  async function signInWithGoogle() {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: callbackUrl() },
    });
    if (error) toast.show(error.message, "error");
  }

  async function signInWithApple() {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "apple",
      options: { redirectTo: callbackUrl() },
    });
    if (error) toast.show(error.message, "error");
  }

  async function handleForgotPassword(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setLoading(false);
    if (error) {
      toast.show(error.message, "error");
      return;
    }
    toast.show("Check your email for a reset link.", "success");
    setForgotMode(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrors({});

    if (!email.includes("@")) {
      setErrors((prev) => ({ ...prev, email: "Enter a valid email address" }));
      return;
    }
    if (mode === "signup" && password.length < 10) {
      setErrors((prev) => ({ ...prev, password: "Password must be at least 10 characters" }));
      return;
    }

    setLoading(true);

    if (mode === "signup") {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { role, full_name: fullName } },
      });
      setLoading(false);
      if (error) {
        setErrors({ form: error.message });
        return;
      }
      router.push(callbackUrl().replace(window.location.origin, ""));
      return;
    }

    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) {
      setErrors({ form: error.message });
      return;
    }
    router.push(callbackUrl().replace(window.location.origin, ""));
  }

  const strength = mode === "signup" && password ? passwordStrength(password) : null;

  if (forgotMode) {
    return (
      <form onSubmit={handleForgotPassword} className="flex flex-col gap-4">
        <h1 className="text-xl font-bold text-crew-ink">Reset your password</h1>
        <p className="text-sm text-neutral-500">Enter your email and we will send you a reset link.</p>
        <Input label="Email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        <Button type="submit" disabled={loading}>
          {loading ? "Sending..." : "Send reset link"}
        </Button>
        <button type="button" onClick={() => setForgotMode(false)} className="text-sm text-neutral-500 hover:text-crew-green">
          Back to sign in
        </button>
      </form>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <h1 className="text-xl font-bold text-crew-ink">{mode === "signup" ? "Create your account" : "Sign in"}</h1>

      <div className="flex flex-col gap-2">
        <Button variant="secondary" type="button" onClick={signInWithGoogle}>
          Continue with Google
        </Button>
        {appleEnabled && (
          <Button variant="secondary" type="button" onClick={signInWithApple}>
            Continue with Apple
          </Button>
        )}
      </div>

      <div className="flex items-center gap-3 text-xs text-neutral-400">
        <div className="h-px flex-1 bg-neutral-200" />
        or continue with email
        <div className="h-px flex-1 bg-neutral-200" />
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        {mode === "signup" && (
          <>
            <Input label="Full name" required value={fullName} onChange={(e) => setFullName(e.target.value)} />
            <Select label="I am a" value={role} onChange={(e) => setRole(e.target.value as typeof role)}>
              <option value="customer">Customer</option>
              <option value="crew_member">Contractor</option>
            </Select>
          </>
        )}

        <Input
          label="Email"
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          error={errors.email}
        />

        <div>
          <Input
            label="Password"
            type="password"
            required
            minLength={mode === "signup" ? 10 : undefined}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            error={errors.password}
            hint={mode === "signup" ? "At least 10 characters" : undefined}
          />
          {strength && (
            <div className="mt-1.5">
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-neutral-200">
                <div
                  className="h-full rounded-full bg-crew-green-light transition-all"
                  style={{ width: `${strength.ratio * 100}%` }}
                />
              </div>
              <p className="mt-1 text-xs text-neutral-400">{strength.label}</p>
            </div>
          )}
        </div>

        {mode === "signin" && (
          <button
            type="button"
            onClick={() => setForgotMode(true)}
            className="self-end text-xs text-crew-green hover:underline"
          >
            Forgot password?
          </button>
        )}

        {errors.form && (
          <p role="alert" className="text-sm text-crew-red">
            {errors.form}
          </p>
        )}

        <Button type="submit" disabled={loading}>
          {loading ? "Please wait..." : mode === "signup" ? "Create account" : "Sign in"}
        </Button>
      </form>

      <button
        type="button"
        onClick={() => setMode(mode === "signup" ? "signin" : "signup")}
        className="text-center text-sm text-neutral-500 hover:text-crew-green"
      >
        {mode === "signup" ? "Already have an account? Sign in" : "New to Crew? Create an account"}
      </button>
    </div>
  );
}
