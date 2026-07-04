"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { useToast } from "@/components/ui/Toast";
import { authHeader } from "@/lib/api-client";

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const MAX_POSTCODES = 50;

interface Slot {
  weekday: number;
  startTime: string;
  endTime: string;
}

export function AvailabilityView() {
  const toast = useToast();
  const [slots, setSlots] = useState<Slot[]>([]);
  const [postcodes, setPostcodes] = useState<string[]>([]);
  const [postcodeInput, setPostcodeInput] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      const headers = await authHeader();
      const [availRes, areasRes] = await Promise.all([
        fetch("/api/availability", { headers }),
        fetch("/api/service-areas", { headers }),
      ]);
      const availData = await availRes.json();
      const areasData = await areasRes.json();
      setSlots(
        (availData.weekly || []).map((s: { weekday: number; start_time: string; end_time: string }) => ({
          weekday: s.weekday,
          startTime: s.start_time.slice(0, 5),
          endTime: s.end_time.slice(0, 5),
        })),
      );
      setPostcodes(areasData.postcodes || []);
    })();
  }, []);

  function toggleDay(weekday: number) {
    setSlots((prev) => {
      const existing = prev.find((s) => s.weekday === weekday);
      if (existing) return prev.filter((s) => s.weekday !== weekday);
      return [...prev, { weekday, startTime: "08:00", endTime: "17:00" }];
    });
  }

  function updateSlotTime(weekday: number, field: "startTime" | "endTime", value: string) {
    setSlots((prev) => prev.map((s) => (s.weekday === weekday ? { ...s, [field]: value } : s)));
  }

  function addPostcode() {
    const trimmed = postcodeInput.trim();
    if (!/^\d{4}$/.test(trimmed)) return toast.show("Enter a valid 4-digit postcode", "error");
    if (postcodes.length >= MAX_POSTCODES) return toast.show(`Maximum ${MAX_POSTCODES} postcodes`, "error");
    if (postcodes.includes(trimmed)) return;
    setPostcodes((prev) => [...prev, trimmed]);
    setPostcodeInput("");
  }

  async function saveAll() {
    setSaving(true);
    const headers = { "Content-Type": "application/json", ...(await authHeader()) };
    await Promise.all([
      fetch("/api/availability", { method: "PUT", headers, body: JSON.stringify({ slots }) }),
      fetch("/api/service-areas", { method: "PUT", headers, body: JSON.stringify({ postcodes }) }),
    ]);
    setSaving(false);
    toast.show("Availability and service areas saved", "success");
  }

  return (
    <div className="mx-auto max-w-xl px-4 py-6">
      <h1 className="mb-4 text-xl font-bold text-crew-ink">Availability</h1>

      <Card className="mb-4">
        <p className="mb-3 text-sm font-semibold text-crew-ink">Weekly hours</p>
        <div className="flex flex-col gap-2">
          {WEEKDAYS.map((day, weekday) => {
            const slot = slots.find((s) => s.weekday === weekday);
            return (
              <div key={day} className="flex items-center gap-2">
                <label className="flex w-28 items-center gap-2 text-sm">
                  <input type="checkbox" checked={!!slot} onChange={() => toggleDay(weekday)} className="accent-crew-green" />
                  {day}
                </label>
                {slot && (
                  <>
                    <input
                      type="time"
                      value={slot.startTime}
                      onChange={(e) => updateSlotTime(weekday, "startTime", e.target.value)}
                      className="rounded border border-neutral-300 px-2 py-1 text-xs"
                    />
                    <span className="text-xs text-neutral-400">to</span>
                    <input
                      type="time"
                      value={slot.endTime}
                      onChange={(e) => updateSlotTime(weekday, "endTime", e.target.value)}
                      className="rounded border border-neutral-300 px-2 py-1 text-xs"
                    />
                  </>
                )}
              </div>
            );
          })}
        </div>
      </Card>

      <Card className="mb-4">
        <p className="mb-3 text-sm font-semibold text-crew-ink">Service areas ({postcodes.length}/{MAX_POSTCODES})</p>
        <div className="mb-3 flex flex-wrap gap-2">
          {postcodes.map((pc) => (
            <span key={pc} className="flex items-center gap-1 rounded-full bg-crew-green/10 px-3 py-1 text-xs font-medium text-crew-green">
              {pc}
              <button type="button" onClick={() => setPostcodes((prev) => prev.filter((p) => p !== pc))} aria-label={`Remove ${pc}`}>
                ×
              </button>
            </span>
          ))}
        </div>
        <div className="flex gap-2">
          <Input label="Add postcode" value={postcodeInput} onChange={(e) => setPostcodeInput(e.target.value)} maxLength={4} />
          <Button size="sm" onClick={addPostcode} className="mt-6">
            Add
          </Button>
        </div>
      </Card>

      <Button disabled={saving} onClick={saveAll}>
        {saving ? "Saving..." : "Save"}
      </Button>
    </div>
  );
}
