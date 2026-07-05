import type { Metadata, Viewport } from "next";
import { Suspense } from "react";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages, getTranslations } from "next-intl/server";
import Script from "next/script";
import {
  Inter,
  Rajdhani,
  Oswald,
  Public_Sans,
  Spline_Sans_Mono,
  Heebo,
  Assistant,
} from "next/font/google";
import "./globals.css";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import NextRaceWidgetServer from "@/components/NextRaceWidgetServer";
import GoogleAnalytics from "@/components/GoogleAnalytics";
import ServiceWorkerRegister from "@/components/ServiceWorkerRegister";
import { GA_ID } from "@/lib/ga";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

const rajdhani = Rajdhani({
  variable: "--font-rajdhani",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

/* ── ISL "Qav Rishon" design foundation fonts (roadmap Phase 3) ──────────
   Loaded now as infrastructure; NOT yet consumed by any component — the
   theme flip that switches display/body/mono/Hebrew to these happens in
   Phase 5. Inter + Rajdhani remain the active fonts until then.
   Hebrew subsets are loaded up front (multilingual is in-scope for launch). */
const oswald = Oswald({
  variable: "--font-oswald", // display / masthead (condensed sport grotesque)
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  display: "swap",
});
const publicSans = Public_Sans({
  variable: "--font-public-sans", // body / UI (variable)
  subsets: ["latin"],
  display: "swap",
});
const splineSansMono = Spline_Sans_Mono({
  variable: "--font-spline-mono", // numerals / timing (variable)
  subsets: ["latin"],
  display: "swap",
});
const heebo = Heebo({
  variable: "--font-heebo", // Hebrew display / headlines (variable, geometric sans)
  subsets: ["hebrew", "latin"],
  display: "swap",
});
const assistant = Assistant({
  variable: "--font-assistant", // Hebrew body / UI (variable)
  subsets: ["hebrew", "latin"],
  display: "swap",
});

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("common");
  return {
    title: t("seo.title"),
    description: t("seo.description"),
    applicationName: "F1ISL",
    appleWebApp: {
      capable: true,
      statusBarStyle: "black-translucent",
      title: "F1ISL",
    },
    icons: {
      icon: [
        { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
        { url: "/favicon-16x16.png", sizes: "16x16", type: "image/png" },
      ],
      shortcut: "/favicon.ico",
      apple: "/apple-touch-icon.png",
    },
    manifest: "/site.webmanifest",
  };
}

// PWA / mobile viewport (PW-1). `viewport-fit=cover` lets content extend into
// the safe-area insets on notched devices in the installed app.
export const viewport: Viewport = {
  themeColor: "#0f1113",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const messages = await getMessages();
  const locale = await getLocale();
  const dir = locale === "he" ? "rtl" : "ltr";
  return (
    <html lang={locale} dir={dir} data-scroll-behavior="smooth">
      <body
        className={`${inter.variable} ${rajdhani.variable} ${oswald.variable} ${publicSans.variable} ${splineSansMono.variable} ${heebo.variable} ${assistant.variable} antialiased`}
      >
        {/* Global "black + gold dust" atmosphere — one fixed layer behind all
            routes. Pointer-events disabled; see .isl-global-bg in globals.css. */}
        <div className="isl-global-bg" aria-hidden="true" />
        <NextIntlClientProvider messages={messages}>
        {/* ── Google Analytics 4 (production only) ── */}
        {GA_ID && process.env.NODE_ENV === "production" && (
          <>
            <Script
              src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`}
              strategy="afterInteractive"
            />
            <Script id="ga4-init" strategy="afterInteractive">
              {`
                window.dataLayer = window.dataLayer || [];
                function gtag(){dataLayer.push(arguments);}
                gtag('js', new Date());
                gtag('config', '${GA_ID}', {
                  anonymize_ip: true,
                  page_path: window.location.pathname,
                });
              `}
            </Script>
          </>
        )}
        <Suspense fallback={null}>
          <GoogleAnalytics />
        </Suspense>
        <ServiceWorkerRegister />

        <Header />
        {children}
        <Footer />
        <Suspense fallback={null}>
          <NextRaceWidgetServer />
        </Suspense>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
