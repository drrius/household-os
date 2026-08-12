import type { Metadata, Viewport } from "next";
import { Nunito, Noto_Sans } from "next/font/google";
import type { ReactNode } from "react";

import "./globals.css";
import { cn } from "@/lib/utils";

const uiFont = Nunito({
  subsets: ["latin"],
  weight: ["500", "600", "700", "800", "900"],
  variable: "--font-sans",
});

const headingFont = Noto_Sans({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  variable: "--font-heading",
});

export const metadata: Metadata = {
  title: "Household OS",
  description: "Private household coordination for two people.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  return (
    <html
      lang="en"
      className={cn(uiFont.variable, headingFont.variable, "font-sans")}
    >
      <body>{children}</body>
    </html>
  );
}
