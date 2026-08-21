import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL ||
      (process.env.VERCEL_PROJECT_PRODUCTION_URL
        ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
        : "http://localhost:3000"),
  ),
  title: "Habit Tracker",
  description: "A personal routine, progress, and daily journaling companion.",
  openGraph: {
    title: "Habit Tracker",
    description: "Build routines, review your progress, and reflect on each day.",
  },
  twitter: {
    card: "summary",
    title: "Habit Tracker",
    description: "Build routines, review your progress, and reflect on each day.",
  },
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
