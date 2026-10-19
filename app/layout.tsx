import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import AppShell from "@/components/AppShell";
import { CourseColorProvider } from "@/components/CourseColors";
import { isAuthEnabled } from "@/lib/auth";
import { assignCourseColors, type CourseColorInput } from "@/lib/course-colors";
import { getSupabaseAdmin } from "@/lib/supabase";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-sans", display: "swap" });

export const metadata: Metadata = {
  title: { default: "TU BBA Hub", template: "%s · TU BBA Hub" },
  description: "Personal academic hub and quiz vault for Thammasat BBA students.",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f8fafc" },
    { media: "(prefers-color-scheme: dark)", color: "#0b0e14" },
  ],
};

// Applies the saved theme and calm mode before first paint (no light flash in dark mode).
const displayScript = `(function(){try{var t=localStorage.getItem("tu-theme")||"system";var d=t==="dark"||(t==="system"&&matchMedia("(prefers-color-scheme: dark)").matches);var c=document.documentElement.classList;if(d)c.add("dark");if(localStorage.getItem("tu-calm")==="1")c.add("calm");}catch(e){}})();`;

async function loadCourseColors(): Promise<Record<string, number>> {
  try {
    const { data } = await getSupabaseAdmin().from("courses").select("course_code, color, created_at");
    return assignCourseColors((data ?? []) as CourseColorInput[]);
  } catch {
    return {}; // not configured yet — pages show the setup notice
  }
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const colors = await loadCourseColors();
  return (
    <html lang="en" className={inter.variable} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: displayScript }} />
      </head>
      <body className="font-sans">
        <CourseColorProvider colors={colors}>
          <AppShell authEnabled={isAuthEnabled()}>{children}</AppShell>
        </CourseColorProvider>
      </body>
    </html>
  );
}
