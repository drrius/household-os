import { SearchOriginProvider } from "@/ui/search/search-origin.client";
import { HistoryGuard } from "@/ui/forms/history-guard.client";
import type { Metadata, Viewport } from "next";
import { ThemeProvider } from "next-themes";
import { Nunito, Work_Sans } from "next/font/google";
import type { ReactNode } from "react";

import "./globals.css";
import { cn } from "@/lib/utils";
import { ServiceWorkerRegistrar } from "@/ui/pwa/service-worker-registrar.client";

const uiFont = Work_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-sans",
});

const headingFont = Nunito({
  subsets: ["latin"],
  weight: ["600", "700", "800", "900"],
  variable: "--font-heading",
});

export const metadata: Metadata = {
  title: "Household OS",
  description: "Private household coordination for two people.",
  applicationName: "Household OS",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Household OS",
  },
  formatDetection: {
    telephone: false,
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // Without cover, iOS reports every safe-area inset as 0 in standalone
  // mode, and the bottom chrome sits under the home indicator.
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f5f1e8" },
    { media: "(prefers-color-scheme: dark)", color: "#2c2924" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  return (
    <html
      lang="en"
      className={cn(uiFont.variable, headingFont.variable, "font-sans")}
      suppressHydrationWarning
    >
      <body>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <HistoryGuard />
          <ServiceWorkerRegistrar />
          <SearchOriginProvider>{children}</SearchOriginProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
