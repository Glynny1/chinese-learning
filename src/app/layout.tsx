import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import NavBarClient from "@/components/NavBarClient";
import { Toaster } from "react-hot-toast";
import { Analytics } from "@vercel/analytics/next";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Chinese Learning",
  description: "Learn Chinese with words, categories and flashcards",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <div className="max-w-5xl mx-auto px-4">
          <NavBarClient />
          <div className="py-6">{children}</div>
        </div>
        <Toaster position="top-right" toastOptions={{
          style: { borderRadius: '10px' },
        }} />
        <Analytics />
      </body>
    </html>
  );
}
