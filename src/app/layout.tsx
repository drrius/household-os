import type { Metadata, Viewport } from "next";
import { Nunito, Work_Sans } from "next/font/google";
import type { ReactNode } from "react";

import "./design-system.css";

const uiFont = Nunito({
  subsets: ["latin"],
  weight: ["500", "600", "700", "800", "900"],
  variable: "--font-ui",
});

const chromeFont = Work_Sans({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  variable: "--font-chrome",
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
    <html lang="en" className={`${uiFont.variable} ${chromeFont.variable}`}>
      <body>{children}</body>
    </html>
  );
}
