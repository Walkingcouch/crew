"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { authHeader } from "@/lib/api-client";

export function OnboardingForm() {
  const router = useRouter();
  const toast = useToast();
  const [step, setStep] = useState<"kyc" | "bank">("kyc");
  const [submitting, setSubmitting] = useState(false);
  const [kyc, setKyc] = useState({
    firstName: "",
    lastName: "",
    mobile: "",
    dob: "",
    abn: "",
    addressLine1: "",
    city: "",
    state: "NSW",
    postcode: "",
  });
  const [bank, setBank] = useState({ accountName: "", bsb: "", accountNumber: "" });

  async function submitKyc(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    const headers = { "Content-Type": "application/json", ...(await authHeader()) };
    const res = await fetch("/api/onboarding/sole-trader", { method: "POST", headers, body: JSON.stringify(kyc) });
    const data = await res.json();
    setSubmitting(false);
    if (!res.ok) return toast.show(data.error || "Could not submit details", "error");
    toast.show("Details submitted. Add your bank account next.", "success");
    setStep("bank");
  }

  async function submitBank(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    const headers = { "Content-Type": "application/json", ...(await authHeader()) };
    const res = await fetch("/api/onboarding/bank-account", { method: "POST", headers, body: JSON.stringify(bank) });
    const data = await res.json();
    setSubmitting(false);
    if (!res.ok) return toast.show(data.error || "Could not add bank account", "error");
    toast.show("Bank account added. You are ready to take jobs.", "success");
    router.push("/pro");
  }

  if (step === "bank") {
    return (
      <form onSubmit={submitBank} className="mx-auto flex max-w-md flex-col gap-4 px-4 py-6">
        <h1 className="text-xl font-bold text-crew-ink">Payout bank account</h1>
        <Input label="Account name" required value={bank.accountName} onChange={(e) => setBank({ ...bank, accountName: e.target.value })} />
        <Input label="BSB" required maxLength={7} value={bank.bsb} onChange={(e) => setBank({ ...bank, bsb: e.target.value })} />
        <Input
          label="Account number"
          required
          value={bank.accountNumber}
          onChange={(e) => setBank({ ...bank, accountNumber: e.target.value })}
        />
        <Button type="submit" disabled={submitting}>
          {submitting ? "Saving..." : "Finish"}
        </Button>
      </form>
    );
  }

  return (
    <form onSubmit={submitKyc} className="mx-auto flex max-w-md flex-col gap-4 px-4 py-6">
      <h1 className="text-xl font-bold text-crew-ink">Verify your details</h1>
      <p className="text-sm text-neutral-500">
        Crew verifies every contractor&apos;s identity and ABN before you can accept jobs, held securely by CheckVault.
      </p>
      <div className="grid grid-cols-2 gap-3">
        <Input label="First name" required value={kyc.firstName} onChange={(e) => setKyc({ ...kyc, firstName: e.target.value })} />
        <Input label="Last name" required value={kyc.lastName} onChange={(e) => setKyc({ ...kyc, lastName: e.target.value })} />
      </div>
      <Input label="Mobile" required value={kyc.mobile} onChange={(e) => setKyc({ ...kyc, mobile: e.target.value })} />
      <Input label="Date of birth" type="date" required value={kyc.dob} onChange={(e) => setKyc({ ...kyc, dob: e.target.value })} />
      <Input label="ABN" required maxLength={11} value={kyc.abn} onChange={(e) => setKyc({ ...kyc, abn: e.target.value })} />
      <Input label="Address" required value={kyc.addressLine1} onChange={(e) => setKyc({ ...kyc, addressLine1: e.target.value })} />
      <div className="grid grid-cols-2 gap-3">
        <Input label="City" required value={kyc.city} onChange={(e) => setKyc({ ...kyc, city: e.target.value })} />
        <Input label="Postcode" required maxLength={4} value={kyc.postcode} onChange={(e) => setKyc({ ...kyc, postcode: e.target.value })} />
      </div>
      <Button type="submit" disabled={submitting}>
        {submitting ? "Submitting..." : "Continue"}
      </Button>
    </form>
  );
}
