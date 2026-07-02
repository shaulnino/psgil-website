import type { Metadata } from "next";
import { Suspense } from "react";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages, getTranslations } from "next-intl/server";
import Script from "next/script";
import {
  Inter,
  Rajdhani,
  Zilla_Slab,
  Public_Sans,
  Spline_Sans_Mono,
  Frank_Ruhl_Libre,
  Assistant,
} from "next/font/google";
import "./globals.css";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import NextRaceWidgetServer from "@/components/NextRaceWidgetServer";
import GoogleAnalytics from "@/components/GoogleAnalytics";
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
const zillaSlab = Zilla_Slab({
  variable: "--font-zilla-slab", // display / masthead (slab serif)
  subsets: ["latin"],
  weight: ["600", "700"],
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
const frankRuhl = Frank_Ruhl_Libre({
  variable: "--font-frank-ruhl", // Hebrew display / headlines (variable)
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
        className={`${inter.variable} ${rajdhani.variable} ${zillaSlab.variable} ${publicSans.variable} ${splineSansMono.variable} ${frankRuhl.variable} ${assistant.variable} antialiased`}
      >
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
