import type { Metadata } from "next";
import { Geist_Mono } from "next/font/google";
import "./globals.css";
import DashboardLayout from "@/components/layout/DashboardLayout";

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Futures Bot — Auto Scanner",
  description: "Automatic futures signal scanner with multi-strategy confidence scoring",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className={`${geistMono.variable} font-mono antialiased bg-gray-950 text-white`}>
        <DashboardLayout>{children}</DashboardLayout>
      </body>
    </html>
  );
}
