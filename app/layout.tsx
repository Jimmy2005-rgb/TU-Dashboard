import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import AppShell from "@/components/AppShell";
import { isAuthEnabled } from "@/lib/auth";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-sans", display: "swap" });

export const metadata: Metadata = {
  title: { default: "TU BBA Hub", template: "%s · TU BBA Hub" },
  description: "Personal academic hub and quiz vault for Thammasat BBA students.",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = { themeColor: "#c62828" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="font-sans">
        <AppShell authEnabled={isAuthEnabled()}>{children}</AppShell>
      </body>
    </html>
  );
}
