import type { Metadata } from "next";
import Script from "next/script";
import { Lexend, Source_Sans_3, Geist_Mono } from "next/font/google";
import "./globals.css";

// Display face for headings — Lexend is engineered for reading fluency, which
// suits an all-ages learning product and pairs cleanly with Noto Sans Arabic
// for RTL. Carries the warm, accessible "flat & human" direction.
const lexend = Lexend({
  variable: "--font-lexend",
  subsets: ["latin"],
});

// Body face — Source Sans 3, a highly legible humanist sans for long reading.
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
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      data-theme="dark"
      suppressHydrationWarning
      className={`${lexend.variable} ${sourceSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col bg-white text-foreground">
        {/* Set the landing theme before first paint to avoid a flash. Stored
            choice wins; otherwise dark is the default. */}
        <Script id="lp-theme-init" strategy="beforeInteractive">
          {
            "(function(){try{var t=localStorage.getItem('lp-theme');if(t!=='light'&&t!=='dark'){t='dark';}document.documentElement.setAttribute('data-theme',t);}catch(e){document.documentElement.setAttribute('data-theme','dark');}})();"
          }
        </Script>
        {children}
      </body>
    </html>
  );
}
