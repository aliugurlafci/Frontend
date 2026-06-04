import Link from "next/link";
import { AppearanceForm } from "@/components/crm/settings-appearance-form";

export const dynamic = "force-dynamic";

export default async function AppearanceSettingsPage() {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold">Appearance</h1>
          <p className="text-xs text-muted">Personalize how the app looks</p>
        </div>
        <Link href="/settings" className="text-xs font-medium text-primary hover:underline">
          ← All settings
        </Link>
      </div>
      <AppearanceForm />
    </div>
  );
}
