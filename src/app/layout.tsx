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
  title: "HR Resume Screener",
  description: "AI-powered resume screening and candidate ranking",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full">
        <div className="flex min-h-screen">
          <aside className="fixed inset-y-0 left-0 w-56 bg-slate-900 text-slate-200 flex flex-col">
            <div className="px-5 py-5 border-b border-slate-800">
              <Link href="/" className="flex items-center gap-2">
                <span className="text-2xl">🎯</span>
                <div>
                  <div className="font-semibold text-white leading-tight">
                    ResumeRank
                  </div>
                  <div className="text-[11px] text-slate-400">
                    AI Resume Screening
                  </div>
                </div>
              </Link>
            </div>
            <nav className="flex-1 px-3 py-4 space-y-1 text-sm">
              <Link
                href="/"
                className="block rounded-md px-3 py-2 hover:bg-slate-800 hover:text-white"
              >
                📊 Dashboard
              </Link>
              <Link
                href="/jobs"
                className="block rounded-md px-3 py-2 hover:bg-slate-800 hover:text-white"
              >
                💼 Job Openings
              </Link>
              <Link
                href="/jobs/new"
                className="block rounded-md px-3 py-2 hover:bg-slate-800 hover:text-white"
              >
                ➕ New Job
              </Link>
              <Link
                href="/settings"
                className="block rounded-md px-3 py-2 hover:bg-slate-800 hover:text-white"
              >
                ⚙️ Settings
              </Link>
            </nav>
            <div className="px-5 py-4 text-[11px] text-slate-500 border-t border-slate-800">
              Local MVP · SQLite + AI
            </div>
          </aside>
          <main className="flex-1 ml-56 px-8 py-8 max-w-7xl">{children}</main>
        </div>
      </body>
    </html>
  );
}
