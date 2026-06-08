import Link from "next/link";
import { getT } from "@/lib/i18n/server";
import { AuthLayout, AUTH_BUTTON } from "@/components/ui/auth-layout";

export default async function NotFound() {
  const t = await getT();
  return (
    <AuthLayout center>
      <p className="text-gradient text-7xl font-black tracking-tight">404</p>
      <h1 className="mt-3 text-2xl font-bold">{t("auth.notFound.title")}</h1>
      <p className="mx-auto mt-3 max-w-md text-sm text-muted">{t("auth.notFound.desc")}</p>

      <Link href="/" className={`${AUTH_BUTTON} mt-7 w-auto px-6`}>
        {t("auth.backHome")}
      </Link>
    </AuthLayout>
  );
}
