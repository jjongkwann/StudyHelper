import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import {
  DesktopSidebar,
  MobileBottomNav,
  MobileHeader,
} from "@/components/app-shell-nav";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "StudyHelper",
  description: "AI-powered spaced repetition study tool",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <div className="min-h-screen bg-background">
          <MobileHeader />
          <div className="flex min-h-screen">
            <DesktopSidebar />
            <main className="flex-1 min-w-0 pb-24 md:pb-0">
              <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 md:px-8 md:py-8">
                <div className="max-w-4xl">{children}</div>
              </div>
            </main>
          </div>
          <MobileBottomNav />
        </div>
      </body>
    </html>
  );
}
