import type { Metadata } from "next";
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

export const metadata: Metadata = {
  title: "Aula CRM",
  description: "Metadata-driven, multi-tenant CRM",
};

// Runs before paint to apply theme + accent + density from the user's DB settings
// (injected below) so there's no flash of the wrong UI.
function noFlashScript(settings: Settings): string {
  return `(function(){try{var R=document.documentElement;var s=${JSON.stringify(settings)};var t=s.theme||'system';var d=t==='dark'||(t==='system'&&matchMedia('(prefers-color-scheme: dark)').matches);R.classList.toggle('dark',d);if(s.accent){R.style.setProperty('--primary',s.accent);R.style.setProperty('--primary-hover',s.accent);}if(s.density==='compact'){R.setAttribute('data-density','compact');}}catch(e){}})();`;
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
    <html lang={locale} className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
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
