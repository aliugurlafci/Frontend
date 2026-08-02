import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { cookies } from "next/headers";
import { Toaster } from "sonner";
import { AntdRegistry } from "@ant-design/nextjs-registry";
import "./globals.css";
import { AppShell } from "@/components/crm/app-shell";
import { SettingsProvider, type Settings } from "@/components/ui/settings-provider";
import { AntdConfig } from "@/components/ui/antd-config";
import { I18nProvider } from "@/lib/i18n/context";
import { getLocale } from "@/lib/i18n/server";
import { serverApi } from "@/lib/http/server-api";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

const SITE_URL = process.env.AULA_SITE_URL ?? "http://localhost:3000";
const OG_DESCRIPTION = "Inventory, point of sale and sales in one workspace.";

export const metadata: Metadata = {
  // Absolute base for the social-card image below (relative URLs need it).
  metadataBase: new URL(SITE_URL),
  title: "Aula CRM",
  description: "Metadata-driven, multi-tenant CRM",
  applicationName: "Aula CRM",
  // Indexable by search engines. (Authenticated app routes redirect
  // unauthenticated visitors — including crawlers — to /login, so private data
  // never reaches the index even though pages are not explicitly noindex.)
  robots: { index: true, follow: true },
  // The favicon / apple-touch icon come from the file conventions next to this
  // file (favicon.ico, apple-icon.png); the manifest adds the install icons.
  manifest: "/manifest.webmanifest",
  openGraph: {
    type: "website",
    siteName: "Aula CRM",
    title: "Aula CRM",
    description: OG_DESCRIPTION,
    images: [{ url: "/og-image.png", width: 1200, height: 630, alt: "Aula CRM" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Aula CRM",
    description: OG_DESCRIPTION,
    images: ["/og-image.png"],
  },
};

/** Browser/OS chrome colour — the accent in light UI, the app backdrop in dark. */
export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#eef2f9" },
    { media: "(prefers-color-scheme: dark)", color: "#070a10" },
  ],
};

// Runs before paint to apply theme + accent + density + text size + motion from
// the user's DB settings (injected below) so there's no flash of the wrong UI.
function noFlashScript(settings: Settings): string {
  return `(function(){try{var R=document.documentElement;var s=${JSON.stringify(settings)};var t=s.theme||'system';var d=t==='dark'||(t==='system'&&matchMedia('(prefers-color-scheme: dark)').matches);R.classList.toggle('dark',d);if(s.accent){R.style.setProperty('--primary',s.accent);R.style.setProperty('--primary-hover',s.accent);}if(s.density==='compact'){R.setAttribute('data-density','compact');}if(s.fontSize==='sm'||s.fontSize==='lg'){R.setAttribute('data-font',s.fontSize);}if(s.motion==='reduced'){R.setAttribute('data-motion','reduced');}}catch(e){}})();`;
}

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const locale = await getLocale();
  // Per-user settings live in the DB (userSetting table). Seed them server-side
  // so the first paint is correct. Only attempt when a session exists.
  const hasSession = Boolean((await cookies()).get("aula_session")?.value);
  let settings: Settings = {};
  if (hasSession) {
    try {
      settings = (await serverApi.me()).settings ?? {};
    } catch {
      settings = {};
    }
  }

  return (
    // `suppressHydrationWarning` covers this element's own attributes only: the
    // no-flash script below deliberately mutates <html> (the `dark` class, the
    // accent custom properties, the data-density/font/motion attributes) before
    // React hydrates, so the DOM legitimately differs from the server markup.
    <html
      lang={locale}
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: noFlashScript(settings) }} />
      </head>
      <body className="min-h-full font-sans">
        <I18nProvider locale={locale}>
          <SettingsProvider initial={settings}>
            <AntdRegistry>
              <AntdConfig initialDark={settings.theme === "dark"}>
                <a
                  href="#main-content"
                  className="sr-only focus:not-sr-only focus:absolute focus:left-3 focus:top-3 focus:z-50 focus:rounded-md focus:bg-primary focus:px-3 focus:py-2 focus:text-primary-foreground"
                >
                  Skip to content
                </a>
                <AppShell>{children}</AppShell>
                <Toaster richColors position="top-right" closeButton />
              </AntdConfig>
            </AntdRegistry>
          </SettingsProvider>
        </I18nProvider>
      </body>
    </html>
  );
}
