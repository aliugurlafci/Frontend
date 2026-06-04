"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { apiFetch, ApiRequestError } from "@/lib/api-client";
import { useI18n } from "@/lib/i18n/context";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Label, Select } from "@/components/ui/input";

const TIMEZONES = [
  "UTC", "Europe/Istanbul", "Europe/London", "Europe/Berlin",
  "America/New_York", "America/Chicago", "America/Los_Angeles",
  "Asia/Dubai", "Asia/Singapore", "Australia/Sydney",
];

export function ProfileForm({
  initial,
}: {
  initial: { displayName: string; email: string; phone: string; timezone: string };
}) {
  const router = useRouter();
  const { t } = useI18n();
  const [displayName, setDisplayName] = useState(initial.displayName);
  const [email, setEmail] = useState(initial.email);
  const [phone, setPhone] = useState(initial.phone);
  const [timezone, setTimezone] = useState(initial.timezone || "UTC");
  const [busy, setBusy] = useState(false);

  const initials =
    displayName.split(/\s+/).map((p) => p[0]).filter(Boolean).slice(0, 2).join("").toUpperCase() || "U";

  async function save() {
    if (!displayName.trim() || !email.trim()) {
      toast.error("Name and email are required");
      return;
    }
    setBusy(true);
    try {
      await apiFetch("/auth/profile", { method: "PATCH", body: { displayName, email, phone, timezone } });
      toast.success("Profile saved");
      router.refresh();
    } catch (e) {
      toast.error(e instanceof ApiRequestError ? e.message : "Save failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardHeader title="Profile" />
      <CardBody className="space-y-4">
        <div className="flex items-center gap-4">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary text-lg font-semibold text-primary-foreground">
            {initials}
          </div>
          <p className="text-xs text-muted">Your avatar uses your initials.</p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="name">Full name</Label>
            <Input id="name" value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="Jane Doe" />
          </div>
          <div>
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="jane@example.com" />
          </div>
          <div>
            <Label htmlFor="phone">Phone</Label>
            <Input id="phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+90 555 000 0000" />
          </div>
          <div>
            <Label htmlFor="timezone">Timezone</Label>
            <Select id="timezone" value={timezone} onChange={(e) => setTimezone(e.target.value)}>
              {TIMEZONES.map((tz) => (
                <option key={tz} value={tz}>
                  {tz}
                </option>
              ))}
            </Select>
          </div>
        </div>

        <div className="flex justify-end">
          <Button variant="primary" loading={busy} onClick={save}>
            {t("common.save")}
          </Button>
        </div>
      </CardBody>
    </Card>
  );
}
