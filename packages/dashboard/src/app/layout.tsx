import type { Metadata } from "next";
import { Manrope } from "next/font/google";
import "./globals.css";
import { AppShell } from "@/components/AppShell";

const manrope = Manrope({
  subsets: ["latin"],
  variable: "--font-manrope",
});

export const metadata: Metadata = {
  title: "ARCANA — Stylus Historical Analytics",
  description:
    "Real-time and historical analytics dashboard for Stylus dApps on Arbitrum",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body
        className={`${manrope.variable} min-h-screen bg-[#0e1417] text-[#dde3e7] antialiased`}
      >
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
