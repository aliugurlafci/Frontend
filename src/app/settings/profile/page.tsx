import Link from "next/link";
import { serverApi } from "@/lib/http/server-api";
import { ProfileForm } from "@/components/crm/settings-profile-form";

export const dynamic = "force-dynamic";

export default async function ProfileSettingsPage() {
  const me = await serverApi.me();
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold">Profile Settings</h1>
          <p className="text-xs text-muted">Update your personal information</p>
        </div>
        <Link href="/settings" className="text-xs font-medium text-primary hover:underline">
          ← All settings
        </Link>
      </div>
      <ProfileForm
        initial={{
          displayName: me.displayName,
          email: me.email,
          phone: me.phone ?? "",
          timezone: me.timezone ?? "UTC",
        }}
      />
    </div>
  );
}
