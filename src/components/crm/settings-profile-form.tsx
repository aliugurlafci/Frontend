"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { apiFetch, apiUpload, ApiRequestError } from "@/lib/api-client";
import { useI18n } from "@/lib/i18n/context";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Label, Select, Textarea } from "@/components/ui/input";

const TIMEZONES = [
  "UTC", "Europe/Istanbul", "Europe/London", "Europe/Berlin",
  "America/New_York", "America/Chicago", "America/Los_Angeles",
  "Asia/Dubai", "Asia/Singapore", "Australia/Sydney",
];

/** URL that serves a stored file's bytes inline (for <img>). */
export const avatarUrl = (id: string): string => `/api/v1/files/${encodeURIComponent(id)}/download?inline=1`;

interface ProfileInitial {
  displayName: string;
  email: string;
  phone: string;
  timezone: string;
  avatarId: string;
  jobTitle: string;
  location: string;
  bio: string;
}

export function ProfileForm({ initial }: { initial: ProfileInitial }) {
  const router = useRouter();
  const { t } = useI18n();
  const [displayName, setDisplayName] = useState(initial.displayName);
  const [email, setEmail] = useState(initial.email);
  const [phone, setPhone] = useState(initial.phone);
  const [timezone, setTimezone] = useState(initial.timezone || "UTC");
  const [jobTitle, setJobTitle] = useState(initial.jobTitle);
  const [location, setLocation] = useState(initial.location);
  const [bio, setBio] = useState(initial.bio);
  const [avatarId, setAvatarId] = useState(initial.avatarId);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const initials =
    displayName.split(/\s+/).map((p) => p[0]).filter(Boolean).slice(0, 2).join("").toUpperCase() || "U";

  async function onPickFile(file: File | undefined) {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error(t("settings.profile.avatarType"));
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error(t("settings.profile.avatarSize"));
      return;
    }
    setUploading(true);
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("folder", "avatars");
      const rec = await apiUpload<{ id: string }>("/files/upload", form);
      setAvatarId(rec.id);
    } catch (e) {
      toast.error(e instanceof ApiRequestError ? e.message : t("settings.profile.saveFailed"));
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function save() {
    if (!displayName.trim() || !email.trim()) {
      toast.error(t("settings.profile.errRequired"));
      return;
    }
    setBusy(true);
    try {
      await apiFetch("/auth/profile", {
        method: "PATCH",
        body: { displayName, email, phone, timezone, avatarId, jobTitle, location, bio },
      });
      toast.success(t("settings.profile.saved"));
      router.refresh();
    } catch (e) {
      toast.error(e instanceof ApiRequestError ? e.message : t("settings.profile.saveFailed"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardHeader title={t("settings.profile.cardTitle")} />
      <CardBody className="space-y-5">
        {/* Avatar — shown in full (object-contain) so the whole photo is visible, not cropped. */}
        <div className="flex items-center gap-4">
          <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-xl border border-border bg-surface-2">
            {avatarId ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={avatarUrl(avatarId)} alt={displayName} className="h-full w-full object-contain" />
            ) : (
              <span className="flex h-full w-full items-center justify-center bg-primary text-xl font-semibold text-primary-foreground">{initials}</span>
            )}
          </div>
          <div className="space-y-1.5">
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="secondary" loading={uploading} onClick={() => fileRef.current?.click()}>
                {t("settings.profile.changePhoto")}
              </Button>
              {avatarId && (
                <Button size="sm" variant="ghost" onClick={() => setAvatarId("")}>
                  {t("settings.profile.removePhoto")}
                </Button>
              )}
            </div>
            <p className="text-xs text-muted">{t("settings.profile.avatarHint")}</p>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => onPickFile(e.target.files?.[0])}
            />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="name">{t("settings.profile.fullName")}</Label>
            <Input id="name" value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="Jane Doe" />
          </div>
          <div>
            <Label htmlFor="email">{t("settings.profile.email")}</Label>
            <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="jane@example.com" />
          </div>
          <div>
            <Label htmlFor="jobTitle">{t("settings.profile.jobTitle")}</Label>
            <Input id="jobTitle" value={jobTitle} onChange={(e) => setJobTitle(e.target.value)} placeholder={t("settings.profile.jobTitlePlaceholder")} />
          </div>
          <div>
            <Label htmlFor="phone">{t("settings.profile.phone")}</Label>
            <Input id="phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+90 555 000 0000" />
          </div>
          <div>
            <Label htmlFor="location">{t("settings.profile.location")}</Label>
            <Input id="location" value={location} onChange={(e) => setLocation(e.target.value)} placeholder={t("settings.profile.locationPlaceholder")} />
          </div>
          <div>
            <Label htmlFor="timezone">{t("settings.profile.timezone")}</Label>
            <Select id="timezone" value={timezone} onChange={(e) => setTimezone(e.target.value)}>
              {TIMEZONES.map((tz) => (
                <option key={tz} value={tz}>
                  {tz}
                </option>
              ))}
            </Select>
          </div>
          <div className="sm:col-span-2">
            <Label htmlFor="bio">{t("settings.profile.bio")}</Label>
            <Textarea id="bio" rows={3} value={bio} onChange={(e) => setBio(e.target.value)} placeholder={t("settings.profile.bioPlaceholder")} />
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
