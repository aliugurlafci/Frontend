import Link from "next/link";
import { PasswordForm } from "@/components/crm/settings-password-form";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export const dynamic = "force-dynamic";

export default function SecuritySettingsPage() {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold">Security Settings</h1>
          <p className="text-xs text-muted">Password, two-factor and sessions</p>
        </div>
        <Link href="/settings" className="text-xs font-medium text-primary hover:underline">
          ← All settings
        </Link>
      </div>

      <PasswordForm />

      <Card>
        <CardHeader title="Two-factor authentication" action={<Badge tone="warning">Off</Badge>} />
        <CardBody className="flex items-center justify-between gap-3 text-sm">
          <p className="text-muted">An authenticator-app second factor is planned but not enabled in this build.</p>
          <Button variant="outline" size="sm" type="button" disabled title="Not available yet">
            Enable 2FA
          </Button>
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Sessions" />
        <CardBody className="text-sm text-muted">
          Your session uses an httpOnly JWT cookie. Use <strong>Sign out</strong> in the top bar to end it; the token
          expires automatically. Per-device session management is planned.
        </CardBody>
      </Card>
    </div>
  );
}
