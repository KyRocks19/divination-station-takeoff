import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
import "./globals.css";
// Readable fonts a person can choose in Settings (lib/comfort.ts). Self-hosted by the packages (nothing is fetched from
// another site), and a browser only downloads the one in use. Latin letters only; anything else falls back to the device font.
import "@fontsource/atkinson-hyperlegible/latin-400.css";
import "@fontsource/atkinson-hyperlegible/latin-700.css";
import "@fontsource/atkinson-hyperlegible/latin-ext-400.css";
import "@fontsource/atkinson-hyperlegible/latin-ext-700.css";
import "@fontsource-variable/lexend/wght.css";
import "@fontsource/opendyslexic/latin-400.css";
import "@fontsource/opendyslexic/latin-700.css";
import AppHeader from "@/components/AppHeader";
import SideNav from "@/components/SideNav";
import ReadingViewCounter from "@/components/ReadingViewCounter";
import HeaderHeight from "@/components/HeaderHeight";
import SiteFooter from "@/components/SiteFooter";
import { ChosenToolsProvider } from "@/components/ChosenTools";
import ServiceWorkerRegistration from "@/components/ServiceWorkerRegistration";
import { getSession } from "@/lib/session";
import { shapeOf } from "@/lib/edition";
import { getPrefs } from "@/lib/prefs";
import { DEFAULT_NAV_FOLDED } from "@/lib/nav-groups";
import { themeCss } from "@/lib/theme";
import { THEME_STYLE_ID } from "@/lib/theme-lab-shared";
import ThemeGuard from "@/components/ThemeGuard";
import FocusKeeper from "@/components/FocusKeeper";
import { FeedbackProvider } from "@/components/FeedbackDialog";
import { COMFORT_BOOT_SCRIPT, comfortAttributes } from "@/lib/comfort";
import ComfortMirror from "@/components/ComfortMirror";
import { NAV_BOOT_SCRIPT } from "@/lib/nav-width";

export const metadata: Metadata = {
  title: { default: "Divination Station", template: "%s · Divination Station" },
  description: "A private place to learn and practise divination",
  icons: { apple: "/icon-192.png" },
  appleWebApp: { capable: true, statusBarStyle: "black-translucent", title: "Divination Station" },
};

export const viewport: Viewport = {
  themeColor: "#7c3aed",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // The nonce proxy.ts made for this request: the script below runs only with it (lib/csp.ts).
  const nonce = (await headers()).get("x-nonce") ?? undefined;
  const session = await getSession();
  const prefs = session.userId ? await getPrefs(session.userId) : null;
  const edition = shapeOf();
  // Choices kept in the account (migration 079) are put on <html> here, so they follow the person to any device. Without them the head script below
  // applies what this device kept, as before (it also serves the sign-in page).
  const accountComfort = prefs?.comfort ?? null;

  return (
    <html lang="en" suppressHydrationWarning {...(accountComfort ? comfortAttributes(accountComfort) : {})}>
      <head>
        {/* The person's own colours, as a rule in a style element with the page's nonce (an inline style attribute is refused: lib/csp.ts). */}
        {themeCss(prefs?.theme) && <style id={THEME_STYLE_ID} nonce={nonce} dangerouslySetInnerHTML={{ __html: themeCss(prefs?.theme)! }} />}
        {/* Puts the person's font, size, spacing and motion choices on <html> before anything is drawn (no flash). */}
        {!accountComfort && <script nonce={nonce} dangerouslySetInnerHTML={{ __html: COMFORT_BOOT_SCRIPT }} />}
        {/* Narrows the side column before it is drawn when the person chose that on this device (lib/nav-width.ts). */}
        <script nonce={nonce} dangerouslySetInnerHTML={{ __html: NAV_BOOT_SCRIPT }} />
      </head>
      <body className="min-h-full flex flex-col bg-canvas text-ink" suppressHydrationWarning>
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[70] focus:rounded-control focus:border focus:border-line-strong focus:bg-surface focus:px-4 focus:py-2 focus:text-sm focus:text-ink-strong print:hidden"
        >
          Skip to the page content
        </a>
        <ServiceWorkerRegistration />
        <ThemeGuard />
        <FocusKeeper />
        {accountComfort && <ComfortMirror comfort={accountComfort} />}
        {session.userId ? (
          // Signed in: the header bar across the top, the side navigation on the left (a drawer below 1024 px), the page.
          <FeedbackProvider>
            <AppHeader username={session.username} isAdmin={session.isAdmin} edition={edition} tools={prefs?.tools ?? null} navFolded={prefs?.navFolded ?? DEFAULT_NAV_FOLDED} />
            <HeaderHeight />
            <ReadingViewCounter />
            <div className="flex flex-1 min-w-0">
              <SideNav username={session.username} isAdmin={session.isAdmin} edition={edition} tools={prefs?.tools ?? null} navFolded={prefs?.navFolded ?? DEFAULT_NAV_FOLDED} />
              {/* The footer sits in this column, beside the side navigation, so the row reaches the bottom of the page and the
                  sticky side navigation never has to slide up under the header when the page is scrolled to its end. */}
              <div className="flex-1 min-w-0 flex flex-col">
                <main id="main" tabIndex={-1} className="flex-1 min-w-0 focus:outline-none">
                  <ChosenToolsProvider tools={prefs?.tools ?? null}>{children}</ChosenToolsProvider>
                </main>
                <SiteFooter />
              </div>
            </div>
          </FeedbackProvider>
        ) : (
          <main id="main" tabIndex={-1} className="flex-1 min-w-0 focus:outline-none">
            <ChosenToolsProvider tools={null}>{children}</ChosenToolsProvider>
          </main>
        )}
        {!session.userId && <SiteFooter />}
      </body>
    </html>
  );
}
