"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { authHeader } from "@/lib/api-client";

export function OrgOnboardingForm() {
  const toast = useToast();
  const [orgId, setOrgId] = useState<string | null>(null);
  const [orgName, setOrgName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    companyName: "",
    acn: "",
    abn: "",
    registrationState: "NSW",
    addressLine1: "",
    city: "",
    state: "NSW",
    postcode: "",
    email: "",
    ownerFirstName: "",
    ownerLastName: "",
    ownerMobile: "",
    ownerDob: "",
  });

  useEffect(() => {
    (async () => {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;
      const { data: profile } = await supabase.from("profiles").select("org_id").eq("id", user.id).single();
      setOrgId(profile?.org_id || null);
    })();
  }, []);

  async function createOrg(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    const headers = { "Content-Type": "application/json", ...(await authHeader()) };
    const res = await fetch("/api/manager/organisation", { method: "POST", headers, body: JSON.stringify({ name: orgName }) });
    const data = await res.json();
    setSubmitting(false);
    if (!res.ok) return toast.show(data.error || "Could not create organisation", "error");
    setOrgId(data.orgId);
  }

  async function submitKyb(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    const headers = { "Content-Type": "application/json", ...(await authHeader()) };
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const res = await fetch("/api/onboarding/enterprise", {
      method: "POST",
      headers,
      body: JSON.stringify({
        supabaseOrgId: orgId,
        adminSupabaseUserId: user?.id,
        companyName: form.companyName,
        acn: form.acn,
        abn: form.abn,
        registrationState: form.registrationState,
        addressLine1: form.addressLine1,
        city: form.city,
        state: form.state,
        postcode: form.postcode,
        email: form.email,
        beneficialOwners: [
          { firstName: form.ownerFirstName, lastName: form.ownerLastName, email: form.email, mobile: form.ownerMobile, dob: form.ownerDob },
        ],
      }),
    });
    const data = await res.json();
    setSubmitting(false);
    if (!res.ok) return toast.show(data.error || "Could not submit verification", "error");
    toast.show("Organisation verification submitted", "success");
  }

  if (!orgId) {
    return (
      <form onSubmit={createOrg} className="mx-auto flex max-w-md flex-col gap-4 px-4 py-6">
        <h1 className="text-xl font-bold text-crew-ink">Create your organisation</h1>
        <Input label="Organisation name" required value={orgName} onChange={(e) => setOrgName(e.target.value)} />
        <Button type="submit" disabled={submitting}>
          {submitting ? "Creating..." : "Continue"}
        </Button>
      </form>
    );
  }

  return (
    <form onSubmit={submitKyb} className="mx-auto flex max-w-md flex-col gap-4 px-4 py-6">
      <h1 className="text-xl font-bold text-crew-ink">Organisation verification</h1>
      <Input label="Company name" required value={form.companyName} onChange={(e) => setForm({ ...form, companyName: e.target.value })} />
      <div className="grid grid-cols-2 gap-3">
        <Input label="ACN" required maxLength={9} value={form.acn} onChange={(e) => setForm({ ...form, acn: e.target.value })} />
        <Input label="ABN" required maxLength={11} value={form.abn} onChange={(e) => setForm({ ...form, abn: e.target.value })} />
      </div>
      <Input label="Registered address" required value={form.addressLine1} onChange={(e) => setForm({ ...form, addressLine1: e.target.value })} />
      <div className="grid grid-cols-2 gap-3">
        <Input label="City" required value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} />
        <Input label="Postcode" required maxLength={4} value={form.postcode} onChange={(e) => setForm({ ...form, postcode: e.target.value })} />
      </div>
      <Input label="Company email" type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />

      <p className="mt-2 text-sm font-semibold text-crew-ink">Primary beneficial owner</p>
      <div className="grid grid-cols-2 gap-3">
        <Input label="First name" required value={form.ownerFirstName} onChange={(e) => setForm({ ...form, ownerFirstName: e.target.value })} />
        <Input label="Last name" required value={form.ownerLastName} onChange={(e) => setForm({ ...form, ownerLastName: e.target.value })} />
      </div>
      <Input label="Mobile" required value={form.ownerMobile} onChange={(e) => setForm({ ...form, ownerMobile: e.target.value })} />
      <Input label="Date of birth" type="date" required value={form.ownerDob} onChange={(e) => setForm({ ...form, ownerDob: e.target.value })} />

      <Button type="submit" disabled={submitting}>
        {submitting ? "Submitting..." : "Submit for verification"}
      </Button>
    </form>
  );
}
