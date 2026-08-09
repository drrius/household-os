import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";

import "./reset.css";

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
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
