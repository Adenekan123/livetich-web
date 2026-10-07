import type { Metadata } from "next";
import Script from "next/script";
import { Lexend, Inter, Source_Sans_3, Geist_Mono } from "next/font/google";
import { ImpersonationBanner } from "@/components/impersonation-banner";
import { RouteProgress } from "@/components/route-progress";
import "./globals.css";

// Display face for headings — Lexend carries the warm, accessible direction
const lexend = Lexend({
  variable: "--font-lexend",
  subsets: ["latin"],
});

// Primary UI face — Inter, engineered for screen legibility, UI density, and tabular figures.
const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

// Humanist sans fallback for long reading.
const sourceSans = Source_Sans_3({
  variable: "--font-source",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "livetich — teach skills live",
  description:
    "One live room for your whole cohort: video, a shared chalkboard, buzzer quizzes, and a live leaderboard that keeps everyone in it.",
  // Two marks, chosen by the browser/tab colour scheme: the dark mark reads on
  // light chrome, the light mark on dark chrome.
  icons: {
    icon: [
      { url: "/favicon-dark.png", media: "(prefers-color-scheme: light)", type: "image/png" },
      { url: "/favicon-light.png", media: "(prefers-color-scheme: dark)", type: "image/png" },
    ],
    apple: { url: "/favicon-dark.png" },
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      data-theme="light"
      suppressHydrationWarning
      className={`${lexend.variable} ${inter.variable} ${sourceSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <head>
        {/* Set the landing theme before first paint to avoid a flash. Stored
            choice wins; otherwise light is the default. */}
        <script
          id="lp-theme-init"
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('lp-theme');if(t!=='light'&&t!=='dark'){t='light';}document.documentElement.setAttribute('data-theme',t);}catch(e){document.documentElement.setAttribute('data-theme','light');}})();`,
          }}
        />
      </head>
      <body className="flex min-h-full flex-col bg-white text-foreground">
        <RouteProgress />
        <ImpersonationBanner />
        {children}
        <Script
          id="sw-register"
          strategy="afterInteractive"
          dangerouslySetInnerHTML={{
            __html: `(function(){if('serviceWorker' in navigator && (window.location.protocol === 'https:' || window.location.hostname === 'localhost')){window.addEventListener('load',function(){navigator.serviceWorker.register('/sw.js').catch(function(){});});}})();`,
          }}
        />
      </body>
    </html>
  );
}
