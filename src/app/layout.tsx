import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import "./globals.css";

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
        <div className="flex min-h-screen">
          <aside className="w-64 border-r bg-muted/30 p-6 flex flex-col gap-6">
            <Link href="/" className="text-xl font-bold">
              StudyHelper
            </Link>
            <nav className="flex flex-col gap-2">
              <Link
                href="/"
                className="px-3 py-2 rounded-md hover:bg-muted transition-colors text-sm"
              >
                Dashboard
              </Link>
              <Link
                href="/projects"
                className="px-3 py-2 rounded-md hover:bg-muted transition-colors text-sm"
              >
                Projects
              </Link>
            </nav>
          </aside>
          <main className="flex-1 p-8">{children}</main>
        </div>
      </body>
    </html>
  );
}
