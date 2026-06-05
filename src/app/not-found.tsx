import Link from "next/link";
import { AuthLayout, AUTH_BUTTON } from "@/components/ui/auth-layout";

export default function NotFound() {
  return (
    <AuthLayout center>
      <p className="text-gradient text-7xl font-black tracking-tight">404</p>
      <h1 className="mt-3 text-2xl font-bold">Page Not Found</h1>
      <p className="mx-auto mt-3 max-w-md text-sm text-muted">
        The page you are looking for doesn&apos;t exist or has been moved.
      </p>

      <Link href="/" className={`${AUTH_BUTTON} mt-7 w-auto px-6`}>
        Back to Home
      </Link>
    </AuthLayout>
  );
}
